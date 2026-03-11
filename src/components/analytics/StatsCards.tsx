import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Phone, CheckCircle, XCircle } from 'lucide-react'

interface Stats {
  total_appointments: number
  confirmed: number
  cancelled: number
  completed: number
  total_calls: number
  total_chats: number
  avg_duration_sec: number
  booked_from_calls: number
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: 'Общо часове тази седмица',
      value: stats.total_appointments,
      icon: Calendar,
      description: `${stats.confirmed} потвърдени`,
      className: 'text-primary',
    },
    {
      title: 'Телефонни обаждания',
      value: stats.total_calls,
      icon: Phone,
      description: `${stats.booked_from_calls} записани`,
      className: 'text-blue-400',
    },
    {
      title: 'Завършени часове',
      value: stats.completed,
      icon: CheckCircle,
      description: 'тази седмица',
      className: 'text-green-400',
    },
    {
      title: 'Отменени часове',
      value: stats.cancelled,
      icon: XCircle,
      description: 'тази седмица',
      className: 'text-red-400',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <Card key={card.title} className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.className}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
