// ---------------------------------------------------------------------------
// Today's behaviour, behind the provider interface.
//
// This is a move, not a rewrite. Every tenant that exists right now runs
// through this file, so the room lookup, the row it writes and the owner email
// are carried across whole. The one deliberate change is at the end: a failed
// insert is no longer reported to the guest as a booking.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAvailableRoomTypes, type AvailableRoomType } from '@/lib/availability'
import { sendOwnerNotification } from '@/lib/email/resend'
import type { AvailabilityResult, BookingRequest, BookingResult, GuestCount, InventoryProvider, RoomOffer } from './types'

/** Our own rooms are priced in euro, in one place, so the string is not spread around. */
const OWN_CURRENCY = 'EUR'

export function toOffers(rooms: AvailableRoomType[]): RoomOffer[] {
  return rooms.map((r) => ({
    id: r.id,
    name: r.name,
    pricePerNight: r.price_per_night,
    currency: OWN_CURRENCY,
    availableRooms: r.available_rooms,
    capacity: r.capacity,
  }))
}

interface OwnDeps {
  /** Injected so the booking path is testable without Resend. */
  notify?: typeof sendOwnerNotification
}

export function makeOwnProvider(
  supabase: SupabaseClient,
  tenantId: string,
  deps: OwnDeps = {},
): InventoryProvider {
  const notify = deps.notify ?? sendOwnerNotification

  return {
    async availability(checkIn: string, checkOut: string, _guests: GuestCount): Promise<AvailabilityResult> {
      // Guest counts are not part of our own availability calculation today.
      // They are accepted here so the interface is one shape for both providers.
      void _guests
      // Our own rooms are computed on the spot, so there is nothing to be stale.
      return { offers: toOffers(await getAvailableRoomTypes(supabase, tenantId, checkIn, checkOut)), staleMinutes: null }
    },

    async createBooking(req: BookingRequest): Promise<BookingResult> {
      const totalGuests =
        req.guests.adults != null || req.guests.children != null
          ? (req.guests.adults ?? 0) + (req.guests.children ?? 0)
          : null

      const { data: roomTypeData } = req.roomTypeRef
        ? await supabase
            .from('room_types')
            .select('id')
            .eq('tenant_id', tenantId)
            .ilike('name', req.roomTypeRef)
            .single()
        : { data: null }

      const { error } = await supabase.from('reservations').insert({
        tenant_id: tenantId,
        guest_name: req.guestName,
        guest_phone: req.guestPhone,
        check_in_date: req.checkIn,
        check_out_date: req.checkOut || null,
        room_type_id: roomTypeData?.id || null,
        guests_count: totalGuests,
        adults: req.guests.adults,
        children: req.guests.children,
        children_ages: req.guests.childrenAges || null,
        guest_email: req.guestEmail || null,
        status: 'inquiry',
        channel: 'phone',
      })

      if (error) {
        // The route this replaces logged the error and said "записах
        // запитването" anyway. The guest hung up believing a room was held.
        console.error('[own.createBooking] DB error:', JSON.stringify(error))
        return {
          ok: false,
          ref: null,
          source: 'own',
          spokenResult:
            'В момента не мога да запиша заявката в системата. Моля, обадете се пак след малко или изпратете съобщение на рецепцията.',
        }
      }

      const { data: tenantData } = await supabase
        .from('tenants')
        .select('business_name, owner_id')
        .eq('id', tenantId)
        .single()

      if (tenantData?.owner_id) {
        const { data: ownerData } = await supabase.auth.admin.getUserById(tenantData.owner_id)
        const ownerEmail = ownerData?.user?.email
        if (ownerEmail) {
          await notify(ownerEmail, {
            guestName: req.guestName,
            guestPhone: req.guestPhone,
            checkInDate: req.checkIn,
            checkOutDate: req.checkOut || null,
            roomType: req.roomTypeRef || null,
            guestsCount: totalGuests,
            adults: req.guests.adults,
            children: req.guests.children,
            childrenAges: req.guests.childrenAges || null,
            channel: 'phone',
            hotelName: tenantData.business_name || 'Хотел',
          })
        }
      }

      return {
        ok: true,
        ref: null,
        source: 'own',
        spokenResult: 'Записах запитването! Рецепцията ще се свърже с Вас. Довиждане!',
      }
    },
  }
}
