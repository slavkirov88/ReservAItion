'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { InvoiceRow } from '@/types/database'

const statusLabels: Record<string, string> = {
  sent: 'Изпратена',
  paid: 'Платена',
  expired: 'Изтекла',
}

const statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  sent: 'secondary',
  paid: 'default',
  expired: 'destructive',
}

interface InvoiceTableProps {
  invoices: InvoiceRow[]
}

export function InvoiceTable({ invoices: initialInvoices }: InvoiceTableProps) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function markPaid(id: string) {
    setLoadingId(id)
    const res = await fetch(`/api/hotel/invoices/${id}/mark-paid`, { method: 'POST' })
    if (res.ok) {
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'paid', paid_at: new Date().toISOString() } : inv))
    }
    setLoadingId(null)
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Фактура №</TableHead>
          <TableHead>Имейл</TableHead>
          <TableHead>Сума</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead>Изтича / Платена</TableHead>
          <TableHead>Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              Няма фактури.
            </TableCell>
          </TableRow>
        )}
        {invoices.map(inv => (
          <TableRow key={inv.id}>
            <TableCell className="font-mono text-sm">{inv.invoice_number ?? inv.id.slice(0, 8)}</TableCell>
            <TableCell>{inv.guest_email}</TableCell>
            <TableCell>{inv.amount} {inv.currency}</TableCell>
            <TableCell>
              <Badge variant={statusVariants[inv.status] ?? 'outline'}>
                {statusLabels[inv.status] ?? inv.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {inv.paid_at
                ? new Date(inv.paid_at).toLocaleDateString('bg-BG')
                : new Date(inv.expires_at).toLocaleDateString('bg-BG')}
            </TableCell>
            <TableCell>
              {inv.status === 'sent' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingId === inv.id}
                  onClick={() => markPaid(inv.id)}
                >
                  {loadingId === inv.id ? 'Запазване...' : 'Маркирай като платена'}
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
