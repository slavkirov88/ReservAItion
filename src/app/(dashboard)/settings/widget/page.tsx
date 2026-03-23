import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function WidgetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('public_api_key')
    .eq('owner_id', user.id)
    .single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://receptai.bg'
  const embedCode = tenant
    ? `<script src="${appUrl}/widget.js" data-key="${tenant.public_api_key}" data-url="${appUrl}"></script>`
    : ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Чат Уиджет</h1>
        <p className="text-muted-foreground">Вградете AI чат асистент на вашия уебсайт</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Код за вграждане</CardTitle>
          <CardDescription>Добавете този код преди затварящия &lt;/body&gt; таг</CardDescription>
        </CardHeader>
        <CardContent>
          {tenant ? (
            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto border border-border">
              <code>{embedCode}</code>
            </pre>
          ) : (
            <p className="text-muted-foreground">Завършете регистрацията, за да получите кода.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Инструкции</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Копирайте кода по-горе</p>
          <p>2. Поставете го преди затварящия <code className="bg-muted px-1 rounded">&lt;/body&gt;</code> таг на всяка страница</p>
          <p>3. Уиджетът ще се появи като зелен бутон в долния десен ъгъл</p>
          <p>4. Посетителите могат да чатят с вашия AI рецепционист и да правят резервации</p>
        </CardContent>
      </Card>
    </div>
  )
}
