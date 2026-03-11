import { AppointmentTable } from '@/components/appointments/AppointmentTable'

export default function AppointmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Часове</h1>
        <p className="text-muted-foreground">Управлявайте всички записани часове</p>
      </div>
      <AppointmentTable />
    </div>
  )
}
