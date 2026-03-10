import { RegisterForm } from './RegisterForm'

export const metadata = {
  title: 'Регистрация — ReceptAI',
}

export default function RegisterPage() {
  return (
    <main className="dark flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-2xl font-bold tracking-tight text-foreground">ReceptAI</span>
        <span className="text-sm text-muted-foreground">AI Рецепционист за вашия бизнес</span>
      </div>
      <RegisterForm />
    </main>
  )
}
