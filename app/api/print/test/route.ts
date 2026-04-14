import { NextResponse } from 'next/server'
import {
  formatSocketError,
  testTcpPrinter,
  validatePrinterTarget,
} from '@/lib/server-print'

export const runtime = 'nodejs'

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

  try {
    await testTcpPrinter(host, port)
    return NextResponse.json({
      success: true,
      message: `Connexion reussie a ${host}:${port}`,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, message: formatSocketError(e) },
      { status: 502 }
    )
  }
}
