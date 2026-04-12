'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import type { Menu, MenuItem, Order } from '@/lib/types'
import { initializeMenu } from '@/lib/stores/menu-store'
import {
  getOrderByTable,
  createOrder,
  addItemToOrder,
  updateItemQuantity,
  updateItemNotes,
  removeItemFromOrder,
  sendDraftToKitchen,
  clearOrder,
} from '@/lib/stores/order-store'
import { MenuPanel } from './menu-panel'
import { OrderPanel } from './order-panel'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Trash2, UtensilsCrossed, ShoppingCart } from 'lucide-react'
import { printKitchenTicket } from '@/lib/services/printer-service'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface OrderViewProps {
  tableNumber: number
  onBack: () => void
}

/** >= md (768px) : tablettes 8–10″ et plus — menu + panier côte à côte */
const SPLIT_LAYOUT_QUERY = '(min-width: 768px)'

export function OrderView({ tableNumber, onBack }: OrderViewProps) {
  const isSplitLayout = useMediaQuery(SPLIT_LAYOUT_QUERY)
  const [mobilePanel, setMobilePanel] = useState<'menu' | 'order'>('menu')
  const [menu, setMenu] = useState<Menu | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [payFocusToken, setPayFocusToken] = useState(0)
  const { toast } = useToast()

  // Load menu and order
  useEffect(() => {
    async function init() {
      const menuData = await initializeMenu()
      setMenu(menuData)

      let existingOrder = getOrderByTable(tableNumber)
      if (!existingOrder) {
        existingOrder = createOrder(tableNumber)
      }
      setOrder(existingOrder)
    }
    init()
  }, [tableNumber])

  // Refresh order from storage
  const refreshOrder = useCallback(() => {
    const updated = getOrderByTable(tableNumber)
    if (updated) {
      setOrder({ ...updated })
    }
  }, [tableNumber])

  // Add item to order
  const handleAddItem = useCallback(
    (item: MenuItem) => {
      if (!order) return
      addItemToOrder(order.id, item)
      refreshOrder()
      if (!isSplitLayout) setMobilePanel('order')
    },
    [order, refreshOrder, isSplitLayout]
  )

  // Update quantity
  const handleUpdateQuantity = useCallback(
    (itemIndex: number, quantity: number) => {
      if (!order) return
      if (quantity <= 0) {
        removeItemFromOrder(order.id, itemIndex)
      } else {
        updateItemQuantity(order.id, itemIndex, quantity)
      }
      refreshOrder()
    },
    [order, refreshOrder]
  )

  // Update notes
  const handleUpdateNotes = useCallback(
    (itemIndex: number, notes: string) => {
      if (!order) return
      updateItemNotes(order.id, itemIndex, notes)
      refreshOrder()
    },
    [order, refreshOrder]
  )

  // Remove item
  const handleRemoveItem = useCallback(
    (itemIndex: number) => {
      if (!order) return
      removeItemFromOrder(order.id, itemIndex)
      refreshOrder()
    },
    [order, refreshOrder]
  )

  // Envoi cuisine : ticket = saisie courante uniquement ; lignes passent dans « À payer »
  const handleSendToKitchen = useCallback(async () => {
    if (!order || order.items.length === 0) return

    setIsSending(true)

    const ticketOrder: Order = {
      ...order,
      items: [...order.items],
    }

    try {
      const printResult = await printKitchenTicket(ticketOrder)
      if (!printResult.success) {
        toast({
          title: 'Impression',
          description: printResult.message,
          variant: 'destructive',
        })
        return
      }

      sendDraftToKitchen(order.id)
      refreshOrder()
      setPayFocusToken((t) => t + 1)

      toast({
        title: 'La commande est envoyee en cuisine.',
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Echec de envoi de la commande',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }, [order, toast, refreshOrder])

  const handleCancelOrder = useCallback(() => {
    if (!order) return
    clearOrder(order.id)
    toast({
      title: 'Commande annulee',
      description: `Commande de la table ${tableNumber} supprimee`,
    })
    setConfirmCancel(false)
    onBack()
  }, [order, toast, tableNumber, onBack])

  if (!menu || !order) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    )
  }

  const orderItemCount =
    order.items.reduce((n, li) => n + li.quantity, 0) +
    (order.itemsToPay ?? []).reduce((n, li) => n + li.quantity, 0)

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3 md:py-3.5 md:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">
            Table {tableNumber}
          </h1>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="w-full shrink-0 gap-2 touch-manipulation sm:w-auto md:min-h-11"
          disabled={
            !order ||
            (order.items.length === 0 && (order.itemsToPay?.length ?? 0) === 0) ||
            isSending
          }
          onClick={() => setConfirmCancel(true)}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span className="truncate">Annuler commande</span>
        </Button>
      </header>

      {/* Menu + panier : colonnes ≥ lg ; onglets fixes en bas sur mobile */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden border-border md:min-h-0 md:flex-1 md:border-r',
            !isSplitLayout && mobilePanel !== 'menu' && 'hidden',
          )}
        >
          <MenuPanel menu={menu} onAddItem={handleAddItem} />
        </div>

        {/* Colonne commande : remplit la hauteur dispo ; sur tablette (md+) largeur fixe, panneau toujours ancré */}
        <div
          className={cn(
            'flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-card md:h-full md:min-h-0 md:w-72 md:max-h-full md:flex-none md:shrink-0 md:border-l md:border-border lg:w-80 xl:w-96',
            !isSplitLayout && mobilePanel !== 'order' && 'hidden',
          )}
        >
          <OrderPanel
            order={order}
            payFocusToken={payFocusToken}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateNotes={handleUpdateNotes}
            onRemoveItem={handleRemoveItem}
            onSendToKitchen={handleSendToKitchen}
            isSending={isSending}
          />
        </div>
      </div>

      {!isSplitLayout && (
        <nav
          className="flex shrink-0 gap-2 border-t border-border bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          aria-label="Navigation commande"
        >
          <Button
            type="button"
            variant={mobilePanel === 'menu' ? 'default' : 'outline'}
            className="relative flex min-h-12 flex-1 gap-2 touch-manipulation"
            onClick={() => setMobilePanel('menu')}
          >
            <UtensilsCrossed className="h-4 w-4 shrink-0" />
            Menu
          </Button>
          <Button
            type="button"
            variant={mobilePanel === 'order' ? 'default' : 'outline'}
            className="relative flex min-h-12 flex-1 gap-2 overflow-visible touch-manipulation"
            onClick={() => setMobilePanel('order')}
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            Panier
            {orderItemCount > 0 ? (
              <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums">
                {orderItemCount > 99 ? '99+' : orderItemCount}
              </span>
            ) : null}
          </Button>
        </nav>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="max-h-[min(90dvh,640px)] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la commande</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprime la commande en cours pour la table {tableNumber}. Voulez-vous continuer ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelOrder}
            >
              Annuler la commande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
