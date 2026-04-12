import { NextResponse } from 'next/server'
import {
  getCloverApiBaseUrl,
  type CloverApiRegion,
} from '@/lib/services/clover-service'

type CloverProxyBody = {
  merchantId?: string
  apiToken?: string
  environment?: string
  apiRegion?: string
  path?: string
  method?: string
  body?: string | null
}

function isAllowedMerchantPath(merchantId: string, path: string): boolean {
  const prefix = `/v3/merchants/${merchantId}`
  return path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
}

export async function POST(req: Request) {
  let json: CloverProxyBody
  try {
    json = (await req.json()) as CloverProxyBody
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  }

  const merchantId = typeof json.merchantId === 'string' ? json.merchantId.trim() : ''
  const apiToken = typeof json.apiToken === 'string' ? json.apiToken.trim() : ''
  const environment = json.environment === 'production' ? 'production' : 'sandbox'
  const rawRegion = json.apiRegion
  const apiRegion: CloverApiRegion =
    rawRegion === 'eu' || rawRegion === 'la' ? rawRegion : 'na'
  const path = typeof json.path === 'string' ? json.path.trim() : ''
  const method = (typeof json.method === 'string' ? json.method : 'GET').toUpperCase()

  if (!merchantId || !apiToken || !path.startsWith('/')) {
    return NextResponse.json(
      { error: 'merchantId, apiToken et path (absolu) requis' },
      { status: 400 },
    )
  }

  if (!isAllowedMerchantPath(merchantId, path)) {
    return NextResponse.json({ error: 'Chemin API non autorise' }, { status: 403 })
  }

  if (!['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].includes(method)) {
    return NextResponse.json({ error: 'Methode HTTP non supportee' }, { status: 400 })
  }

  const baseUrl = getCloverApiBaseUrl(environment, apiRegion)
  const url = `${baseUrl}${path}`

  const upstreamHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
  }
  const hasBody = json.body != null && json.body !== '' && method !== 'GET' && method !== 'HEAD'
  if (hasBody) {
    upstreamHeaders['Content-Type'] = 'application/json'
  }

  try {
    const upstream = await fetch(url, {
      method,
      headers: upstreamHeaders,
      body: hasBody ? json.body! : undefined,
    })

    const contentType =
      upstream.headers.get('content-type') ?? 'application/octet-stream'
    const buf = await upstream.arrayBuffer()

    return new NextResponse(buf, {
      status: upstream.status,
      headers: { 'Content-Type': contentType },
    })
  } catch {
    return NextResponse.json(
      { error: 'Echec de la connexion au serveur Clover' },
      { status: 502 },
    )
  }
}
