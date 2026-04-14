import Link from 'next/link'

export default function OfflinePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">Hors ligne</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Aucune connexion reseau. Verifiez le Wi-Fi ou les donnees mobiles, puis reessayez.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Retour a l&apos;accueil
      </Link>
    </div>
  )
}
