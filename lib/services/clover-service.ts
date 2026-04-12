import type { Menu, MenuCategory, MenuItem, Order } from '@/lib/types'

const CLOVER_SETTINGS_KEY = 'clover_settings'

/** Région de l’hôte API en production (doc Clover : NA / Europe / Amérique latine). */
export type CloverApiRegion = 'na' | 'eu' | 'la'

/** Connexion Clover via API REST uniquement (token depuis le tableau de bord Clover). */
export interface CloverConfig {
  merchantId: string
  apiToken: string
  environment: 'sandbox' | 'production'
  /** Utilisé seulement si environment === 'production' */
  apiRegion?: CloverApiRegion
}

const DEFAULT_CONFIG: CloverConfig = {
  merchantId: '',
  apiToken: '',
  environment: 'sandbox',
  apiRegion: 'na',
}

function parseStoredConfig(raw: string): Partial<CloverConfig> {
  try {
    const p = JSON.parse(raw) as Record<string, unknown>
    const r = p.apiRegion
    const apiRegion: CloverApiRegion | undefined =
      r === 'eu' || r === 'la' || r === 'na' ? r : undefined
    return {
      merchantId: typeof p.merchantId === 'string' ? p.merchantId : undefined,
      apiToken: typeof p.apiToken === 'string' ? p.apiToken : undefined,
      environment: p.environment === 'production' ? 'production' : p.environment === 'sandbox' ? 'sandbox' : undefined,
      apiRegion,
    }
  } catch {
    return {}
  }
}

export function getCloverSettings(): CloverConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_CONFIG
  }

  const stored = localStorage.getItem(CLOVER_SETTINGS_KEY)
  if (stored) {
    const parsed = parseStoredConfig(stored)
    return { ...DEFAULT_CONFIG, ...parsed }
  }
  return DEFAULT_CONFIG
}

export function saveCloverSettings(config: CloverConfig): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CLOVER_SETTINGS_KEY, JSON.stringify(config))
}

/**
 * URL de base REST officielle (doc Clover : sandbox = apisandbox).
 * Production : hôte selon la région du commerçant (NA / EU / LATAM).
 */
export function getCloverApiBaseUrl(
  environment: 'sandbox' | 'production',
  region: CloverApiRegion = 'na',
): string {
  if (environment === 'sandbox') {
    return 'https://apisandbox.dev.clover.com'
  }
  switch (region) {
    case 'eu':
      return 'https://api.eu.clover.com'
    case 'la':
      return 'https://api.la.clover.com'
    default:
      return 'https://api.clover.com'
  }
}

export function getCloverApiRegion(config: CloverConfig): CloverApiRegion {
  const r = config.apiRegion
  return r === 'eu' || r === 'la' || r === 'na' ? r : 'na'
}

/** Appels Clover : côté navigateur via proxy Next (CORS), côté Node en direct. */
async function cloverApiRequest(
  config: CloverConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = init?.body

  if (typeof window !== 'undefined') {
    const payload: Record<string, unknown> = {
      merchantId: config.merchantId,
      apiToken: config.apiToken,
      environment: config.environment,
      apiRegion: getCloverApiRegion(config),
      path: normalizedPath,
      method,
    }
    if (body != null && method !== 'GET' && method !== 'HEAD') {
      payload.body = typeof body === 'string' ? body : String(body)
    }
    return fetch('/api/clover/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  const baseUrl = getCloverApiBaseUrl(config.environment, getCloverApiRegion(config))
  const url = `${baseUrl}${normalizedPath}`
  const headers = new Headers(init?.headers as HeadersInit | undefined)
  headers.set('Authorization', `Bearer ${config.apiToken}`)
  if (body != null && method !== 'GET' && method !== 'HEAD' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  })
}

function formatOrderDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseElements<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (
    payload &&
    typeof payload === 'object' &&
    'elements' in payload &&
    Array.isArray((payload as { elements?: unknown[] }).elements)
  ) {
    return (payload as { elements: T[] }).elements
  }
  return []
}

