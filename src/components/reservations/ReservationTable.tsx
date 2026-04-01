'use client'
import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ChevronLeft, ChevronRight, Phone, MessageSquare } from 'lucide-react'

type Reservation = {
  id: string
  guest_name: string
  guest_phone: string
  guest_email: string | null
  check_in_date: string
  check_out_date: string | null
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending_payment'
  channel: string
  notes: string | null
  room_type_id: string | null
  room_id: string | null
  deposit_expires_at: string | null
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-500/10 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  no_show: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  pending_payment: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
}

const statusLabels: Record<string, string> = {
  confirmed: 'Потвърдена',
  cancelled: 'Отменена',
  completed: 'Завършена',
  no_show: 'Неявил се',
  pending_payment: 'Чака капаро',
}

function hoursRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'изтекло'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  return `остават ${hours}ч`
}

export function ReservationTable() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const pageSize = 20

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (fromDate) params.set('from', `${fromDate}T00:00:00`)
      if (toDate) params.set('to', `${toDate}T23:59:59`)

      const res = await fetch(`/api/reservations?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setReservations(data.reservations || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error('ReservationTable fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, fromDate, toDate])

  useEffect(() => { fetchReservations() }, [fetchReservations])

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    await fetchReservations()
  }

  const confirmDeposit = async (id: string) => {
    const res = await fetch(`/api/reservations/${id}/confirm-deposit`, { method: 'POST' })
    if (res.ok) fetchReservations()
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onValueChange={(val) => { setStatusFilter(val ?? 'all'); setPage(1) }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички</SelectItem>
            <SelectItem value="confirmed">Потвърдена</SelectItem>
            <SelectItem value="completed">Завършена</SelectItem>
            <SelectItem value="cancelled">Отменена</SelectItem>
            <SelectItem value="no_show">Неявил се</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }} className="w-40" placeholder="От дата" />
        <Input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1) }} className="w-40" placeholder="До дата" />
        {(statusFilter !== 'all' || fromDate || toDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setFromDate(''); setToDate(''); setPage(1) }}>
            Изчисти
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Check-in / Check-out</TableHead>
              <TableHead className="text-muted-foreground">Гост</TableHead>
              <TableHead className="text-muted-foreground">Стая</TableHead>
              <TableHead className="text-muted-foreground">Канал</TableHead>
              <TableHead className="text-muted-foreground">Статус</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">Зареждане...</TableCell>
              </TableRow>
            ) : reservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">Няма намерени резервации</TableCell>
              </TableRow>
            ) : reservations.map(r => (
              <TableRow key={r.id} className="border-border">
                <TableCell className="font-mono text-sm">
                  {format(new Date(r.check_in_date), 'dd MMM yyyy', { locale: bg })}
                  {r.check_out_date && (
                    <><br /><span className="text-muted-foreground">{format(new Date(r.check_out_date), 'dd MMM yyyy', { locale: bg })}</span></>
                  )}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{r.guest_name}</p>
                  <p className="text-xs text-muted-foreground">{r.guest_phone}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {r.room_id ? (
                    <span className="text-green-400 text-xs">Назначена</span>
                  ) : r.room_type_id ? (
                    <span className="text-muted-foreground text-xs">Тип заявен</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.channel === 'phone' ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 gap-1">
                      <Phone className="h-3 w-3" /> Телефон
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 gap-1">
                      <MessageSquare className="h-3 w-3" /> Чат
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className={statusColors[r.status]}>
                      {statusLabels[r.status] || r.status}
                    </Badge>
                    {r.status === 'pending_payment' && (
                      <div className="flex flex-col gap-1 mt-1">
                        {r.deposit_expires_at && (
                          <span className="text-xs text-amber-400">{hoursRemaining(r.deposit_expires_at)}</span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          onClick={() => confirmDeposit(r.id)}
                        >
                          Потвърди плащане
                        </Button>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-accent transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {r.status !== 'cancelled' && (
                        <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => updateStatus(r.id, 'cancelled')}>
                          Отмени
                        </DropdownMenuItem>
                      )}
                      {r.status !== 'completed' && (
                        <DropdownMenuItem className="text-blue-400 focus:text-blue-400" onClick={() => updateStatus(r.id, 'completed')}>
                          Маркирай като завършена
                        </DropdownMenuItem>
                      )}
                      {r.status !== 'no_show' && (
                        <DropdownMenuItem className="text-yellow-400 focus:text-yellow-400" onClick={() => updateStatus(r.id, 'no_show')}>
                          Маркирай като неявил се
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Общо {total} резервации</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
