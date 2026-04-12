import { NextResponse } from 'next/server'
import {
  formatSocketError,
  sendEscPosToPrinter,
  validatePrinterTarget,
} from '@/lib/server-print'
import {
  buildKitchenPrintJobBuffer,
  parseOrderForPrint,
} from '@/lib/services/printer-service'

export const runtime = 'nodejs'

const MAX_BYTES = 512 * 1024

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Corps JSON invalide' },
      { status: 400 }
    )
  }

  const b = body as Record<string, unknown>
  const validated = validatePrinterTarget(b.ipAddress, b.port)
  if (!validated.ok) {
    return NextResponse.json({ success: false, message: validated.message }, { status: 400 })
  }

  const { host, port } = validated

  const order = parseOrderForPrint(b.order)
  if (!order || order.items.length === 0) {
    return NextResponse.json(
      { success: false, message: 'Commande invalide ou vide' },
      { status: 400 }
    )
  }

  /** Job complet : tout le ticket est construit en mémoire, puis un seul buffer est envoyé au TCP. */
  const buf = buildKitchenPrintJobBuffer(order)

  if (buf.length > MAX_BYTES) {
    return NextResponse.json(
      { success: false, message: 'Ticket trop volumineux' },
      { status: 400 }
    )
  }

  try {
    await sendEscPosToPrinter(host, port, buf)
    return NextResponse.json({
      success: true,
      message: `Ticket envoye a ${host}:${port}`,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, message: formatSocketError(e) },
      { status: 502 }
    )
  }
}
