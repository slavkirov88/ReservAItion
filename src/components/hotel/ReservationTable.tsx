'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { RoomReservationRow } from '@/types/database'

type ReservationWithRoom = RoomReservationRow & { rooms: { name: string; type: string } | null }

const statusLabels: Record<string, string> = {
  on_hold: 'Чакаща',
  confirmed: 'Потвърдена',
  cancelled: 'Отменена',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  on_hold: 'secondary',
  confirmed: 'default',
  cancelled: 'destructive',
}

interface ReservationTableProps {
  reservations: ReservationWithRoom[]
}

export function ReservationTable({ reservations }: ReservationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Гост</TableHead>
          <TableHead>Стая</TableHead>
          <TableHead>Настаняване</TableHead>
          <TableHead>Напускане</TableHead>
          <TableHead>Нощи</TableHead>
          <TableHead>Сума</TableHead>
          <TableHead>Статус</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reservations.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              Няма резервации.
            </TableCell>
          </TableRow>
        )}
        {reservations.map(r => (
          <TableRow key={r.id}>
            <TableCell>
              <div className="font-medium">{r.guest_name}</div>
              <div className="text-sm text-muted-foreground">{r.guest_email}</div>
            </TableCell>
            <TableCell>{r.rooms?.name ?? '—'}</TableCell>
            <TableCell>{r.check_in}</TableCell>
            <TableCell>{r.check_out}</TableCell>
            <TableCell>{r.nights}</TableCell>
            <TableCell>{r.total_price} EUR</TableCell>
            <TableCell>
              <Badge variant={statusVariants[r.status] ?? 'outline'}>
                {statusLabels[r.status] ?? r.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
