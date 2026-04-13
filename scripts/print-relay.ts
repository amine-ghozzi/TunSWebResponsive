/**
 * Petit serveur HTTP sur le réseau local : le navigateur (tablette / PC) envoie
 * les jobs d’impression ici ; ce processus ouvre le TCP vers l’imprimante.
 * À lancer sur un poste du même Wi‑Fi que l’imprimante :
 *   pnpm run print-relay
 * Puis dans l’app, renseignez l’URL du relais (ex. http://192.168.1.20:3910).
 */
import http from 'node:http'
import { URL } from 'node:url'
import {
  buildKitchenPrintJobBuffer,
  parseOrderForPrint,
} from '../lib/services/printer-service'
import {
  formatSocketError,
  sendEscPosToPrinter,
  testTcpPrinter,
  validatePrinterTarget,
} from '../lib/server-print'

const PORT = Number(process.env.PRINT_RELAY_PORT) || 3910
const MAX_BYTES = 512 * 1024

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

const server = http.createServer(async (req, res) => {
  const h = corsHeaders()
  for (const [k, v] of Object.entries(h)) {
    res.setHeader(k, v)
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: 'Methode non autorisee' }))
    return
  }

  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const path = url.pathname.replace(/\/$/, '') || '/'

  const body = await readJson(req)
  if (body === undefined) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: 'Corps JSON invalide' }))
    return
  }

  const b = (body || {}) as Record<string, unknown>
  const validated = validatePrinterTarget(b.ipAddress, b.port)
  if (!validated.ok) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: validated.message }))
    return
  }

  const { host, port } = validated

  try {
    if (path === '/test') {
      await testTcpPrinter(host, port)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: `Connexion reussie a ${host}:${port}`,
        })
      )
      return
    }

    if (path === '/print') {
      const order = parseOrderForPrint(b.order)
      if (!order || order.items.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message: 'Commande invalide ou vide' }))
        return
      }
      const buf = buildKitchenPrintJobBuffer(order)
      if (buf.length > MAX_BYTES) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, message: 'Ticket trop volumineux' }))
        return
      }
      await sendEscPosToPrinter(host, port, buf)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: `Ticket envoye a ${host}:${port}`,
        })
      )
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: 'Chemin inconnu (utilisez /print ou /test)' }))
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, message: formatSocketError(e) }))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(
    `[print-relay] ecoute sur 0.0.0.0:${PORT} — POST /print et POST /test (corps JSON comme /api/print)`
  )
})