function sanitizeText(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase()
}

/** Prix article Clover v3 : en centimes (nombre ou chaîne). */
function parseItemPriceCents(raw: unknown): number {
  if (typeof raw === 'number' && !Number.isNaN(raw)) return Math.max(0, raw)
  if (typeof raw === 'string') {
    const n = parseFloat(raw.replace(',', '.'))
    if (!Number.isNaN(n)) return Math.max(0, Math.round(n))
  }
  return 0
}

function isItemHidden(rawItem: Record<string, unknown>): boolean {
  return rawItem.hidden === true || rawItem.deleted === true
}

/** Résout une URL affichable depuis expand=images / image / images.elements. */
function extractCloverItemImage(
  raw: Record<string, unknown>,
  baseUrl: string
): Pick<MenuItem, 'imageUrl' | 'cloverFetchImage'> {
  const out: Pick<MenuItem, 'imageUrl' | 'cloverFetchImage'> = {}

  const tryUrl = (u: unknown): boolean => {
    if (typeof u !== 'string' || !u.trim()) return false
    const s = u.trim()
    if (s.startsWith('http://') || s.startsWith('https://')) {
      out.imageUrl = s
      return true
    }
    if (s.startsWith('/')) {
      out.imageUrl = baseUrl + s
      return true
    }
    return false
  }

  for (const el of parseElements<Record<string, unknown>>(raw.images as unknown)) {
    if (tryUrl(el.url) || tryUrl(el.href)) {
      return out
    }
    const nested = el.image
    if (nested && typeof nested === 'object') {
      const o = nested as Record<string, unknown>
      if (tryUrl(o.url) || tryUrl(o.href)) return out
    }
  }

  const image = raw.image
  if (typeof image === 'string' && image.trim()) {
    out.cloverFetchImage = true
  } else if (image && typeof image === 'object') {
    const o = image as Record<string, unknown>
    if (tryUrl(o.url) || tryUrl(o.href)) {
      return out
    }
    if (sanitizeText(String(o.id ?? ''), '') || o.href) {
      out.cloverFetchImage = true
    }
  }

  for (const k of ['imageUrl', 'photoUrl', 'thumbnailUrl', 'pictureUrl']) {
    if (tryUrl(raw[k])) return out
  }

  if (sanitizeText(raw.defaultImageId, '')) {
    out.cloverFetchImage = true
  }

  if (out.imageUrl) {
    delete out.cloverFetchImage
  }

  return out
}

/**
 * Télécharge la photo binaire Clover (GET .../items/{itemId}/image) et retourne une blob: URL.
 * À révoquer avec URL.revokeObjectURL quand l’affichage est terminé.
 */
export async function fetchCloverItemImageBlobUrl(
  config: CloverConfig,
  cloverItemId: string
): Promise<string | undefined> {
  if (!config.merchantId || !config.apiToken || !cloverItemId) return undefined
  const path = `/v3/merchants/${config.merchantId}/items/${cloverItemId}/image`
  try {
    const res = await cloverApiRequest(config, path, { method: 'GET' })
    if (!res.ok) return undefined
    const blob = await res.blob()
    if (!blob.size) return undefined
    return URL.createObjectURL(blob)
  } catch {
    return undefined
  }
}

