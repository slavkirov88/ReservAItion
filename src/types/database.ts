// JSONB field types
export interface Service {
  name: string
  duration_min: number
  price: number
}

export interface FAQ {
  question: string
  answer: string
}

export interface TranscriptEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface SlotOverride {
  start_time: string
  end_time: string
}

// Row types (what comes back from the database)
export interface TenantRow {
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

export interface BusinessProfileRow {
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

export interface ScheduleRuleRow {
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

export interface ScheduleOverrideRow {
  id: string
  tenant_id: string
  date: string
  override_type: 'closed' | 'custom'
  slots: SlotOverride[]
  note: string | null
  created_at: string
}

export interface AppointmentRow {
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

export interface ConversationRow {
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
export interface TenantInsert {
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

export interface BusinessProfileInsert {
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

export interface ScheduleRuleInsert {
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

export interface ScheduleOverrideInsert {
  id?: string
  tenant_id: string
  date: string
  override_type: 'closed' | 'custom'
  slots?: SlotOverride[]
  note?: string | null
  created_at?: string
}

export interface AppointmentInsert {
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

export interface ConversationInsert {
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

// Database interface for Supabase client typing
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: TenantRow
        Insert: TenantInsert
        Update: TenantUpdate
      }
      business_profiles: {
        Row: BusinessProfileRow
        Insert: BusinessProfileInsert
        Update: BusinessProfileUpdate
      }
      schedule_rules: {
        Row: ScheduleRuleRow
        Insert: ScheduleRuleInsert
        Update: ScheduleRuleUpdate
      }
      schedule_overrides: {
        Row: ScheduleOverrideRow
        Insert: ScheduleOverrideInsert
        Update: ScheduleOverrideUpdate
      }
      appointments: {
        Row: AppointmentRow
        Insert: AppointmentInsert
        Update: AppointmentUpdate
      }
      conversations: {
        Row: ConversationRow
        Insert: ConversationInsert
        Update: ConversationUpdate
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
