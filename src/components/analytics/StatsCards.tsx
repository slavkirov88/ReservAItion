import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BedDouble, LogIn, LogOut, Phone } from 'lucide-react'

interface Stats {
  occupancy_percent: number
  checkins_today: number
  checkouts_today: number
  total_calls_week: number
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      title: 'Заетост',
      value: `${stats.occupancy_percent}%`,
      icon: BedDouble,
      description: 'от стаите са заети',
      className: 'text-primary',
    },
    {
      title: 'Check-ins днес',
      value: stats.checkins_today,
      icon: LogIn,
      description: 'пристигащи',
      className: 'text-green-400',
    },
    {
      title: 'Check-outs днес',
      value: stats.checkouts_today,
      icon: LogOut,
      description: 'напускащи',
      className: 'text-blue-400',
    },
    {
      title: 'AI обаждания',
      value: stats.total_calls_week,
      icon: Phone,
      description: 'тази седмица',
      className: 'text-purple-400',
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