// Create order in Clover
export async function sendOrderToClover(order: Order): Promise<{ success: boolean; message: string; orderId?: string }> {
  const config = getCloverSettings()

  // Check if Clover is configured
  if (!config.merchantId || !config.apiToken) {
    console.log('[v0] Clover not configured, skipping')
    return {
      success: true,
      message: 'Clover non configure - commande enregistree localement',
    }
  }

  const orderPrefix = `Table ${order.tableNumber} ${formatOrderDateTime(new Date())}`

  try {
    // Step 1: Create the order
    const orderResponse = await cloverApiRequest(
      config,
      `/v3/merchants/${config.merchantId}/orders`,
      {
        method: 'POST',
        body: JSON.stringify({
          state: 'open',
          title: `${orderPrefix} - ${order.id.slice(-6)}`,
          note: `${orderPrefix} / commande locale ${order.id}`,
        }),
      },
    )

    if (!orderResponse.ok) {
      const error = await orderResponse.text()
      console.error('[v0] Clover order creation failed:', error)
      const hint = error.replace(/\s+/g, ' ').trim().slice(0, 160)
      return {
        success: false,
        message: hint
          ? `Erreur Clover (${orderResponse.status}): ${hint}`
          : `Erreur Clover: ${orderResponse.status}`,
      }
    }

    const cloverOrder = await orderResponse.json()
    const cloverOrderId = cloverOrder.id

    // Step 2: Lignes custom : Clover attend unitQty (pas quantity) ; prix total de la ligne en centimes.
    for (const item of order.items) {
      const qty = Math.max(1, Math.floor(item.quantity))
      const lineTotalCents = Math.round(item.menuItem.prix * qty * 100)
      const lineItemResponse = await cloverApiRequest(
        config,
        `/v3/merchants/${config.merchantId}/orders/${cloverOrderId}/line_items`,
        {
          method: 'POST',
          body: JSON.stringify({
            name:
              qty > 1
                ? `${item.menuItem.nom} (x${qty})`
                : item.menuItem.nom,
            price: lineTotalCents,
            unitQty: 1,
            ...(item.notes?.trim() ? { note: item.notes.trim() } : {}),
          }),
        },
      )

      if (!lineItemResponse.ok) {
        console.error('[v0] Clover line item failed:', await lineItemResponse.text())
      }
    }

    console.log('[v0] Clover order created:', cloverOrderId)

    return {
      success: true,
      message: 'Commande envoyee a Clover',
      orderId: cloverOrderId,
    }
  } catch (error) {
    console.error('[v0] Clover API error:', error)
    return {
      success: false,
      message: 'Erreur de connexion a Clover',
    }
  }
}

