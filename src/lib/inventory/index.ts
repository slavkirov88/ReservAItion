// ---------------------------------------------------------------------------
// Which inventory this tenant sells.
//
// A tenant with a `clock` block in its settings is a hotel whose PMS owns the
// truth. Everyone else keeps today's behaviour, unchanged and untouched.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadClockConfig } from '@/lib/clock/config'
import { makeClockProvider } from './clock'
import { makeOwnProvider } from './own'
import type { InventoryProvider } from './types'

export async function getInventory(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<InventoryProvider> {
  const clock = await loadClockConfig(supabase, tenantId)
  return clock ? makeClockProvider(supabase, clock) : makeOwnProvider(supabase, tenantId)
}

export { makeClockProvider } from './clock'
export { makeOwnProvider, toOffers } from './own'
export { formatOffersBg } from './format-bg'
export type * from './types'
