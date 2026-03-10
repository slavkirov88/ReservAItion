'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { login } from './actions'

type ActionState = { error?: string } | undefined

export function LoginForm({ urlError }: { urlError?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      const result = await login(formData)
      return result ?? undefined
    },
    undefined
  )

  const errorMessage = state?.error ?? urlError

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Вход</CardTitle>
        <CardDescription>Влезте в своя акаунт</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          {errorMessage && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
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
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" disabled={pending} className="mt-1 w-full" size="lg">
            {pending ? 'Влизане…' : 'Влез'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        Нямате акаунт?&nbsp;
        <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
          Регистрирайте се
        </Link>
      </CardFooter>
    </Card>
  )
}
