import type { Order } from '@/lib/types'

const PRINTER_SETTINGS_KEY = 'printer_settings'

const DEFAULT_PRINTER: PrinterConfig = {
  printMode: 'system',
  ipAddress: '192.168.1.100',
  port: 9100,
  localRelayBaseUrl: '',
}

export interface PrinterConfig {
  /**
   * `system` : dialogue d’impression du navigateur / OS (aucun serveur, imprimantes locales ou réseau installées sur l’appareil).
   * `network` : envoi ESC/POS brut en TCP (IP + port, option relais ou API Next).
   */
  printMode: 'system' | 'network'
  ipAddress: string
  port: number
  /**
   * Base URL du relais HTTP (ex. http://192.168.1.20:3910), uniquement en mode `network` si besoin.
   */
  localRelayBaseUrl: string
}

function normalizePrinterConfig(raw: Partial<PrinterConfig> | null): PrinterConfig {
  const portRaw = Number(raw?.port)
  const port =
    Number.isFinite(portRaw) && portRaw >= 1 && portRaw <= 65535 ? portRaw : DEFAULT_PRINTER.port
  return {
    printMode: raw?.printMode === 'network' ? 'network' : 'system',
    ipAddress:
      typeof raw?.ipAddress === 'string' && raw.ipAddress.trim()
        ? raw.ipAddress.trim()
        : DEFAULT_PRINTER.ipAddress,
    port,
    localRelayBaseUrl:
      typeof raw?.localRelayBaseUrl === 'string' ? raw.localRelayBaseUrl.trim() : '',
  }
}

/** URLs d’impression : relais local (navigateur → LAN) ou API Next (serveur → LAN). */
export function getPrinterHttpEndpoints(): { printUrl: string; testUrl: string } {
  const envRelay =
    typeof process !== 'undefined' && typeof process.env.NEXT_PUBLIC_PRINT_RELAY_URL === 'string'
      ? process.env.NEXT_PUBLIC_PRINT_RELAY_URL.trim()
      : ''

  if (typeof window === 'undefined') {
    return { printUrl: '/api/print', testUrl: '/api/print/test' }
  }

  const stored = normalizePrinterConfig(getPrinterSettings())
  const base = (stored.localRelayBaseUrl || envRelay).replace(/\/$/, '')
  if (base) {
    return { printUrl: `${base}/print`, testUrl: `${base}/test` }
  }
  return { printUrl: '/api/print', testUrl: '/api/print/test' }
}

export function getPrinterSettings(): PrinterConfig {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PRINTER }
  }

  const stored = localStorage.getItem(PRINTER_SETTINGS_KEY)
  if (stored) {
    try {
      return normalizePrinterConfig(JSON.parse(stored) as Partial<PrinterConfig>)
    } catch {
      return { ...DEFAULT_PRINTER }
    }
  }
  return { ...DEFAULT_PRINTER }
}

export function savePrinterSettings(config: PrinterConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(normalizePrinterConfig(config)))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildKitchenTicketHtmlBody(order: Order): string {
  const lines: string[] = []
  lines.push('<h1>CUISINE</h1>')
  lines.push('<hr/>')
  lines.push(`<div class="line"><strong>TABLE ${Number(order.tableNumber)}</strong></div>`)
  lines.push('<hr/>')
  lines.push('<div class="line">ARTICLES</div>')
  lines.push('<hr/>')
  const items = order.items ?? []
  for (const item of items) {
    const nom = escapeHtml(String(item.menuItem?.nom ?? 'Article'))
    const qty = Number(item.quantity) || 1
    lines.push(`<div class="line">${qty} x ${nom}</div>`)
    const notes = (item.notes ?? '').trim()
    if (notes) {
      lines.push(`<div class="line" style="margin-left:1em">Note: ${escapeHtml(notes)}</div>`)
    }
  }
  lines.push('<hr/>')
  lines.push(`<div class="line">${escapeHtml(new Date().toLocaleString('fr-FR'))}</div>`)
  lines.push(`<div class="line">REF ${escapeHtml(order.id.slice(-8))}</div>`)
  lines.push('<hr/>')
  lines.push('<div class="line">FIN COMMANDE</div>')
  return lines.join('')
}

/**
 * Impression 100 % locale : une iframe + window.print(), aucun serveur ni socket réseau vers l’app.
 */
