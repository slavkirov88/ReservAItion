// ---------------------------------------------------------------------------
// Clock PMS+ REST client.
//
// Ported from the StayDesk integration, where the transport was written and
// paid for once. Only the transport crosses over: the booking and room readers
// there belong to the `staydesk_guest` API user, and this project authenticates
// as `staydesk_voice`, which has a different and deliberately narrower set of
// rights.
//
// Clock authenticates with HTTP Digest (api_user / api_key), which fetch does
// not speak: the first request always comes back 401 carrying the challenge,
// and the real request is the second one. That handshake is implemented here
// rather than pulled in as a dependency - it is forty lines, and an auth
// library is a strange thing to trust with somebody else's guest data.
//
// Four rules from Clock's own documentation shape this file, and none of them
// are ours to soften:
//
//   - Rate limit: 5 calls per second per API user, answered with 429. Their
//     prescribed back-off is linear: delay = retry counter * 500ms.
//   - "Other client errors (4xx, 5xx) indicate that you need to revise the
//     request to correct the problem before trying again. Please do not retry
//     them automatically." So a 500 is NOT retried here, however tempting.
//   - A Web Application Firewall bans a suspicious caller's IP for two hours
//     and answers 403 meanwhile. Retrying into a ban is how the ban gets
//     earned twice, so a ban stops everything and says why.
//   - Service Terms 6.2: "API 90 Percentile: Clock offers no guarantee for
//     this specific metric." The tail is uncovered, so every call runs on a
//     hard deadline and callers must survive a timeout, not wait it out.
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from 'node:crypto'

export interface ClockCredentials {
  /** e.g. https://sky-eu1.clock-software.com/pms_api/176987/16449 */
  baseUrl: string
  apiUser: string
  apiKey: string
}

export interface ClockRequestOptions {
  /** Query parameters. Undefined values are dropped rather than sent empty. */
  query?: Record<string, string | number | undefined>
  /**
   * Repeated parameters, e.g. `rates[]=1&rates[]=2`. Clock's contracts want
   * arrays in this form; a comma-joined list is rejected by some of them.
   */
  repeated?: Record<string, Array<string | number>>
  /** Hard deadline for ONE attempt, in ms. */
  timeoutMs?: number
  /** Extra attempts after the first. Only 429s and transport failures retry. */
  retries?: number
  /**
   * Collection endpoints answer on a trailing slash. Action endpoints such as
   * `products` and `guests/search` do not want one, so it can be turned off.
   */
  trailingSlash?: boolean
}

export class ClockError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message)
    this.name = 'ClockError'
  }
}

/** A 403 from the WAF: our IP is banned, typically for two hours. */
export class ClockBannedError extends ClockError {
  constructor(body?: string) {
    super(
      'Clock answered 403. Their WAF bans a suspicious caller for about two hours. ' +
        'Stop calling and find what in the recent requests looked like an attack.',
      403,
      body,
    )
    this.name = 'ClockBannedError'
  }
}

/**
 * A 403 about a missing right, which is a different animal from a ban.
 *
 * Verified against the sandbox on 2026-08-30: the guest API user asking for
 * rates_availability got
 *   403 {"error":"The User doesn't have pms_api_rates_availability_show right"}
 * Reporting that as a two-hour ban would send someone hunting a problem that
 * does not exist, so the two are told apart by the body.
 */
export class ClockForbiddenError extends ClockError {
  constructor(
    body: string,
    readonly right: string | null,
  ) {
    super(
      right
        ? `Clock refused the call: this API user lacks the "${right}" right.`
        : 'Clock refused the call: this API user lacks a required right.',
      403,
      body,
    )
    this.name = 'ClockForbiddenError'
  }
}

const DEFAULT_TIMEOUT_MS = 8_000
const DEFAULT_RETRIES = 2

/** Clock's documented ceiling, per API user. */
export const RATE_LIMIT_PER_SECOND = 5

const md5 = (value: string) => createHash('md5').update(value).digest('hex')
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// Client-side rate limiting.
//
// Staying under the limit ourselves is cheaper than discovering it: a 429 costs
// a round trip, and a pattern of them is the kind of "suspicious behaviour" the
// WAF is explicitly watching for. Counted per API user because the limit is,
// and because the guest and voice integrations must not spend each other's.
// ---------------------------------------------------------------------------
const recentCalls = new Map<string, number[]>()