/** Menu + inventaire alignés sur les catégories Clover (nom, ID) et prix des articles. */
export async function loadMenuFromCloverConfig(
  config: CloverConfig
): Promise<{ success: boolean; menu?: Menu; message?: string }> {
  if (!config.merchantId || !config.apiToken) {
    return { success: false, message: 'Configuration Clover incomplete' }
  }

  const baseUrl = getCloverApiBaseUrl(config.environment, getCloverApiRegion(config))

  try {
    const categoriesPath = `/v3/merchants/${config.merchantId}/categories?limit=1000&expand=items`
    const itemsPath = `/v3/merchants/${config.merchantId}/items?limit=1000&expand=categories`

    const [categoriesResponse, itemsResponse] = await Promise.all([
      cloverApiRequest(config, categoriesPath, { method: 'GET' }),
      cloverApiRequest(config, itemsPath, { method: 'GET' }),
    ])

    if (!categoriesResponse.ok || !itemsResponse.ok) {
      return {
        success: false,
        message: `Erreur Clover categories/items (${categoriesResponse.status}/${itemsResponse.status})`,
      }
    }

    const categoriesPayload = await categoriesResponse.json()
    const itemsPayload = await itemsResponse.json()

    const cloverCategories = parseElements<Record<string, unknown>>(categoriesPayload)
    const cloverItems = parseElements<Record<string, unknown>>(itemsPayload)

    /** Détail complet par ID article (endpoint items + expand=categories). */
    const itemsByCloverId = new Map<string, Record<string, unknown>>()
    for (const raw of cloverItems) {
      const iid = sanitizeText(raw.id, '')
      if (iid) itemsByCloverId.set(iid, raw)
    }

    function mergeItemRow(
      fromCategoryExpand: Record<string, unknown>
    ): Record<string, unknown> {
      const iid = sanitizeText(fromCategoryExpand.id, '')
      const full = iid ? itemsByCloverId.get(iid) : undefined
      if (!full) return fromCategoryExpand
      return { ...fromCategoryExpand, ...full }
    }

    function rawToMenuItem(raw: Record<string, unknown>): MenuItem | null {
      const itemId = sanitizeText(raw.id, '')
      if (!itemId || isItemHidden(raw)) return null
      const name = sanitizeText(raw.name, 'Article')
      const description = sanitizeText(raw.description, '')
      const priceCents = parseItemPriceCents(raw.price)
      const img = extractCloverItemImage(raw, baseUrl)
      return {
        id: `clover-item-${itemId}`,
        nom: name,
        description,
        prix: priceCents / 100,
        ...img,
      }
    }

    /** Index par nom normalisé (comme dans l’écran Clover : ex. « salade »). */
    const categoriesByName = new Map<string, MenuCategory>()
    /** Index par ID Clover : les items renvoient souvent seulement { id } sans name. */
    const categoriesByCloverId = new Map<string, MenuCategory>()
    const orderedCategories: MenuCategory[] = []

    for (const cat of cloverCategories) {
      const catId = sanitizeText(cat.id, '')
      const catName = sanitizeText(cat.name, 'Categorie')
      if (!catId) continue
      const category: MenuCategory = {
        id: `clover-cat-${catId}`,
        nom: catName,
        items: [],
      }
      categoriesByCloverId.set(catId, category)
      categoriesByName.set(normalizeCategoryName(catName), category)
      orderedCategories.push(category)
    }

    const uncategorized: MenuCategory = {
      id: 'clover-cat-uncategorized',
      nom: 'Sans categorie',
      items: [],
    }

    const placedItemIds = new Set<string>()

    // 1) Catégories avec expand=items : rattachement principal (comme dans l’admin Clover)
    for (const cat of cloverCategories) {
      const catId = sanitizeText(cat.id, '')
      if (!catId || !categoriesByCloverId.has(catId)) continue
      const target = categoriesByCloverId.get(catId)!
      const expanded = parseElements<Record<string, unknown>>(cat.items as unknown)
      for (const rawExpanded of expanded) {
        const merged = mergeItemRow(rawExpanded)
        const menuItem = rawToMenuItem(merged)
        if (!menuItem) continue
        const iid = sanitizeText(merged.id, '')
        if (placedItemIds.has(iid)) continue
        target.items.push(menuItem)
        placedItemIds.add(iid)
      }
    }

    function resolveCategoryForItem(
      relatedCategories: Record<string, unknown>[]
    ): MenuCategory {
      const first = relatedCategories[0]
      if (!first) return uncategorized

      const refId = sanitizeText(first.id, '')
      if (refId && categoriesByCloverId.has(refId)) {
        return categoriesByCloverId.get(refId)!
      }

      const refName = sanitizeText(first.name, '')
      if (refName) {
        const byName = categoriesByName.get(normalizeCategoryName(refName))
        if (byName) return byName
      }

      return uncategorized
    }

    // 2) Items avec expand=categories : articles absents du expand items (ou non classés)
    for (const rawItem of cloverItems) {
      const itemId = sanitizeText(rawItem.id, '')
      if (!itemId || placedItemIds.has(itemId)) continue
      const menuItem = rawToMenuItem(rawItem)
      if (!menuItem) continue

      const categoriesField = rawItem.categories as unknown
      const relatedCategories = parseElements<Record<string, unknown>>(categoriesField)
      const targetCategory = resolveCategoryForItem(relatedCategories)
      targetCategory.items.push(menuItem)
      placedItemIds.add(itemId)
    }

    const finalCategories = [...orderedCategories]
    if (uncategorized.items.length > 0) {
      finalCategories.push(uncategorized)
    }

    return { success: true, menu: { categories: finalCategories } }
  } catch (error) {
    console.error('[v0] Clover menu load error:', error)
    return { success: false, message: 'Impossible de charger le menu Clover' }
  }
}

