'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { TableGrid } from '@/components/table-grid'
import { OrderView } from '@/components/order-view'
import { MenuManager } from '@/components/menu-manager'
import { SettingsDialog } from '@/components/settings-dialog'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import {
  getOrderByTable,
  clearOrder,
  calculateToPayTotal,
} from '@/lib/stores/order-store'
import { sendOrderToClover } from '@/lib/services/clover-service'
import { formatPrice } from '@/lib/services/menu-service'
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
import type { Order } from '@/lib/types'

export default function RestaurantPOS() {
  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [payingTable, setPayingTable] = useState<number | null>(null)
  const [confirmPayment, setConfirmPayment] = useState<{ table: number; order: Order } | null>(null)
  const [isSending, setIsSending] = useState(false)
  const { toast } = useToast()

  const handleOrder = useCallback((tableNumber: number) => {
    setSelectedTable(tableNumber)
  }, [])

  const handlePay = useCallback((tableNumber: number) => {
    const order = getOrderByTable(tableNumber)
    if (!order) {
      toast({
        title: 'Erreur',
        description: 'Aucune commande trouvee pour cette table',
        variant: 'destructive',
      })
      return
    }
    const toPay = order.itemsToPay ?? []
    if (toPay.length === 0) {
      toast({
        title: 'Rien a payer',
        description:
          'Aucune ligne en attente de paiement. Envoyez d\'abord une commande en cuisine.',
        variant: 'destructive',
      })
      return
    }
    setConfirmPayment({ table: tableNumber, order })
  }, [toast])

  const confirmSendToClover = useCallback(async () => {
    if (!confirmPayment) return

    const { table, order } = confirmPayment
    setIsSending(true)
    setPayingTable(table)

    try {
      const cloverOrder: Order = {
        ...order,
        items: order.itemsToPay ?? [],
      }
      const result = await sendOrderToClover(cloverOrder)
      
      if (result.success) {
        // Clear the order after successful payment
        clearOrder(order.id)
        
        toast({
          title: 'Paiement envoye',
          description: `Commande table ${table} envoyee a la caisse Clover`,
        })
        
        setConfirmPayment(null)
        // Force re-render to update table status
        window.location.reload()
      } else {
        toast({
          title: 'Erreur',
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'envoyer a Clover',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
      setPayingTable(null)
    }
  }, [confirmPayment, toast])

  if (selectedTable !== null) {
    return (
      <>
        <OrderView
          tableNumber={selectedTable}
          onBack={() => setSelectedTable(null)}
        />
        <Toaster />
      </>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header — tablette : plus d’air horizontal */}
      <header className="flex flex-col gap-4 border-b border-border bg-card px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6 sm:py-4 md:px-8 md:py-5">
        <div className="flex min-w-0 flex-col gap-1.5 sm:gap-2">
          <div className="inline-flex w-fit max-w-full rounded-md bg-black px-2 py-1.5 sm:px-3 sm:py-2">
            <Image
              src="/tuns-logo.png"
              alt="Tun's Café resto"
              width={390}
              height={108}
              className="h-14 w-auto max-w-[min(100%,72vw)] object-contain object-left sm:h-20 md:h-[5.25rem] lg:h-24"
              priority
            />
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm md:text-base">
            Selectionnez une table pour commencer
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-1 md:gap-3">
          <MenuManager />
          <SettingsDialog />
        </div>
      </header>

      {/* Table grid */}
      <main className="mx-auto w-full max-w-[1600px] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4 md:px-6 md:pb-6 lg:px-8">
        <TableGrid 
          onOrder={handleOrder} 
          onPay={handlePay}
          payingTable={payingTable}
        />
      </main>

      <Toaster />

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={!!confirmPayment} onOpenChange={(open) => !open && setConfirmPayment(null)}>
        <AlertDialogContent className="max-h-[min(90dvh,640px)] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le paiement</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Envoyer la commande de la table {confirmPayment?.table} a la caisse Clover ?
                </p>
                {confirmPayment?.order && (
                  <div className="mt-4 rounded-lg bg-muted p-3">
                    <p className="text-sm font-medium text-foreground">
                      {(confirmPayment.order.itemsToPay ?? []).length} ligne(s) a payer
                    </p>
                    <p className="text-lg font-bold text-primary">
                      Total: {formatPrice(calculateToPayTotal(confirmPayment.order))}
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSendToClover} disabled={isSending}>
              {isSending ? 'Envoi en cours...' : 'Confirmer et envoyer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
