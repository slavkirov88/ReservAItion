// ---------------------------------------------------------------------------
// Per-tenant Clock PMS+ configuration, read from `tenants.settings`.
//
// Each hotel has its own Clock subscription, account and API user, so none of
// this can live in an environment variable. That lesson is already paid for in
// StayDesk, where an escalation job read a global chat id from the environment
// and one hotel's guest requests landed in another hotel's group. Credentials
// belong to the row, not to the deployment.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ClockCredentials } from './client'

export interface ClockTenantConfig {
  tenantId: string
  creds: ClockCredentials
  /**
   * The rates this hotel sells through the phone agent.
   *
   * Required, not decorative: rates_availability and products both demand a
   * rate list, and booking CREATE is refused without a rate_id because this
   * API user has no "Rate Availability Control Override" right.
   */
  rateIds: number[]
  /** Clock room type ids the agent may offer. Empty means "all of them". */
  roomTypeIds: number[]
  /** While true, writes are refused against anything but the sandbox host. */
  sandbox: boolean
}

interface ClockSettings {
  base_url?: string
  api_user?: string
  api_key?: string
  rate_ids?: unknown
  room_type_ids?: unknown
  sandbox?: boolean
}

/**
 * Ids from JSON, defensively.
 *
 * `Number(null)` is 0 and `Number('')` is 0, so a plain map-and-filter would
 * turn a null in the settings into rate id 0 and send it to Clock as if it
 * meant something.
 */
const numbers = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''))
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}

/** A tenant with a partial clock block is treated as not connected, not as broken. */
function toConfig(tenantId: string, settings: Record<string, unknown> | null): ClockTenantConfig | null {
  const clock = settings?.clock as ClockSettings | undefined
  if (!clock?.base_url || !clock.api_user || !clock.api_key) return null

  return {
    tenantId,
    creds: { baseUrl: clock.base_url, apiUser: clock.api_user, apiKey: clock.api_key },
    rateIds: numbers(clock.rate_ids),
    roomTypeIds: numbers(clock.room_type_ids),
    // Absent means sandbox. Going live is a decision someone writes down,
    // not something that happens because a field was forgotten.
    sandbox: clock.sandbox !== false,
  }
}

export async function loadClockConfig(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<ClockTenantConfig | null> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, settings')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !data) return null
  return toConfig(String(data.id), data.settings as Record<string, unknown> | null)
}

/** Lists every tenant wired to Clock. Used by the cache refresh endpoint. */
export async function listClockTenants(supabase: SupabaseClient): Promise<ClockTenantConfig[]> {
  const { data } = await supabase
    .from('tenants')
    .select('id, settings')
    .not('settings->clock', 'is', null)

  return (data ?? [])
    .map((row) => toConfig(String(row.id), row.settings as Record<string, unknown> | null))
    .filter((c): c is ClockTenantConfig => c !== null)
}

/**
 * Guard against writing into a hotel's real PMS from a sandbox configuration.
 *
 * A booking is not reversible from our side, and the cost of the mistake lands
 * on the hotel, not on us.
 */
export function assertWritable(config: ClockTenantConfig): void {
  if (config.sandbox && !config.creds.baseUrl.includes('sky-eu1.clock-software.com')) {
    throw new Error(
      `Tenant ${config.tenantId} is marked sandbox but its Clock base_url is not the sandbox host. ` +
        'Refusing to create a booking.',
    )
  }
  if (config.rateIds.length === 0) {
    throw new Error(
      `Tenant ${config.tenantId} has no Clock rate_ids configured. Clock refuses a booking without ` +
        'a rate_id and this API user cannot override availability.',
    )
  }
}

export { toConfig as __toConfigForTests }
