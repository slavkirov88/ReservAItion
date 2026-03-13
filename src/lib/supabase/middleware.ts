import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isPublicApi = pathname.startsWith('/api/public') || pathname.startsWith('/api/widget') || pathname.startsWith('/api/chat') || pathname.startsWith('/api/vapi') || pathname.startsWith('/api/stripe/webhook')

  if (!user && !isAuthPage && !isPublicApi) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Subscription gate: redirect to /subscription if cancelled or trial expired
  if (user && !isPublicApi && !isAuthPage && pathname !== '/subscription' && !pathname.startsWith('/api/stripe')) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('subscription_status, trial_ends_at')
      .eq('owner_id', user.id)
      .single()

    if (tenant) {
      const isTrialExpired = tenant.subscription_status === 'trial' &&
        new Date(tenant.trial_ends_at) < new Date()
      const isCancelled = tenant.subscription_status === 'cancelled'

      if ((isTrialExpired || isCancelled) && pathname !== '/subscription') {
        return NextResponse.redirect(new URL('/subscription', request.url))
      }
    }
  }

  return supabaseResponse
}
