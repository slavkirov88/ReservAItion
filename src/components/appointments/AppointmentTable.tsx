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
import { AppointmentStatusBadge } from './AppointmentStatusBadge'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ChevronLeft, ChevronRight, Phone, MessageSquare } from 'lucide-react'

type Appointment = {
  id: string
  patient_name: string
  patient_phone: string
  service: string
  starts_at: string
  ends_at: string
  status: string
  channel: string
  notes: string | null
}

export function AppointmentTable() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const pageSize = 20

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (fromDate) params.set('from', `${fromDate}T00:00:00`)
      if (toDate) params.set('to', `${toDate}T23:59:59`)

      const res = await fetch(`/api/appointments?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setAppointments(data.appointments || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, fromDate, toDate])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update')
      await fetchAppointments()
    } catch (err) {
      console.error(err)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const handleFilterChange = () => {
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onValueChange={(val) => { setStatusFilter(val ?? 'all'); handleFilterChange() }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Всички</SelectItem>
            <SelectItem value="confirmed">Потвърден</SelectItem>
            <SelectItem value="completed">Завършен</SelectItem>
            <SelectItem value="cancelled">Отменен</SelectItem>
            <SelectItem value="no_show">Неявил се</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); handleFilterChange() }}
          className="w-40"
          placeholder="От дата"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); handleFilterChange() }}
          className="w-40"
          placeholder="До дата"
        />
        {(statusFilter !== 'all' || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter('all'); setFromDate(''); setToDate(''); setPage(1); }}
          >
            Изчисти
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Дата / Час</TableHead>
              <TableHead className="text-muted-foreground">Пациент</TableHead>
              <TableHead className="text-muted-foreground">Услуга</TableHead>
              <TableHead className="text-muted-foreground">Канал</TableHead>
              <TableHead className="text-muted-foreground">Статус</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Зареждане...
                </TableCell>
              </TableRow>
            ) : appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Няма намерени часове
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appt) => (
                <TableRow key={appt.id} className="border-border">
                  <TableCell className="font-mono text-sm">
                    {format(new Date(appt.starts_at), 'dd MMM yyyy', { locale: bg })}
                    <br />
                    <span className="text-muted-foreground">
                      {format(new Date(appt.starts_at), 'HH:mm')}
                      {appt.ends_at && ` – ${format(new Date(appt.ends_at), 'HH:mm')}`}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{appt.patient_name}</p>
                    <p className="text-xs text-muted-foreground">{appt.patient_phone}</p>
                  </TableCell>
                  <TableCell className="text-sm">{appt.service}</TableCell>
                  <TableCell>
                    {appt.channel === 'phone' ? (
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
                    <AppointmentStatusBadge status={appt.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {appt.status !== 'cancelled' && (
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onClick={() => updateStatus(appt.id, 'cancelled')}
                          >
                            Отмени
                          </DropdownMenuItem>
                        )}
                        {appt.status !== 'no_show' && (
                          <DropdownMenuItem
                            className="text-yellow-400 focus:text-yellow-400"
                            onClick={() => updateStatus(appt.id, 'no_show')}
                          >
                            Маркирай като неявил се
                          </DropdownMenuItem>
                        )}
                        {appt.status !== 'completed' && (
                          <DropdownMenuItem
                            className="text-blue-400 focus:text-blue-400"
                            onClick={() => updateStatus(appt.id, 'completed')}
                          >
                            Маркирай като завършен
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Общо {total} записа
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
