// JSONB field types
export type Service = {
  name: string
  duration_min: number
  price: number
}

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
  business_type: string
  notion_access_token: string | null
  notion_database_id: string | null
}

export type BusinessProfileRow = {
  id: string
  tenant_id: string
  services: Service[]
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

export type AppointmentRow = {
  id: string
  tenant_id: string
  patient_name: string
  patient_phone: string
  service: string
  starts_at: string
  ends_at: string
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
  appointment_id: string | null
  duration_sec: number | null
  outcome: 'booked' | 'answered' | 'failed' | 'transferred' | null
  created_at: string
}

// Insert types (what you send to create a record)
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
  business_type?: string
  notion_access_token?: string | null
  notion_database_id?: string | null
}

export type BusinessProfileInsert = {
  id?: string
  tenant_id: string
  services?: Service[]
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

export type AppointmentInsert = {
  id?: string
  tenant_id: string
  patient_name: string
  patient_phone: string
  service: string
  starts_at: string
  ends_at: string
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
  appointment_id?: string | null
  duration_sec?: number | null
  outcome?: 'booked' | 'answered' | 'failed' | 'transferred' | null
  created_at?: string
}

// Update types (all fields optional except PK)
export type TenantUpdate = Partial<Omit<TenantInsert, 'id'>>
export type BusinessProfileUpdate = Partial<Omit<BusinessProfileInsert, 'id'>>
export type ScheduleRuleUpdate = Partial<Omit<ScheduleRuleInsert, 'id'>>
export type ScheduleOverrideUpdate = Partial<Omit<ScheduleOverrideInsert, 'id'>>
export type AppointmentUpdate = Partial<Omit<AppointmentInsert, 'id'>>
export type ConversationUpdate = Partial<Omit<ConversationInsert, 'id'>>

// Helper/alias types
export type Tenant = TenantRow
export type BusinessProfile = BusinessProfileRow
export type ScheduleRule = ScheduleRuleRow
export type ScheduleOverride = ScheduleOverrideRow
export type Appointment = AppointmentRow
export type Conversation = ConversationRow

// Database type for Supabase client typing
export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: TenantRow
        Insert: TenantInsert
        Update: TenantUpdate
        Relationships: []
      }
      business_profiles: {
        Row: BusinessProfileRow
        Insert: BusinessProfileInsert
        Update: BusinessProfileUpdate
        Relationships: []
      }
      schedule_rules: {
        Row: ScheduleRuleRow
        Insert: ScheduleRuleInsert
        Update: ScheduleRuleUpdate
        Relationships: []
      }
      schedule_overrides: {
        Row: ScheduleOverrideRow
        Insert: ScheduleOverrideInsert
        Update: ScheduleOverrideUpdate
        Relationships: []
      }
      appointments: {
        Row: AppointmentRow
        Insert: AppointmentInsert
        Update: AppointmentUpdate
        Relationships: []
      }
      conversations: {
        Row: ConversationRow
        Insert: ConversationInsert
        Update: ConversationUpdate
        Relationships: []
      }
      rooms: {
        Row: RoomRow
        Insert: RoomInsert
        Update: RoomUpdate
        Relationships: []
      }
      room_reservations: {
        Row: RoomReservationRow
        Insert: RoomReservationInsert
        Update: RoomReservationUpdate
        Relationships: []
      }
      invoices: {
        Row: InvoiceRow
        Insert: InvoiceInsert
        Update: InvoiceUpdate
        Relationships: []
      }
      ical_blocks: {
        Row: IcalBlockRow
        Insert: IcalBlockInsert
        Update: Partial<Omit<IcalBlockInsert, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// ─── Hotel domain types ────────────────────────────────────────────

export type RoomRow = {
  id: string
  tenant_id: string
  name: string
  type: 'single' | 'double' | 'suite' | 'apartment'
  capacity: number
  base_price: number
  amenities: string[]
  ical_url: string | null
  ical_export_url: string | null
  created_at: string
}

export type RoomReservationRow = {
  id: string
  tenant_id: string
  room_id: string
  guest_name: string
  guest_email: string
  guest_phone: string
  check_in: string
  check_out: string
  nights: number
  total_price: number
  status: 'on_hold' | 'confirmed' | 'cancelled'
  invoice_id: string | null
  held_until: string
  source: 'voice' | 'chat' | 'manual'
  created_at: string
}

export type InvoiceRow = {
  id: string
  tenant_id: string
  guest_email: string
  guest_phone: string
  amount: number
  currency: string
  pdf_url: string | null
  stripe_payment_link: string | null
  stripe_event_id: string | null
  invoice_number: string | null
  status: 'sent' | 'paid' | 'expired'
  sent_at: string
  expires_at: string
  paid_at: string | null
}

export type IcalBlockRow = {
  id: string
  tenant_id: string
  room_id: string
  source: string
  start_date: string
  end_date: string
  summary: string | null
  synced_at: string
}

export type RoomInsert = Omit<RoomRow, 'id' | 'created_at'> & { id?: string }
export type RoomReservationInsert = Omit<RoomReservationRow, 'id' | 'nights' | 'created_at'> & { id?: string }
export type InvoiceInsert = Omit<InvoiceRow, 'id'> & { id?: string }
export type IcalBlockInsert = Omit<IcalBlockRow, 'id'> & { id?: string }

export type RoomUpdate = Partial<RoomInsert>
export type RoomReservationUpdate = Partial<Omit<RoomReservationInsert, 'tenant_id' | 'room_id'>>
export type InvoiceUpdate = Partial<Omit<InvoiceInsert, 'tenant_id'>>
