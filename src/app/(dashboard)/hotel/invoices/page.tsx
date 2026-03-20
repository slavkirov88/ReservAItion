import { createClient } from '@/lib/supabase/server'
import { InvoiceTable } from '@/components/hotel/InvoiceTable'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('owner_id', user!.id).single()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('tenant_id', tenant!.id)
    .order('sent_at', { ascending: false })
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Фактури</h1>
      <InvoiceTable invoices={invoices ?? []} />
    </div>
  )
}