export async function loadMenuFromClover(): Promise<{ success: boolean; menu?: Menu; message?: string }> {
  return loadMenuFromCloverConfig(getCloverSettings())
}

export interface InventoryExtractedPayload {
  categories: { id: string; nom: string }[]
  items: { nom: string; prix: number; categorie: string }[]
  counts: { categories: number; items: number }
}

function cloverCategoryIdFromMenuId(menuCategoryId: string): string {
  if (menuCategoryId === 'clover-cat-uncategorized') return ''
  const prefix = 'clover-cat-'
  return menuCategoryId.startsWith(prefix) ? menuCategoryId.slice(prefix.length) : menuCategoryId
}

/** Construit le JSON type export inventaire (catégories Clover + articles classés avec prix). */
export function buildInventoryExtractedFromMenu(menu: Menu): InventoryExtractedPayload {
  const categories = menu.categories.map((c) => ({
    id: cloverCategoryIdFromMenuId(c.id),
    nom: c.nom,
  }))
  const items: InventoryExtractedPayload['items'] = []
  for (const cat of menu.categories) {
    for (const it of cat.items) {
      items.push({
        nom: it.nom,
        prix: Math.round(it.prix * 100) / 100,
        categorie: cat.nom,
      })
    }
  }
  return {
    categories,
    items,
    counts: { categories: categories.length, items: items.length },
  }
}

function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** CSV: nom, prix, categorie (une ligne par article, catégorie = nom affiché Clover). */
export function buildInventoryItemsCsvFromMenu(menu: Menu): string {
  const lines: string[] = ['nom,prix,categorie']
  for (const cat of menu.categories) {
    for (const it of cat.items) {
      const row = [
        csvEscapeCell(it.nom),
        csvEscapeCell(String(Math.round(it.prix * 100) / 100)),
        csvEscapeCell(cat.nom),
      ].join(',')
      lines.push(row)
    }
  }
  return lines.join('\n')
}

/** Récupère inventaire via API Clover puis payloads pour `inventory-extracted.json` et `inventory-items.csv`. */
export async function exportInventoryFromCloverViaApi(
  config?: CloverConfig
): Promise<{ success: boolean; message?: string; extracted?: InventoryExtractedPayload; csv?: string }> {
  const cfg = config ?? getCloverSettings()
  const result = await loadMenuFromCloverConfig(cfg)
  if (!result.success || !result.menu) {
    return { success: false, message: result.message ?? 'Echec chargement menu Clover' }
  }
  const extracted = buildInventoryExtractedFromMenu(result.menu)
  const csv = `\ufeff${buildInventoryItemsCsvFromMenu(result.menu)}`
  return { success: true, extracted, csv }
}

// Test Clover connection
export async function testCloverConnection(): Promise<{ success: boolean; message: string }> {
  const config = getCloverSettings()

  if (!config.merchantId || !config.apiToken) {
    return {
      success: false,
      message: 'Merchant ID et token API REST requis',
    }
  }

  try {
    const response = await cloverApiRequest(
      config,
      `/v3/merchants/${config.merchantId}`,
      { method: 'GET' },
    )

    if (response.ok) {
      const merchant = (await response.json()) as { name?: string }
      return {
        success: true,
        message: `Connecte a: ${merchant.name ?? 'commercant'}`,
      }
    }

    const detail = await response.text()
    const short =
      detail.length > 0 ? detail.slice(0, 180).replace(/\s+/g, ' ').trim() : ''
    return {
      success: false,
      message: short
        ? `Erreur Clover (${response.status}): ${short}`
        : `Erreur d'authentification (${response.status})`,
    }
  } catch {
    return {
      success: false,
      message: 'Impossible de joindre Clover (reseau ou serveur)',
    }
  }
}
