import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG = {
  confirmed: { label: 'Потвърден', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Отменен', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  no_show: { label: 'Неявил се', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  completed: { label: 'Завършен', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
} as const

type Status = keyof typeof STATUS_CONFIG

export function AppointmentStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as Status] || { label: status, className: '' }
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
