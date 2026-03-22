import { ReservationTable } from '@/components/reservations/ReservationTable'

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Резервации</h1>
        <p className="text-muted-foreground">Управлявайте всички резервации</p>
      </div>
      <ReservationTable />
    </div>
  )
}