function runWindowPrint(htmlBody: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Impression indisponible'))
      return
    }
    const iframe = document.createElement('iframe')
    iframe.setAttribute(
      'style',
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
    )
    document.body.appendChild(iframe)
    const w = iframe.contentWindow
    const d = iframe.contentDocument
    if (!w || !d) {
      document.body.removeChild(iframe)
      reject(new Error('Impression indisponible'))
      return
    }
    const docHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
      * { box-sizing: border-box; }
      body { font-family: ui-monospace, 'Courier New', monospace; font-size: 14px; padding: 12px; max-width: 80mm; margin: 0 auto; color: #000; background: #fff; }
      h1 { font-size: 1.15em; margin: 0 0 8px; font-weight: bold; }
      .line { white-space: pre-wrap; word-break: break-word; margin: 2px 0; }
      hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
      @media print {
        @page { size: 80mm auto; margin: 4mm; }
        body { padding: 0; }
      }
    </style></head><body>${htmlBody}</body></html>`
    d.open()
    d.write(docHtml)
    d.close()
    let finished = false
    const cleanup = () => {
      if (finished) return
      finished = true
      try {
        document.body.removeChild(iframe)
      } catch {
        /* empty */
      }
      resolve()
    }
    w.addEventListener('afterprint', cleanup)
    requestAnimationFrame(() => {
      try {
        w.focus()
        w.print()
      } catch (e) {
        cleanup()
        reject(e instanceof Error ? e : new Error("Echec de l'impression"))
        return
      }
      setTimeout(() => {
        if (!finished) cleanup()
      }, 30000)
    })
  })
}

async function printKitchenTicketSystem(
  order: Order
): Promise<{ success: boolean; message: string }> {
  try {
    const body = buildKitchenTicketHtmlBody(order)
    await runWindowPrint(body, `Cuisine T${order.tableNumber}`)
    return {
      success: true,
      message:
        "Impression locale : choisissez l'imprimante dans la fenêtre du système (USB, Wi‑Fi ou Bluetooth selon votre configuration).",
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur impression'
    return { success: false, message: msg }
  }
}

async function printTestPageSystem(): Promise<{ success: boolean; message: string }> {
  try {
    const body = `<h1>TEST IMPRESSION</h1><hr/><div class="line">Si l'aperçu est correct, l'impression locale fonctionne.</div><hr/><div class="line">${escapeHtml(new Date().toLocaleString('fr-FR'))}</div>`
    await runWindowPrint(body, 'Test impression')
    return {
      success: true,
      message:
        "Fenêtre d'impression ouverte — sélectionnez votre imprimante dans la liste du système.",
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur'
    return { success: false, message: msg }
  }
}

/**
 * Texte sûr pour thermique en latin1 : pas d’UTF hors BMP problématiques, et jamais d’octet 0x1B/0x1D
 * (sinon l’imprimante croit à des commandes ESC/POS et avale la suite du ticket).
 */
function sanitizeTicketText(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i)!
    i += cp > 0xffff ? 2 : 1
    if (cp === 0x0a) {
      out += '\n'
      continue
    }
    if (cp === 0x0d) continue
    const low = cp & 0xff
    if (low === 0x1b || low === 0x1d || low === 0x1c) continue
    if (cp < 0x20 && cp !== 0x09) continue
    if (cp === 0x7f) continue
    if (cp <= 0xff) out += String.fromCodePoint(cp)
    else out += '?'
  }
  return out.replace(/[\f\v\x0C]/g, ' ')
}

/**
 * Noms / notes cuisine : ASCII imprimable seulement (0x20-0x7E + LF).
 * Même en latin1, les octets >0x7F (accents) font souvent planter le reste du ticket sur thermiques "ASCII".
 */
function kitchenTextToAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les accents
    .replace(/[^\x20-\x7E]/g, "");    // Garde uniquement les caractères ASCII imprimables
}

/** Date/heure : chiffres et espaces uniquement (pas de / ni : qui peuvent perturber certains firmwares). */
function formatTicketDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd} ${hh}${min}`
}

