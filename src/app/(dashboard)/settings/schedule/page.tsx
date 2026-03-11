import { WorkingHoursEditor } from '@/components/schedule/WorkingHoursEditor'
import { CalendarOverrides } from '@/components/schedule/CalendarOverrides'

export default function SchedulePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Работно време</h1>
        <p className="text-muted-foreground">Настройте работния график на вашата клиника</p>
      </div>
      <WorkingHoursEditor />
      <CalendarOverrides />
    </div>
  )
}
