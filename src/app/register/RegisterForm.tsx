'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { register } from './actions'

type ActionState = { error?: string } | undefined

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const password = formData.get('password') as string
      const confirmPassword = formData.get('confirmPassword') as string
      if (password !== confirmPassword) {
        return { error: 'Паролите не съвпадат.' }
      }
      const result = await register(formData)
      return result ?? undefined
    },
    undefined
  )

  const [confirmPassword, setConfirmPassword] = useState('')
  const [password, setPassword] = useState('')
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Регистрация</CardTitle>
        <CardDescription>Създайте нов акаунт</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {state?.error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Имейл</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Парола</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Потвърди парола</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="new-password"
              aria-invalid={mismatch}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {mismatch && (
              <p className="text-xs text-destructive">Паролите не съвпадат.</p>
            )}
          </div>
          <Button type="submit" disabled={pending || mismatch} className="mt-1 w-full" size="lg">
            {pending ? 'Регистрация…' : 'Регистрирай се'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Вече имате акаунт?&nbsp;
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Влезте
        </Link>
      </CardFooter>
    </Card>
  )
}
