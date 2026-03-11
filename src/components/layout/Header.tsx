import { logout } from '@/app/login/actions'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="md:hidden" /> {/* Space for mobile menu button in layout */}
      <div className="flex-1" />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="relative h-8 w-8 rounded-full" />
          }
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            {user?.email}
          </DropdownMenuItem>
          <form action={logout}>
            <DropdownMenuItem
              render={<button type="submit" className="w-full cursor-pointer" />}
            >
              Изход
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
