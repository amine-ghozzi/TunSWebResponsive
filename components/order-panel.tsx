'use client'

import { useState, useEffect } from 'react'
import type { Order, OrderItem } from '@/lib/types'
import { formatPrice } from '@/lib/services/menu-service'
import {
  calculateDraftTotal,
  calculateToPayTotal,
} from '@/lib/stores/order-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Minus, Plus, Trash2, Send, MessageSquare } from 'lucide-react'

type OrderPanelView = 'ordered' | 'pay'

interface OrderPanelProps {
  order: Order
  /** Incrémenté après un envoi cuisine réussi → affiche l’onglet « A payer » */
  payFocusToken?: number
  onUpdateQuantity: (itemIndex: number, quantity: number) => void
  onUpdateNotes: (itemIndex: number, notes: string) => void
  onRemoveItem: (itemIndex: number) => void
  onSendToKitchen: () => void
  isSending?: boolean
}

export function OrderPanel({
  order,
  payFocusToken = 0,
  onUpdateQuantity,
  onUpdateNotes,
  onRemoveItem,
  onSendToKitchen,
  isSending = false,
}: OrderPanelProps) {
  const draft = order.items ?? []
  const toPay = order.itemsToPay ?? []

  const [view, setView] = useState<OrderPanelView>(() => {
    if (toPay.length > 0 && draft.length === 0) return 'pay'
    return 'ordered'
  })

  useEffect(() => {
    if (payFocusToken > 0) setView('pay')
  }, [payFocusToken])

  const itemsToShow: OrderItem[] = view === 'ordered' ? draft : toPay

  const isReadOnly = view !== 'ordered'

  const viewLabel = view === 'ordered' ? 'Commandes' : 'A payer'

  const headerAmount =
    view === 'ordered' ? calculateDraftTotal(order) : calculateToPayTotal(order)

  const toPayTotal = calculateToPayTotal(order)
  const hasDraft = draft.length > 0
  const hasToPay = toPay.length > 0

  const listEmpty = itemsToShow.length === 0

  const emptyMessage =
    view === 'ordered'
      ? 'Aucun article'
      : 'Aucun montant a encaisser pour le moment.'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border bg-card p-3 sm:p-4 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground sm:text-xl md:text-xl">
              Table {order.tableNumber}
            </h2>
            <p className="text-sm text-muted-foreground md:text-[0.9375rem]">
              Commande #{order.id.slice(-6)} · Etat:{' '}
              <span className="font-medium text-foreground">
                {order.status === 'sent'
                  ? 'envoyee en cuisine'
                  : order.status === 'pending'
                    ? 'en cours'
                    : 'payee'}
              </span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground md:text-sm">{viewLabel}</p>
            <p className="text-lg font-bold text-primary md:text-xl">
              {formatPrice(headerAmount)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5 sm:gap-2 md:mt-4 md:gap-2">
          <Button
            type="button"
            size="sm"
            variant={view === 'ordered' ? 'default' : 'outline'}
            onClick={() => setView('ordered')}
            className="min-h-10 min-w-0 flex-1 touch-manipulation px-2 text-xs sm:px-3 sm:text-sm md:min-h-11 md:text-sm"
          >
            Commande
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === 'pay' ? 'default' : 'outline'}
            onClick={() => setView('pay')}
            className="min-h-10 min-w-0 flex-1 touch-manipulation px-2 text-xs sm:px-3 sm:text-sm md:min-h-11 md:text-sm"
          >
            A payer
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 md:p-3 md:px-3">
        {listEmpty ? (
          <div className="flex h-full items-center justify-center px-2 text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {itemsToShow.map((item, index) => (
              <li key={`${view}-${item.menuItem.id}-${index}`}>
                <OrderItemCard
                  item={item}
                  readOnly={isReadOnly}
                  onUpdateQuantity={(qty) => onUpdateQuantity(index, qty)}
                  onUpdateNotes={(notes) => onUpdateNotes(index, notes)}
                  onRemove={() => onRemoveItem(index)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-card p-3 shadow-[0_-6px_16px_-4px_rgba(0,0,0,0.12)] sm:p-4 md:p-4 dark:shadow-[0_-6px_20px_-4px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center justify-between text-lg md:mb-4">
          <span className="font-medium text-foreground md:text-lg">A payer</span>
          <span className="text-xl font-bold text-primary md:text-2xl">
            {formatPrice(toPayTotal)}
          </span>
        </div>
        <Button
          className="w-full touch-manipulation gap-2 md:min-h-12 md:text-base"
          size="lg"
          disabled={!hasDraft || isSending}
          onClick={onSendToKitchen}
        >
          <Send className="h-5 w-5" />
          {isSending ? 'Envoi en cours...' : 'Envoyer en Cuisine'}
        </Button>
        {hasToPay ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {toPay.length} ligne(s) en attente de paiement a l&apos;accueil
          </p>
        ) : null}
      </div>
    </div>
  )
}

interface OrderItemCardProps {
  item: OrderItem
  readOnly?: boolean
  onUpdateQuantity: (quantity: number) => void
  onUpdateNotes: (notes: string) => void
  onRemove: () => void
}

function OrderItemCard({
  item,
  readOnly = false,
  onUpdateQuantity,
  onUpdateNotes,
  onRemove,
}: OrderItemCardProps) {
  const [showNotes, setShowNotes] = useState(!!item.notes)
  const itemTotal = item.menuItem.prix * item.quantity

  return (
    <div className="rounded-lg border border-border bg-card p-3 md:p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-foreground md:text-base">{item.menuItem.nom}</h4>
          <p className="text-sm text-muted-foreground md:text-[0.9375rem]">
            {formatPrice(item.menuItem.prix)} x {item.quantity}
          </p>
        </div>
        <span className="shrink-0 font-semibold text-foreground md:text-base">
          {formatPrice(itemTotal)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 md:mt-3.5 md:gap-2.5">
        <div className="flex items-center rounded-lg border border-border">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onUpdateQuantity(item.quantity - 1)}
            className="touch-manipulation p-2.5 text-foreground hover:bg-secondary disabled:opacity-50 md:p-3"
          >
            <Minus className="h-4 w-4 md:h-5 md:w-5" />
          </button>
          <span className="min-w-10 px-1 text-center text-base font-medium text-foreground tabular-nums md:min-w-11 md:text-lg">
            {item.quantity}
          </span>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => onUpdateQuantity(item.quantity + 1)}
            className="touch-manipulation p-2.5 text-foreground hover:bg-secondary disabled:opacity-50 md:p-3"
          >
            <Plus className="h-4 w-4 md:h-5 md:w-5" />
          </button>
        </div>

        <button
          type="button"
          disabled={readOnly}
          onClick={() => setShowNotes(!showNotes)}
          className={`touch-manipulation rounded-lg p-2.5 transition-colors md:p-3 ${
            item.notes
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          } disabled:opacity-50`}
        >
          <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
        </button>

        <button
          type="button"
          disabled={readOnly}
          onClick={onRemove}
          className="touch-manipulation rounded-lg p-2.5 text-destructive hover:bg-destructive/10 disabled:opacity-50 md:p-3"
        >
          <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      </div>

      {showNotes && !readOnly && (
        <div className="mt-3">
          <Input
            placeholder="Notes speciales (ex: sans oignon, bien cuit...)"
            value={item.notes}
            onChange={(e) => onUpdateNotes(e.target.value)}
            className="text-sm"
          />
        </div>
      )}
    </div>
  )
}
