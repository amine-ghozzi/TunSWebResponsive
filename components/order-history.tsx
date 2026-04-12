'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { History, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getTodayOrders,
  getTodayRevenue,
  calculateOrderTotal,
} from '@/lib/stores/order-store'
import { formatPrice } from '@/lib/services/menu-service'
import type { Order } from '@/lib/types'
import { cn } from '@/lib/utils'

export function OrderHistory() {
  const [open, setOpen] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [revenue, setRevenue] = useState(0)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      setOrders(getTodayOrders())
      setRevenue(getTodayRevenue())
    }
  }, [open])

  // Group orders by table
  const ordersByTable = orders.reduce<Record<number, Order[]>>((acc, order) => {
    if (!acc[order.tableNumber]) {
      acc[order.tableNumber] = []
    }
    acc[order.tableNumber].push(order)
    return acc
  }, {})

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>
      case 'sent':
        return <Badge className="bg-warning text-warning-foreground">En cuisine</Badge>
      case 'paid':
        return <Badge className="bg-success text-success-foreground">Paye</Badge>
      case 'completed':
        return <Badge className="bg-primary text-primary-foreground">Termine</Badge>
      default:
        return null
    }
  }

  const paidOrdersCount = orders.filter((o) => o.status === 'paid').length
  const pendingOrdersCount = orders.filter((o) => o.status !== 'paid').length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <History className="h-5 w-5" />
          <span className="sr-only">Historique des commandes</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historique du jour</DialogTitle>
          <DialogDescription>
            Toutes les commandes passees aujourd&apos;hui
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 rounded-lg bg-muted p-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{orders.length}</p>
            <p className="text-xs text-muted-foreground">Commandes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{paidOrdersCount}</p>
            <p className="text-xs text-muted-foreground">Payees</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{formatPrice(revenue)}</p>
            <p className="text-xs text-muted-foreground">Recettes</p>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {Object.keys(ordersByTable).length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              Aucune commande aujourd&apos;hui
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(ordersByTable)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([tableNum, tableOrders]) => (
                  <div key={tableNum} className="rounded-lg border border-border">
                    {/* Table header */}
                    <div className="flex items-center justify-between bg-card px-4 py-3">
                      <span className="font-semibold text-foreground">
                        Table {tableNum}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {tableOrders.length} commande(s)
                      </span>
                    </div>

                    {/* Orders for this table */}
                    <div className="divide-y divide-border">
                      {tableOrders.map((order) => {
                        const isExpanded = expandedOrders.has(order.id)
                        const total = calculateOrderTotal(order)
                        const historyLines = [
                          ...(order.itemsToPay ?? []),
                          ...(order.items ?? []),
                        ]

                        return (
                          <div key={order.id}>
                            <button
                              onClick={() => toggleOrder(order.id)}
                              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                            >
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {formatTime(order.createdAt)} - {historyLines.length}{' '}
                                    ligne(s)
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {order.status === 'paid' && order.paidAt
                                      ? `Paye a ${formatTime(order.paidAt)}`
                                      : `Cree a ${formatTime(order.createdAt)}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {getStatusBadge(order.status)}
                                <span className="font-semibold text-foreground">
                                  {formatPrice(total)}
                                </span>
                              </div>
                            </button>

                            {/* Order details */}
                            {isExpanded && (
                              <div className="bg-muted/30 px-4 py-3">
                                <ul className="space-y-1">
                                  {historyLines.map((item, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-foreground">
                                        {item.quantity}x {item.menuItem.nom}
                                        {item.notes && (
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            ({item.notes})
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-muted-foreground">
                                        {formatPrice(item.menuItem.prix * item.quantity)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
