'use client'

import { cn } from '@/lib/utils'
import { getTablesWithOrders, getOrderByTable, calculateOrderTotal } from '@/lib/stores/order-store'
import { formatPrice } from '@/lib/services/menu-service'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { UtensilsCrossed, CreditCard } from 'lucide-react'

interface TableGridProps {
  totalTables?: number
  onOrder: (tableNumber: number) => void
  onPay: (tableNumber: number) => void
  payingTable?: number | null
}

export function TableGrid({ totalTables = 25, onOrder, onPay, payingTable }: TableGridProps) {
  const [tablesWithOrders, setTablesWithOrders] = useState<number[]>([])
  const [tablesWithPaymentDue, setTablesWithPaymentDue] = useState<number[]>([])
  const [tableTotals, setTableTotals] = useState<Record<number, number>>({})

  useEffect(() => {
    const tables = getTablesWithOrders()
    setTablesWithOrders(tables)

    const payable: number[] = []
    const totals: Record<number, number> = {}
    tables.forEach((tableNum) => {
      const order = getOrderByTable(tableNum)
      if (order) {
        totals[tableNum] = calculateOrderTotal(order)
        if ((order.itemsToPay ?? []).length > 0) payable.push(tableNum)
      }
    })
    setTablesWithPaymentDue(payable)
    setTableTotals(totals)
  }, [])

  const tables = Array.from({ length: totalTables }, (_, i) => i + 1)

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 md:gap-3 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6">
      {tables.map((tableNumber) => {
        const hasOrder = tablesWithOrders.includes(tableNumber)
        const canPay = tablesWithPaymentDue.includes(tableNumber)
        const total = tableTotals[tableNumber] || 0
        const isPaying = payingTable === tableNumber

        return (
          <div
            key={tableNumber}
            className={cn(
              'flex min-w-0 flex-col overflow-hidden rounded-lg border-2 bg-card p-2.5 transition-all duration-200 sm:rounded-xl sm:p-4 md:p-3.5 lg:p-4',
              hasOrder
                ? 'border-warning'
                : 'border-border'
            )}
          >
            {/* Table header */}
            <div className="mb-2 flex items-center justify-between sm:mb-3">
              <span className="text-2xl font-bold text-foreground sm:text-3xl">{tableNumber}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-1 text-xs font-medium',
                  hasOrder
                    ? 'bg-warning/20 text-warning'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {hasOrder ? 'En cours' : 'Libre'}
              </span>
            </div>

            {/* Total if has order */}
            {hasOrder && (
              <div className="mb-2 text-base font-semibold text-primary sm:mb-3 sm:text-lg">
                {formatPrice(total)}
              </div>
            )}

            {/* Action buttons : colonne pour éviter le débordement dans les cellules de grille étroites */}
            <div className="mt-auto flex min-w-0 flex-col gap-1.5">
              <Button
                variant="default"
                size="sm"
                className="flex h-auto min-h-10 w-full min-w-0 shrink touch-manipulation justify-start gap-1 overflow-hidden border border-border bg-white px-2 py-2 text-neutral-900 hover:bg-neutral-100 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 sm:gap-1.5 sm:px-3 md:min-h-11 md:text-sm"
                onClick={() => onOrder(tableNumber)}
              >
                <UtensilsCrossed className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left text-xs sm:text-sm">
                  Commander
                </span>
              </Button>

              {hasOrder && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex h-auto min-h-10 w-full min-w-0 shrink touch-manipulation justify-start gap-1 overflow-hidden px-2 py-2 sm:gap-1.5 sm:px-3 md:min-h-11 md:text-sm"
                  disabled={!canPay || isPaying}
                  title={
                    canPay
                      ? undefined
                      : 'Aucune ligne a payer — envoyez une commande en cuisine'
                  }
                  onClick={() => onPay(tableNumber)}
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left text-xs sm:text-sm">
                    {isPaying ? 'Envoi...' : 'Payer'}
                  </span>
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
