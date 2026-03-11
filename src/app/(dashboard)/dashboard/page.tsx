import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Добре дошли в ReceptAI
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Обаждания тази седмица</p>
          <p className="text-2xl font-bold mt-1">—</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Записани часове</p>
          <p className="text-2xl font-bold mt-1">—</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Успеваемост</p>
          <p className="text-2xl font-bold mt-1">—</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Ср. продължителност</p>
          <p className="text-2xl font-bold mt-1">—</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Данните ще се появят след като получите първите обаждания.
      </p>
    </div>
  )
}
