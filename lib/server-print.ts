/**
 * Server-only: TCP vers imprimante ESC/POS (raw socket).
 * Ne pas importer depuis des composants client.
 */
import net from 'net'

const CONNECT_AND_WRITE_MS = 15000

export function validatePrinterTarget(
  ipAddress: unknown,
  port: unknown
): { ok: true; host: string; port: number } | { ok: false; message: string } {
  if (typeof ipAddress !== 'string' || !ipAddress.trim()) {
    return { ok: false, message: 'Adresse IP manquante' }
  }
  const portNum = Number(port)
  if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
    return { ok: false, message: 'Port invalide' }
  }
  return { ok: true, host: ipAddress.trim(), port: portNum }
}

export function formatSocketError(e: unknown): string {
  if (!(e instanceof Error)) return 'Erreur inconnue'
  const code = (e as NodeJS.ErrnoException).code
  if (code === 'ECONNREFUSED') {
    return "Connexion refusee — verifiez IP, port (souvent 9100) et que l'imprimante est sous tension"
  }
  if (code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return 'Imprimante injoignable sur le reseau'
  }
  return e.message
}

/**
 * Envoie tout le job d’impression en une seule fois : `socket.end(buffer)` enchaîne
 * l’envoi des octets et la fermeture propre (FIN), ce que certaines imprimantes / port 9100
 * attendent pour traiter un lot comme un unique ticket (évite un job par ligne).
 */
export function sendEscPosToPrinter(host: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }

    const socket = net.createConnection({ host, port })
    socket.setTimeout(CONNECT_AND_WRITE_MS)

    socket.once('error', (e) => {
      socket.destroy()
      finish(e)
    })
    socket.once('timeout', () => {
      socket.destroy()
      finish(new Error('Delai depasse'))
    })

    socket.once('connect', () => {
      socket.write(data, (writeErr) => {
        if (writeErr) {
          socket.destroy()
          finish(writeErr)
          return
        }
        socket.end()
      })
    })

    socket.once('close', () => finish())
  })
}

export function testTcpPrinter(host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end(() => resolve())
    })
    socket.setTimeout(CONNECT_AND_WRITE_MS)
    socket.once('timeout', () => {
      socket.destroy()
      reject(new Error('Delai depasse'))
    })
    socket.once('error', reject)
  })
}
