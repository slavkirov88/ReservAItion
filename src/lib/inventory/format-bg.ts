// ---------------------------------------------------------------------------
// What the agent says out loud about availability, for both providers.
//
// The wording for an unrestricted answer is identical to the one in
// `formatAvailabilityBg`, which the chat widget still uses. That is not
// duplication for its own sake: the phone demo runs through this file from now
// on, and a guest must not hear a different hotel than a reader sees.
//
// The part that is new is the reason. "Няма свободно" ends a call; "минималният
// престой за тези дати е две нощувки" sells one.
// ---------------------------------------------------------------------------

import type { RoomOffer } from './types'

/** Older than this and the cache is worth a caveat out loud. Refresh runs every 15-20 min. */
const STALE_AFTER_MINUTES = 60

export interface FormatOptions {
  /** Age of the cached availability in minutes. Null or absent means fresh. */
  staleMinutes?: number | null
}

/** Clock answers in BGN, our own rooms are in EUR. Neither is converted. */
function currencyLabel(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'EUR': return 'евро'
    case 'BGN': return 'лева'
    default: return currency
  }
}

const nights = (n: number) => (n === 1 ? 'нощувка' : 'нощувки')

/**
 * PMS room types are often codes. Read out letter by letter, "DBL" came out as
 * "Дебел" on the demo call. The code stays in brackets because the agent hands
 * it back to the booking tool, which matches on it.
 */
const SPOKEN_ROOM_CODES: Record<string, string> = {
  SGL: 'Единична стая',
  DBL: 'Двойна стая',
  TWN: 'Стая с две отделни легла',
  TRP: 'Тройна стая',
  FAM: 'Семейна стая',
  STD: 'Стандартна стая',
  APP: 'Апартамент',
  APT: 'Апартамент',
  SUI: 'Апартамент',
}

function roomLabel(name: string): string {
  const spoken = SPOKEN_ROOM_CODES[name.trim().toUpperCase()]
  return spoken ? `${spoken} (код ${name.trim()})` : name
}

/**
 * Turns a machine readable restriction into something a guest understands.
 *
 * Unknown codes fall back to naming the room type without inventing a reason.
 * Guessing here would put words in the hotel's mouth.
 */
function reasonBg(offer: RoomOffer): string {
  const [code, value] = (offer.restriction ?? '').split(':')

  switch (code) {
    case 'min_stay': {
      const n = Number(value)
      return Number.isFinite(n) && n > 0
        ? `${roomLabel(offer.name)}: свободно е, но минималният престой за тези дати е ${n} ${nights(n)}.`
        : `${roomLabel(offer.name)}: има минимален престой за тези дати.`
    }
    case 'closed_for_arrival':
      return `${roomLabel(offer.name)}: за тази дата хотелът не приема настанявания.`
    case 'stop_from_sale':
      return `${roomLabel(offer.name)}: продажбите за тези дати са спрени.`
    case 'sold_out':
      return `${roomLabel(offer.name)}: няма свободни стаи от този тип.`
    default:
      return `${roomLabel(offer.name)}: не е свободно за тези дати.`
  }
}

export function formatOffersBg(
  offers: RoomOffer[],
  checkIn: string,
  checkOut: string,
  options: FormatOptions = {},
): string {
  const bookable = offers.filter((o) => o.availableRooms > 0 && !o.restriction)
  const blocked = offers.filter((o) => o.restriction)

  const stale = (options.staleMinutes ?? 0) > STALE_AFTER_MINUTES
    ? '\nНаличността при мен може да не е съвсем актуална, затова рецепцията ще потвърди.'
    : ''

  if (bookable.length === 0) {
    // Kept identical to the legacy wording, en dash included, so a tenant that
    // is not on Clock hears exactly what it heard yesterday.
    const head = `За периода ${checkIn} – ${checkOut} няма свободни стаи.`
    const reasons = blocked.map(reasonBg)
    return reasons.length > 0 ? `${head}\n${reasons.join('\n')}${stale}` : `${head}${stale}`
  }

  const list = bookable
    .map((r) => {
      const capacity = r.capacity ? `, до ${r.capacity} гости` : ''
      return `${roomLabel(r.name)}: ${r.availableRooms} свободни${capacity}, ${r.pricePerNight} ${currencyLabel(r.currency)} на нощ`
    })
    .join('\n')

  const reasons = blocked.length > 0 ? `\n${blocked.map(reasonBg).join('\n')}` : ''
  return `Свободни стаи за ${checkIn} – ${checkOut}:\n${list}${reasons}${stale}`
}
