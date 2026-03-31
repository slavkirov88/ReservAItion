'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Sun,
  CalendarDays,
  BedDouble,
  Settings,
  CreditCard,
  Bot,
  Menu,
  User,
  Cpu,
  Code2,
  Plug,
  ChevronDown,
  BarChart2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/today', label: 'Днес', icon: Sun },
  { href: '/reservations', label: 'Резервации', icon: CalendarDays },
  { href: '/rooms', label: 'Стаи', icon: BedDouble },
  { href: '/analytics', label: 'Анализи', icon: BarChart2 },
  { href: '/subscription', label: 'Абонамент', icon: CreditCard },
]

const settingsItems = [
  { href: '/settings/profile', label: 'Профил', icon: User },
  { href: '/settings/ai', label: 'AI Асистент', icon: Cpu },
  { href: '/settings/widget', label: 'Chat Widget', icon: Code2 },
  { href: '/settings/integrations', label: 'Интеграции', icon: Plug },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const inSettings = pathname.startsWith('/settings')

  return (
    <nav className="flex flex-col gap-1 p-4">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            pathname === href || pathname.startsWith(href + '/')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}

      {/* Settings group */}
      <div>
        <div className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium',
          inSettings ? 'text-foreground' : 'text-muted-foreground'
        )}>
          <Settings className="h-4 w-4" />
          Настройки
          <ChevronDown className="h-3 w-3 ml-auto" />
        </div>
        <div className="ml-4 mt-1 flex flex-col gap-1">
          {settingsItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                pathname === href
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <Bot className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">ReservAItion</span>
      </div>
      <NavLinks />
    </div>
  )
}

export function AppSidebar() {
  return (
    <>
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card h-screen sticky top-0">
        <SidebarContent />
      </aside>
      <Sheet>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
