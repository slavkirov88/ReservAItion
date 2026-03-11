import { WeekView } from '@/components/calendar/WeekView'

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Календар</h1>
        <p className="text-muted-foreground">Визуален преглед на записаните часове</p>
      </div>
      <WeekView />
    </div>
  )
}
