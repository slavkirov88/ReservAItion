import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Вход — ReservAItion',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <main className="dark flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-2xl font-bold tracking-tight text-foreground">ReservAItion</span>
        <span className="text-sm text-muted-foreground">AI Рецепционист за вашия бизнес</span>
      </div>
      <LoginFormWrapper searchParams={searchParams} />
    </main>
  )
}

async function LoginFormWrapper({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const urlError =
    params.error === 'auth_callback_failed'
      ? 'Грешка при автентикация. Моля, опитайте отново.'
      : params.error

  return <LoginForm urlError={urlError} />
}
