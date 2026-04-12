'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import {
  CloverConfig,
  exportInventoryFromCloverViaApi,
  getCloverSettings,
  saveCloverSettings,
  sendOrderToClover,
  testCloverConnection,
} from '@/lib/services/clover-service'
import type { Order } from '@/lib/types'

type TestState = {
  loading: boolean
  message: string
}

const INITIAL_STATE: TestState = {
  loading: false,
  message: '',
}

function buildMockOrder(tableNumber: number): Order {
  const now = new Date()
  return {
    id: `test-${Date.now()}`,
    tableNumber,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    itemsToPay: [],
    items: [
      {
        menuItem: {
          id: 'test-1',
          nom: 'Plat test',
          prix: 12.5,
          description: 'Commande de validation Clover',
        },
        quantity: 2,
        notes: 'Sans oignon',
      },
      {
        menuItem: {
          id: 'test-2',
          nom: 'Boisson test',
          prix: 3.2,
          description: 'Boisson de validation Clover',
        },
        quantity: 1,
        notes: '',
      },
    ],
  }
}

export default function CloverTestPage() {
  const [config, setConfig] = useState<CloverConfig>(() => getCloverSettings())
  const [tableNumber, setTableNumber] = useState(1)
  const [connectionState, setConnectionState] = useState<TestState>(INITIAL_STATE)
  const [orderState, setOrderState] = useState<TestState>(INITIAL_STATE)
  const [exportState, setExportState] = useState<TestState>(INITIAL_STATE)

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleConfigSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveCloverSettings(config)
    setConnectionState({ loading: false, message: 'Configuration sauvegardee localement.' })
  }

  const handleConnectionTest = async () => {
    setConnectionState({ loading: true, message: 'Test en cours...' })
    const result = await testCloverConnection()
    setConnectionState({ loading: false, message: result.message })
  }

  const handleSendMockOrder = async () => {
    setOrderState({ loading: true, message: 'Envoi de la commande de test...' })
    const result = await sendOrderToClover(buildMockOrder(tableNumber))
    setOrderState({
      loading: false,
      message: result.success ? `OK: ${result.message}${result.orderId ? ` (${result.orderId})` : ''}` : result.message,
    })
  }

  const handleExportInventory = async () => {
    setExportState({ loading: true, message: 'Export inventaire...' })
    saveCloverSettings(config)
    const result = await exportInventoryFromCloverViaApi(config)
    if (!result.success || !result.extracted || result.csv === undefined) {
      setExportState({ loading: false, message: result.message ?? 'Echec export' })
      return
    }
    triggerDownload(
      'inventory-extracted.json',
      JSON.stringify(result.extracted, null, 2),
      'application/json;charset=utf-8'
    )
    triggerDownload('inventory-items.csv', result.csv, 'text/csv;charset=utf-8')
    setExportState({
      loading: false,
      message: `Fichiers generes: ${result.extracted.counts.items} articles, ${result.extracted.counts.categories} categories (verifiez les telechargements).`,
    })
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Interface de test Clover</h1>
        <Link href="/" className="rounded border px-3 py-2 text-sm hover:bg-muted">
          Retour a l'app POS
        </Link>
      </div>

      <form onSubmit={handleConfigSubmit} className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Configuration (API REST uniquement)</h2>
        <p className="text-sm text-muted-foreground">
          Merchant ID et token API REST depuis le tableau de bord Clover (pas d&apos;OAuth).
        </p>

        <label className="block text-sm">
          Environment
          <select
            className="mt-1 w-full rounded border bg-background p-2"
            value={config.environment}
            onChange={(e) => setConfig({ ...config, environment: e.target.value as CloverConfig['environment'] })}
          >
            <option value="sandbox">sandbox</option>
            <option value="production">production</option>
          </select>
        </label>

        {config.environment === 'production' && (
          <label className="block text-sm">
            Region API production
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={config.apiRegion ?? 'na'}
              onChange={(e) =>
                setConfig({
                  ...config,
                  apiRegion: e.target.value as NonNullable<CloverConfig['apiRegion']>,
                })
              }
            >
              <option value="na">Amerique du Nord (api.clover.com)</option>
              <option value="eu">Europe (api.eu.clover.com)</option>
              <option value="la">Amerique latine (api.la.clover.com)</option>
            </select>
          </label>
        )}

        <label className="block text-sm">
          Merchant ID
          <input
            className="mt-1 w-full rounded border bg-background p-2"
            value={config.merchantId}
            onChange={(e) => setConfig({ ...config, merchantId: e.target.value })}
            placeholder="ex: ABC123..."
          />
        </label>

        <label className="block text-sm">
          Token API REST
          <input
            className="mt-1 w-full rounded border bg-background p-2"
            type="password"
            value={config.apiToken}
            onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
            placeholder="Token depuis le dashboard Clover"
          />
        </label>

        <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Sauvegarder
        </button>
      </form>

      <section className="space-y-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Connectivite</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConnectionTest}
            disabled={connectionState.loading}
            className="rounded border px-4 py-2 disabled:opacity-60"
          >
            {connectionState.loading ? 'Test...' : 'Tester la connexion API'}
          </button>
        </div>
        {connectionState.message && <p className="text-sm">{connectionState.message}</p>}
      </section>

      <section className="space-y-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Export inventaire (API Clover)</h2>
        <p className="text-sm text-muted-foreground">
          Regenere le meme contenu que inventory-extracted.json et inventory-items.csv : chaque article est place sous le nom de sa categorie Clover avec son prix.
        </p>
        <button
          type="button"
          onClick={handleExportInventory}
          disabled={exportState.loading}
          className="rounded border bg-secondary px-4 py-2 text-secondary-foreground disabled:opacity-60"
        >
          {exportState.loading ? 'Export...' : 'Telecharger JSON + CSV'}
        </button>
        {exportState.message && <p className="text-sm">{exportState.message}</p>}
      </section>

      <section className="space-y-3 rounded border p-4">
        <h2 className="text-lg font-semibold">Commande de test</h2>
        <label className="block text-sm">
          Numero de table
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded border bg-background p-2"
            value={tableNumber}
            onChange={(e) => setTableNumber(Number(e.target.value || 1))}
          />
        </label>
        <button
          type="button"
          onClick={handleSendMockOrder}
          disabled={orderState.loading}
          className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60"
        >
          {orderState.loading ? 'Envoi...' : 'Envoyer une commande factice'}
        </button>
        {orderState.message && <p className="text-sm">{orderState.message}</p>}
      </section>
    </main>
  )
}
