import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Header } from '@/components/layout/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: tenant } = await supabase.from('tenants').select('business_type').eq('owner_id', user.id).single()

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar businessType={tenant?.business_type ?? 'clinic'} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