/** Contrôle corps JSON → ticket serveur (souple : n’abandonne pas toute la commande si un champ manque). */
export function parseOrderForPrint(body: unknown): Order | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  const tableNumber =
    typeof o.tableNumber === 'number'
      ? o.tableNumber
      : Number(o.tableNumber)
  if (typeof o.id !== 'string' || !Number.isFinite(tableNumber)) return null
  if (!Array.isArray(o.items)) return null
  const items: Order['items'] = []
  for (const raw of o.items) {
    if (!raw || typeof raw !== 'object') continue
    const it = raw as Record<string, unknown>
    const mi = it.menuItem
    if (!mi || typeof mi !== 'object') continue
    const m = mi as Record<string, unknown>
    const nom = typeof m.nom === 'string' ? m.nom : 'Article'
    const qtyRaw = Number(it.quantity ?? 1)
    const quantity =
      Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.min(999, Math.floor(qtyRaw)) : 1
    const prixRaw = Number(m.prix)
    const prix = Number.isFinite(prixRaw) && prixRaw >= 0 ? prixRaw : 0
    const notes = typeof it.notes === 'string' ? it.notes : ''
    items.push({
      menuItem: {
        id: typeof m.id === 'string' ? m.id : '',
        nom,
        prix,
        description: typeof m.description === 'string' ? m.description : '',
        imageUrl: typeof m.imageUrl === 'string' ? m.imageUrl : undefined,
        cloverFetchImage: m.cloverFetchImage === true,
      },
      quantity,
      notes,
    })
  }
  if (items.length === 0) return null
  return {
    id: o.id,
    tableNumber,
    items,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/** Une ligne texte : octets ASCII 0x20-0x7E + LF 0x0A (pas de chaîne Unicode). */
export function pushAsciiLine(chunks: Buffer[], text: string) {
  // On s'assure que le texte est en ASCII et on ajoute CR+LF
  chunks.push(Buffer.from(text + '\r\n', 'ascii'));
}

export function pushLf(chunks: Buffer[]) {
  chunks.push(Buffer.from([0x0D, 0x0A]));
}

/**
 * Ticket cuisine : buffers concaténés (commandes ESC/POS en octets constants, texte en ASCII strict).
 * Alignement gauche ESC a 0, pas de lignes de séparation répétitives (moins de risque de faux positifs firmware).
 */
export function generateKitchenTicket(order: Order): string {
  return buildKitchenPrintJobBuffer(order).toString('latin1')
}

export function buildKitchenPrintJobBuffer(order: any): Buffer {
  const chunks: Buffer[] = [];

  // 1. Initialisation de l'imprimante (Reset)
  chunks.push(Buffer.from([0x1b, 0x40]));
  
  // 2. Alignement à gauche (0x00 = Left, 0x01 = Center, 0x02 = Right)
  chunks.push(Buffer.from([0x1b, 0x61, 0x00]));

  // --- ENTÊTE ---
  pushAsciiLine(chunks, 'CUISINE');
  pushAsciiLine(chunks, '================================');
  pushAsciiLine(chunks, `TABLE ${Number(order.tableNumber)}`);
  pushAsciiLine(chunks, '================================');
  pushLf(chunks);

  // --- ARTICLES ---
  pushAsciiLine(chunks, 'ARTICLES');
  pushAsciiLine(chunks, '================================');
  pushLf(chunks);

  const items = order.items ?? [];
  for (const item of items) {
    const rawNom = item.menuItem?.nom;
    const nomBase = typeof rawNom === 'string' ? rawNom : rawNom != null ? String(rawNom) : 'Article';
    const nom = kitchenTextToAscii(nomBase).trim().replace(/\n+/g, ' ') || 'ITEM';
    
    const qtyRaw = Number(item.quantity);
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.floor(qtyRaw) : 1;
    
    // Impression de la ligne d'article
    pushAsciiLine(chunks, `${qty} x ${nom}`);

    // Impression des notes si présentes
    const noteText = kitchenTextToAscii((item.notes ?? '').trim()).replace(/\n+/g, ' ');
    if (noteText) {
      pushAsciiLine(chunks, `  NOTE: ${noteText}`);
    }
  }

  // --- PIED DE PAGE ---
  pushLf(chunks);
  // formatTicketDateTime doit retourner une string (ex: "2026-04-09 10:30")
  pushAsciiLine(chunks, new Date().toLocaleString()); 
  pushAsciiLine(chunks, '================================');
  pushAsciiLine(chunks, `REF ${kitchenTextToAscii(order.id.slice(-8))}`);
  pushAsciiLine(chunks, '================================');
  pushAsciiLine(chunks, 'FIN COMMANDE');
  pushAsciiLine(chunks, '================================');

  // --- SORTIE DU PAPIER ---
  // On avance le papier de quelques lignes pour que le texte soit visible
  pushLf(chunks);
  pushLf(chunks);
  pushLf(chunks);
  pushLf(chunks);

  // --- COUPE DU PAPIER (Paper Cut) ---
  // 0x1d 0x56 0x42 0x00 est une commande de coupe partielle standard
  chunks.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));

  return Buffer.concat(chunks);
}

