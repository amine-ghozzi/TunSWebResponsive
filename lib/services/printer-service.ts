import type { Order } from '@/lib/types'

const PRINTER_SETTINGS_KEY = 'printer_settings'

export interface PrinterConfig {
  ipAddress: string
  port: number
}

export function getPrinterSettings(): PrinterConfig {
  if (typeof window === 'undefined') {
    return { ipAddress: '192.168.1.100', port: 9100 }
  }

  const stored = localStorage.getItem(PRINTER_SETTINGS_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return { ipAddress: '192.168.1.100', port: 9100 }
    }
  }
  return { ipAddress: '192.168.1.100', port: 9100 }
}

export function savePrinterSettings(config: PrinterConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRINTER_SETTINGS_KEY, JSON.stringify(config))
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

/** Envoie le ticket cuisine sur l'imprimante reseau (IP:port des reglages) via l'API Next.js (socket TCP). */
export async function printKitchenTicket(order: Order): Promise<{ success: boolean; message: string }> {
  const config = getPrinterSettings()

  try {
    const res = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

/** Test TCP vers l'imprimante (meme IP:port que les reglages, ou config passee). */
export async function testPrinterConnection(
  config?: PrinterConfig
): Promise<{ success: boolean; message: string }> {
  const c = config ?? getPrinterSettings()
  try {
    const res = await fetch('/api/print/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
