// JSONB field types
export type FAQ = {
  question: string
  answer: string
}

export type TranscriptEntry = {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export type SlotOverride = {
  start_time: string
  end_time: string
}

// Row types (what comes back from the database)
export type TenantRow = {
  id: string
  owner_id: string
  business_name: string
  slug: string
  phone: string | null
  address: string | null
  languages: string[]
  public_api_key: string
  vapi_assistant_id: string | null
  vapi_phone_number: string | null
  subscription_status: 'trial' | 'active' | 'cancelled' | 'past_due'
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_ends_at: string
  created_at: string
  updated_at: string
}

export type BusinessProfileRow = {
  id: string
  tenant_id: string
  faqs: FAQ[]
  booking_rules: string
  welcome_message_bg: string
  welcome_message_en: string
  created_at: string
  updated_at: string
}

export type ScheduleRuleRow = {
  id: string
  tenant_id: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_min: number
  break_start: string | null
  break_end: string | null
  is_active: boolean
  created_at: string
}

export type ScheduleOverrideRow = {
  id: string
  tenant_id: string
  date: string
  override_type: 'closed' | 'custom'
  slots: SlotOverride[]
  note: string | null
  created_at: string
}

export type RoomTypeRow = {
  id: string
  tenant_id: string
  name: string
  description: string | null
  capacity: number
  price_per_night: number
  created_at: string
}

export type RoomRow = {
  id: string
  tenant_id: string
  room_type_id: string
  room_number: string | null
  name: string | null
  status: 'free' | 'occupied' | 'cleaning' | 'maintenance'
  created_at: string
}

export type ReservationRow = {
  id: string
  tenant_id: string
  guest_name: string
  guest_phone: string
  room_type_id: string | null
  room_id: string | null
  check_in_date: string
  check_out_date: string | null
  status: 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  channel: 'phone' | 'chat' | 'manual'
  notes: string | null
  created_at: string
  updated_at: string
}

export type ConversationRow = {
  id: string
  tenant_id: string
  channel: 'phone' | 'chat'
  language: string
  transcript: TranscriptEntry[]
  reservation_id: string | null
  duration_sec: number | null
  outcome: 'booked' | 'answered' | 'failed' | 'transferred' | null
  created_at: string
}

// Insert types
export type TenantInsert = {
  id?: string
  owner_id: string
  business_name: string
  slug: string
  phone?: string | null
  address?: string | null
  languages?: string[]
  public_api_key?: string
  vapi_assistant_id?: string | null
  vapi_phone_number?: string | null
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'past_due'
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  trial_ends_at?: string
  created_at?: string
  updated_at?: string
}

export type BusinessProfileInsert = {
  id?: string
  tenant_id: string
  faqs?: FAQ[]
  booking_rules?: string
  welcome_message_bg?: string
  welcome_message_en?: string
  created_at?: string
  updated_at?: string
}

export type ScheduleRuleInsert = {
  id?: string
  tenant_id: string
  day_of_week: number
  start_time: string
  end_time: string
  slot_duration_min?: number
  break_start?: string | null
  break_end?: string | null
  is_active?: boolean
  created_at?: string
}

export type ScheduleOverrideInsert = {
  id?: string
  tenant_id: string
  date: string
  override_type: 'closed' | 'custom'
  slots?: SlotOverride[]
  note?: string | null
  created_at?: string
}

export type RoomTypeInsert = {
  id?: string
  tenant_id: string
  name: string
  description?: string | null
  capacity?: number
  price_per_night: number
  created_at?: string
}

export type RoomInsert = {
  id?: string
  tenant_id: string
  room_type_id: string
  room_number?: string | null
  name?: string | null
  status?: 'free' | 'occupied' | 'cleaning' | 'maintenance'
  created_at?: string
}

export type ReservationInsert = {
  id?: string
  tenant_id: string
  guest_name: string
  guest_phone: string
  room_type_id?: string | null
  room_id?: string | null
  check_in_date: string
  check_out_date?: string | null
  status?: 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  channel: 'phone' | 'chat' | 'manual'
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type ConversationInsert = {
  id?: string
  tenant_id: string
  channel: 'phone' | 'chat'
  language?: string
  transcript?: TranscriptEntry[]
  reservation_id?: string | null
  duration_sec?: number | null
  outcome?: 'booked' | 'answered' | 'failed' | 'transferred' | null
  created_at?: string
}

// Update types
export type TenantUpdate = Partial<Omit<TenantInsert, 'id'>>
export type BusinessProfileUpdate = Partial<Omit<BusinessProfileInsert, 'id'>>
export type ScheduleRuleUpdate = Partial<Omit<ScheduleRuleInsert, 'id'>>
export type ScheduleOverrideUpdate = Partial<Omit<ScheduleOverrideInsert, 'id'>>
export type RoomTypeUpdate = Partial<Omit<RoomTypeInsert, 'id'>>
export type RoomUpdate = Partial<Omit<RoomInsert, 'id'>>
export type ReservationUpdate = Partial<Omit<ReservationInsert, 'id'>>
export type ConversationUpdate = Partial<Omit<ConversationInsert, 'id'>>

// Aliases
export type Tenant = TenantRow
export type BusinessProfile = BusinessProfileRow
export type ScheduleRule = ScheduleRuleRow
export type ScheduleOverride = ScheduleOverrideRow
export type RoomType = RoomTypeRow
export type Room = RoomRow
export type Reservation = ReservationRow
export type Conversation = ConversationRow

// Supabase Database type
export type Database = {
  public: {
    Tables: {
      tenants: { Row: TenantRow; Insert: TenantInsert; Update: TenantUpdate; Relationships: [] }
      business_profiles: { Row: BusinessProfileRow; Insert: BusinessProfileInsert; Update: BusinessProfileUpdate; Relationships: [] }
      schedule_rules: { Row: ScheduleRuleRow; Insert: ScheduleRuleInsert; Update: ScheduleRuleUpdate; Relationships: [] }
      schedule_overrides: { Row: ScheduleOverrideRow; Insert: ScheduleOverrideInsert; Update: ScheduleOverrideUpdate; Relationships: [] }
      room_types: { Row: RoomTypeRow; Insert: RoomTypeInsert; Update: RoomTypeUpdate; Relationships: [] }
      rooms: { Row: RoomRow; Insert: RoomInsert; Update: RoomUpdate; Relationships: [] }
      reservations: { Row: ReservationRow; Insert: ReservationInsert; Update: ReservationUpdate; Relationships: [] }
      conversations: { Row: ConversationRow; Insert: ConversationInsert; Update: ConversationUpdate; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