async function waitForSlot(apiUser: string): Promise<void> {
  for (;;) {
    const now = Date.now()
    const window = (recentCalls.get(apiUser) ?? []).filter((t) => now - t < 1000)

    if (window.length < RATE_LIMIT_PER_SECOND) {
      window.push(now)
      recentCalls.set(apiUser, window)
      return
    }
    // Sleep until the oldest call in the window falls out of it.
    await sleep(1000 - (now - window[0]) + 5)
  }
}

/** Test seam: the limiter is module state, and a suite should start clean. */
export function resetRateLimiter(): void {
  recentCalls.clear()
}

/**
 * Parses a `WWW-Authenticate: Digest ...` header into its fields.
 *
 * Values arrive quoted (realm="x") or bare (qop=auth, stale=false) depending on
 * the field, and Clock sends both forms in one header, so both are accepted.
 */
export function parseDigestChallenge(header: string): Record<string, string> {
  const fields: Record<string, string> = {}
  const body = header.replace(/^\s*Digest\s+/i, '')
  const pattern = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g

  for (const match of body.matchAll(pattern)) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? ''
  }
  return fields
}

/**
 * Builds the Authorization header for one request.
 *
 * `uri` must be the path AND the query string exactly as they will be sent
 * together - HA2 hashes it, so a query string dropped here fails the digest
 * with a 401 that looks, misleadingly, like a wrong key.
 */
export function buildDigestHeader(input: {
  challenge: Record<string, string>
  method: string
  uri: string
  username: string
  password: string
  cnonce: string
  nc?: string
}): string {
  const { challenge, method, uri, username, password, cnonce } = input
  const nc = input.nc ?? '00000001'
  const realm = challenge.realm ?? ''
  const nonce = challenge.nonce ?? ''
  // Clock advertises qop="auth"; the header may also list several, space
  // separated, in which case "auth" is the one we implement.
  const qop = challenge.qop?.split(/[,\s]+/).find((q) => q === 'auth')

  const ha1 = md5(`${username}:${realm}:${password}`)
  const ha2 = md5(`${method.toUpperCase()}:${uri}`)
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`)

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ]
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`)
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`)

  return `Digest ${parts.join(', ')}`
}

/** Joins base and path into a URL, and returns the request-line URI separately. */
export function resolve(
  baseUrl: string,
  path: string,
  options: Pick<ClockRequestOptions, 'query' | 'repeated' | 'trailingSlash'> = {},
) {
  // Clock's collection endpoints answer on a trailing slash; without one some
  // of them redirect and the digest, computed for the old URI, stops matching.
  const bare = path.replace(/^\/+/, '').replace(/\/*$/, '')
  const clean = options.trailingSlash === false ? bare : `${bare}/`
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/${clean}`)

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  for (const [key, values] of Object.entries(options.repeated ?? {})) {
    for (const value of values) url.searchParams.append(key, String(value))
  }
  return { url, uri: url.pathname + url.search }
}

/**
 * Turns a 403 into the right error.
 *
 * Clock uses the same status for "your IP is banned" and "this user lacks a
 * right". Only the body separates them, and the difference decides whether the
 * caller waits two hours or asks Clock for a permission.
 */
