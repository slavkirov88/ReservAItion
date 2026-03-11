'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Settings,
  CreditCard,
  Bot,
  Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calendar', label: 'Календар', icon: Calendar },
  { href: '/appointments', label: 'Часове', icon: ClipboardList },
  { href: '/settings/profile', label: 'Настройки', icon: Settings },
  { href: '/subscription', label: 'Абонамент', icon: CreditCard },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
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
    </nav>
  )
}

function SidebarContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <Bot className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">ReceptAI</span>
      </div>
      <NavLinks />
    </div>
  )
}

export function AppSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden" />
          }
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