/** Ticket cuisine : par défaut impression système locale (`window.print`) ; option ESC/POS réseau. */
export async function printKitchenTicket(order: Order): Promise<{ success: boolean; message: string }> {
  const config = getPrinterSettings()
  if (config.printMode === 'system') {
    return printKitchenTicketSystem(order)
  }

  const { printUrl } = getPrinterHttpEndpoints()
  const envRelay =
    typeof process !== 'undefined' && typeof process.env.NEXT_PUBLIC_PRINT_RELAY_URL === 'string'
      ? process.env.NEXT_PUBLIC_PRINT_RELAY_URL.trim()
      : ''

  if (
    typeof window !== 'undefined' &&
    !config.localRelayBaseUrl &&
    !envRelay &&
    (window.location.hostname.endsWith('.vercel.app') ||
      window.location.hostname === 'vercel.app')
  ) {
    return {
      success: false,
      message:
        "Mode réseau ESC/POS : depuis l'app en ligne, configurez l'URL du relais (même Wi‑Fi que l'imprimante) ou repassez en impression locale (paramètres).",
    }
  }

  try {
    const res = await fetch(printUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: printUrl.startsWith('http') ? 'cors' : 'same-origin',
      body: JSON.stringify({
        ipAddress: config.ipAddress,
        port: config.port,
        order: {
          id: order.id,
          tableNumber: order.tableNumber,
          items: order.items.map((i) => ({
            quantity: i.quantity,
            notes: i.notes,
            menuItem: {
              id: i.menuItem.id,
              nom: i.menuItem.nom,
              prix: i.menuItem.prix,
              description: i.menuItem.description,
              imageUrl: i.menuItem.imageUrl,
              cloverFetchImage: i.menuItem.cloverFetchImage,
            },
          })),
        },
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      message?: string
    }
    if (!res.ok) {
      return {
        success: false,
        message:
          typeof data.message === 'string' ? data.message : `Erreur HTTP ${res.status}`,
      }
    }
    if (data.success === false) {
      return { success: false, message: data.message || "Echec de l'impression" }
    }
    return {
      success: true,
      message:
        typeof data.message === 'string'
          ? data.message
          : `Ticket envoye a ${config.ipAddress}:${config.port}`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur reseau'
    return { success: false, message: msg }
  }
}

/** Test : dialogue d'impression en mode système ; TCP en mode réseau. */
export async function testPrinterConnection(
  config?: PrinterConfig
): Promise<{ success: boolean; message: string }> {
  const c = normalizePrinterConfig(config ?? getPrinterSettings())
  if (c.printMode === 'system') {
    return printTestPageSystem()
  }

  const { testUrl } = getPrinterHttpEndpoints()

  const envRelay =
    typeof process !== 'undefined' && typeof process.env.NEXT_PUBLIC_PRINT_RELAY_URL === 'string'
      ? process.env.NEXT_PUBLIC_PRINT_RELAY_URL.trim()
      : ''

  if (
    typeof window !== 'undefined' &&
    !c.localRelayBaseUrl &&
    !envRelay &&
    (window.location.hostname.endsWith('.vercel.app') ||
      window.location.hostname === 'vercel.app')
  ) {
    return {
      success: false,
      message:
        "Mode réseau : depuis l'app en ligne, indiquez l'URL du relais (pnpm run print-relay sur un poste du même Wi‑Fi) ou utilisez l'impression locale.",
    }
  }

  try {
    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: testUrl.startsWith('http') ? 'cors' : 'same-origin',
      body: JSON.stringify({
        ipAddress: c.ipAddress,
        port: c.port,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean
      message?: string
    }
    if (!res.ok) {
      return {
        success: false,
        message:
          typeof data.message === 'string' ? data.message : `Erreur HTTP ${res.status}`,
      }
    }
    return {
      success: !!data.success,
      message:
        typeof data.message === 'string'
          ? data.message
          : data.success
            ? 'OK'
            : 'Echec',
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur reseau'
    return { success: false, message: msg }
  }
}