function forbidden(text: string): ClockError {
  const match = text.match(/have (?:the following right: )?'?"?([a-zA-Z0-9_: ]+?)'?"? ?right/i)
    ?? text.match(/right: '([^']+)'/i)
  if (/does ?n'?o?t have/i.test(text) && /right/i.test(text)) {
    return new ClockForbiddenError(text.slice(0, 500), match?.[1]?.trim() ?? null)
  }
  return new ClockBannedError(text.slice(0, 500))
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text()

  if (response.status === 403) throw forbidden(text)

  if (!response.ok) {
    // Building the message must not be able to throw: a Response without a
    // url would otherwise turn "Clock said 500" into an opaque URL parse
    // error, hiding the status that actually matters.
    let where = response.url || 'the request'
    try {
      where = new URL(response.url).pathname
    } catch {
      /* keep the fallback */
    }
    throw new ClockError(
      `Clock responded ${response.status} for ${where}`,
      response.status,
      text.slice(0, 500),
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ClockError('Clock returned a body that is not JSON', response.status, text.slice(0, 200))
  }
}

async function attempt<T>(
  creds: ClockCredentials,
  method: 'GET' | 'POST',
  url: URL,
  uri: string,
  timeoutMs: number,
  body?: unknown,
): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs)
  const payload = body === undefined ? undefined : JSON.stringify(body)
  const base: Record<string, string> = { Accept: 'application/json' }
  // The charset is spelled out rather than left to the default. Guest names in
  // a Bulgarian hotel are Cyrillic, and a receiver that falls back to latin-1
  // turns them into question marks inside the hotel's own database.
  if (payload !== undefined) base['Content-Type'] = 'application/json; charset=utf-8'

  // First pass: unauthenticated, purely to collect the challenge.
  const challenged = await fetch(url, { method, signal, headers: base, body: payload })

  if (challenged.status !== 401) {
    // Some deployments answer without demanding the handshake. Nothing to fix.
    return readJson<T>(challenged)
  }

  const header = challenged.headers.get('www-authenticate')
  if (!header) {
    throw new ClockError('Clock returned 401 without a WWW-Authenticate header', 401)
  }

  const authorization = buildDigestHeader({
    challenge: parseDigestChallenge(header),
    method,
    uri,
    username: creds.apiUser,
    password: creds.apiKey,
    cnonce: randomBytes(8).toString('hex'),
  })

  const authorized = await fetch(url, {
    method,
    signal,
    headers: { ...base, Authorization: authorization },
    body: payload,
  })
  return readJson<T>(authorized)
}

/**
 * One GET against Clock, with the Digest handshake, a deadline and back-off.
 *
 * Retries are deliberately narrow: a 429, because Clock documents it as "slow
 * down and come back", and a transport failure, because the request may never
 * have arrived. Every other status is a request that needs changing, and
 * repeating it only spends someone else's rate limit and our credibility.
 */
export async function clockGet<T = unknown>(
  creds: ClockCredentials,
  path: string,
  options: ClockRequestOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES } = options
  const { url, uri } = resolve(creds.baseUrl, path, options)

  for (let tries = 0; tries <= retries; tries++) {
    try {
      await waitForSlot(creds.apiUser)
      return await attempt<T>(creds, 'GET', url, uri, timeoutMs)
    } catch (error) {
      if (error instanceof ClockBannedError || error instanceof ClockForbiddenError) throw error

      const status = error instanceof ClockError ? error.status : undefined
      // `undefined` means the request never got an answer: a timeout or a dead
      // socket, which is worth one more try. A status means Clock replied, and
      // only 429 is documented as "try again".
      const retryable = status === 429 || status === undefined
      if (!retryable || tries === retries) throw error

      // Clock's own prescription: delay = retry counter * 500 milliseconds.
      await sleep((tries + 1) * 500)
    }
  }
  // Unreachable: the loop either returns or throws.
  throw new ClockError('Clock request exhausted its attempts')
}

/**
 * One POST against Clock.
 *
 * The retry rule is stricter than for GET, and deliberately so: a 429 is NOT
 * retried here. We cannot tell whether the booking was created before the
 * limiter answered, and a duplicate booking in someone else's PMS costs more
 * than one that failed cleanly. Only a transport failure - where no answer
 * ever came back - is worth a second attempt.
 */
export async function clockPost<T = unknown>(
  creds: ClockCredentials,
  path: string,
  body: unknown,
  options: ClockRequestOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = options
  const { url, uri } = resolve(creds.baseUrl, path, options)

  for (let tries = 0; tries <= retries; tries++) {
    try {
      await waitForSlot(creds.apiUser)
      return await attempt<T>(creds, 'POST', url, uri, timeoutMs, body)
    } catch (error) {
      if (error instanceof ClockBannedError || error instanceof ClockForbiddenError) throw error

      const answered = error instanceof ClockError && error.status !== undefined
      if (answered || tries === retries) throw error

      await sleep((tries + 1) * 500)
    }
  }
  throw new ClockError('Clock request exhausted its attempts')
}
