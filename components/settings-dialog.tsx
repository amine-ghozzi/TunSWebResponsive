'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Printer, CreditCard, Check, X } from 'lucide-react'
import {
  getPrinterSettings,
  savePrinterSettings,
  testPrinterConnection,
  type PrinterConfig,
} from '@/lib/services/printer-service'
import {
  getCloverSettings,
  saveCloverSettings,
  testCloverConnection,
  type CloverConfig,
} from '@/lib/services/clover-service'

export function SettingsDialog() {
  const [open, setOpen] = useState(false)
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>({
    ipAddress: '192.168.1.100',
    port: 9100,
    localRelayBaseUrl: '',
  })
  const [cloverConfig, setCloverConfig] = useState<CloverConfig>({
    merchantId: '',
    apiToken: '',
    environment: 'sandbox',
    apiRegion: 'na',
  })
  const [printerStatus, setPrinterStatus] = useState<{
    testing: boolean
    success?: boolean
    message?: string
  }>({ testing: false })
  const [cloverStatus, setCloverStatus] = useState<{
    testing: boolean
    success?: boolean
    message?: string
  }>({ testing: false })

  // Load settings on open
  useEffect(() => {
    if (open) {
      setPrinterConfig(getPrinterSettings())
      setCloverConfig(getCloverSettings())
    }
  }, [open])

  // Save printer settings
  const handleSavePrinter = () => {
    savePrinterSettings(printerConfig)
  }

  // Save Clover settings
  const handleSaveClover = () => {
    saveCloverSettings(cloverConfig)
  }

  // Test printer connection
  const handleTestPrinter = async () => {
    setPrinterStatus({ testing: true })
    savePrinterSettings(printerConfig)
    const result = await testPrinterConnection(printerConfig)
    setPrinterStatus({
      testing: false,
      success: result.success,
      message: result.message,
    })
  }

  // Test Clover connection
  const handleTestClover = async () => {
    setCloverStatus({ testing: true })
    saveCloverSettings(cloverConfig)
    const result = await testCloverConnection()
    setCloverStatus({
      testing: false,
      success: result.success,
      message: result.message,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="touch-manipulation md:size-10">
          <Settings className="h-5 w-5 md:h-[1.35rem] md:w-[1.35rem]" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Parametres</DialogTitle>
          <DialogDescription>
            Configurez l&apos;imprimante et la connexion Clover POS
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="printer" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="printer" className="gap-2">
              <Printer className="h-4 w-4" />
              Imprimante
            </TabsTrigger>
            <TabsTrigger value="clover" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Clover POS
            </TabsTrigger>
          </TabsList>

          {/* Printer Settings */}
          <TabsContent value="printer" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="printerIp">Adresse IP</Label>
              <Input
                id="printerIp"
                placeholder="192.168.1.100"
                value={printerConfig.ipAddress}
                onChange={(e) =>
                  setPrinterConfig({ ...printerConfig, ipAddress: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="printerPort">Port</Label>
              <Input
                id="printerPort"
                type="number"
                placeholder="9100"
                value={printerConfig.port}
                onChange={(e) =>
                  setPrinterConfig({
                    ...printerConfig,
                    port: parseInt(e.target.value) || 9100,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="printerRelay">URL du relais d&apos;impression (réseau local)</Label>
              <Input
                id="printerRelay"
                placeholder="http://192.168.1.20:3910"
                value={printerConfig.localRelayBaseUrl}
                onChange={(e) =>
                  setPrinterConfig({
                    ...printerConfig,
                    localRelayBaseUrl: e.target.value.trim(),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Le navigateur envoie le ticket à cette adresse ; le relais ouvre le TCP vers
                l&apos;imprimante sur le Wi‑Fi de l&apos;appareil. Indispensable si l&apos;app est
                hébergée en ligne (ex. Vercel). Sur le poste relais :{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">pnpm run print-relay</code>
                . Laisser vide uniquement si vous utilisez l&apos;app Next sur le même LAN que
                l&apos;imprimante.
              </p>
            </div>

            {printerStatus.message && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 ${
                  printerStatus.success
                    ? 'bg-success/20 text-success-foreground'
                    : 'bg-destructive/20 text-destructive'
                }`}
              >
                {printerStatus.success ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {printerStatus.message}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSavePrinter} className="flex-1">
                Enregistrer
              </Button>
              <Button
                variant="outline"
                onClick={handleTestPrinter}
                disabled={printerStatus.testing}
              >
                {printerStatus.testing ? 'Test...' : 'Tester'}
              </Button>
            </div>
          </TabsContent>

          {/* Clover Settings */}
          <TabsContent value="clover" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="merchantId">Merchant ID</Label>
              <Input
                id="merchantId"
                placeholder="Votre Merchant ID Clover"
                value={cloverConfig.merchantId}
                onChange={(e) =>
                  setCloverConfig({ ...cloverConfig, merchantId: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiToken">Token API REST</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Token genere dans le tableau de bord Clover"
                value={cloverConfig.apiToken}
                onChange={(e) =>
                  setCloverConfig({ ...cloverConfig, apiToken: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Creez un token API dans le dashboard Clover (Developers / votre app / Tokens) — pas d&apos;OAuth dans cette app.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Environnement</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={
                    cloverConfig.environment === 'sandbox' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() =>
                    setCloverConfig({ ...cloverConfig, environment: 'sandbox' })
                  }
                >
                  Sandbox
                </Button>
                <Button
                  variant={
                    cloverConfig.environment === 'production' ? 'default' : 'outline'
                  }
                  size="sm"
                  onClick={() =>
                    setCloverConfig({ ...cloverConfig, environment: 'production' })
                  }
                >
                  Production
                </Button>
              </div>
            </div>

            {cloverConfig.environment === 'production' && (
              <div className="space-y-2">
                <Label>Region API (production)</Label>
                <p className="text-xs text-muted-foreground">
                  Europe et Amerique latine ont un hote distinct de api.clover.com (doc Clover).
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'na' as const, label: 'Amerique du Nord' },
                      { id: 'eu' as const, label: 'Europe' },
                      { id: 'la' as const, label: 'Amerique latine' },
                    ] as const
                  ).map(({ id, label }) => (
                    <Button
                      key={id}
                      type="button"
                      variant={
                        (cloverConfig.apiRegion ?? 'na') === id ? 'default' : 'outline'
                      }
                      size="sm"
                      onClick={() => setCloverConfig({ ...cloverConfig, apiRegion: id })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {cloverStatus.message && (
              <div
                className={`flex items-center gap-2 rounded-lg p-3 ${
                  cloverStatus.success
                    ? 'bg-success/20 text-success-foreground'
                    : 'bg-destructive/20 text-destructive'
                }`}
              >
                {cloverStatus.success ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                {cloverStatus.message}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSaveClover} className="flex-1">
                Enregistrer
              </Button>
              <Button
                variant="outline"
                onClick={handleTestClover}
                disabled={cloverStatus.testing}
              >
                {cloverStatus.testing ? 'Test...' : 'Tester'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
