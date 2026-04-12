import type { Order, OrderItem, MenuItem } from '@/lib/types'

const STORAGE_KEY = 'restaurant_orders'

// Generate unique ID
function generateId(): string {
  return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Load orders from localStorage
export function loadOrders(): Order[] {
  if (typeof window === 'undefined') return []
  
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return []
  
  try {
    const orders = JSON.parse(stored)
    return orders.map((o: Order & { itemsToPay?: OrderItem[] }) => {
      let items = o.items ?? []
      let itemsToPay = o.itemsToPay ?? []
      // Anciennes commandes : tout était dans items avec status sent
      if (
        !o.itemsToPay &&
        o.status === 'sent' &&
        Array.isArray(items) &&
        items.length > 0
      ) {
        itemsToPay = [...items]
        items = []
      }
      return {
        ...o,
        items,
        itemsToPay,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt),
      }
    })
  } catch {
    return []
  }
}

// Save orders to localStorage
function saveOrders(orders: Order[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
}

// Get order by table number (includes both pending and sent orders)
export function getOrderByTable(tableNumber: number): Order | undefined {
  const orders = loadOrders()
  return orders.find(
    (o) => o.tableNumber === tableNumber && (o.status === 'pending' || o.status === 'sent')
  )
}

// Create new order for table
export function createOrder(tableNumber: number): Order {
  const order: Order = {
    id: generateId(),
    tableNumber,
    items: [],
    itemsToPay: [],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  const orders = loadOrders()
  orders.push(order)
  saveOrders(orders)
  
  return order
}

// Add item to order
export function addItemToOrder(
  orderId: string,
  menuItem: MenuItem,
  quantity: number = 1,
  notes: string = ''
): Order | undefined {
  const orders = loadOrders()
  const orderIndex = orders.findIndex((o) => o.id === orderId)
  
  if (orderIndex === -1) return undefined
  
  const order = orders[orderIndex]
  const existingItemIndex = order.items.findIndex(
    (i) => i.menuItem.id === menuItem.id && i.notes === notes
  )
  
  if (existingItemIndex !== -1) {
    order.items[existingItemIndex].quantity += quantity
  } else {
    order.items.push({ menuItem, quantity, notes })
  }
  
  order.updatedAt = new Date()
  saveOrders(orders)
  
  return order
}

// Update item quantity
export function updateItemQuantity(
  orderId: string,
  itemIndex: number,
  quantity: number
): Order | undefined {
  const orders = loadOrders()
  const orderIndex = orders.findIndex((o) => o.id === orderId)
  
  if (orderIndex === -1) return undefined
  
  const order = orders[orderIndex]
  
  if (quantity <= 0) {
    order.items.splice(itemIndex, 1)
  } else {
    order.items[itemIndex].quantity = quantity
  }
  
  order.updatedAt = new Date()
  saveOrders(orders)
  
  return order
}

// Update item notes
export function updateItemNotes(
  orderId: string,
  itemIndex: number,
  notes: string
): Order | undefined {
  const orders = loadOrders()
  const orderIndex = orders.findIndex((o) => o.id === orderId)
  
  if (orderIndex === -1) return undefined
  
  const order = orders[orderIndex]
  order.items[itemIndex].notes = notes
  order.updatedAt = new Date()
  saveOrders(orders)
  
  return order
}

// Remove item from order
export function removeItemFromOrder(
  orderId: string,
  itemIndex: number
): Order | undefined {
  return updateItemQuantity(orderId, itemIndex, 0)
}

function mergeOrderItemLists(existing: OrderItem[], batch: OrderItem[]): OrderItem[] {
  const out: OrderItem[] = existing.map((line) => ({ ...line, menuItem: { ...line.menuItem } }))
  for (const line of batch) {
    const i = out.findIndex(
      (x) => x.menuItem.id === line.menuItem.id && x.notes === line.notes
    )
    if (i >= 0) out[i].quantity += line.quantity
    else out.push({ ...line, menuItem: { ...line.menuItem } })
  }
  return out
}

/**
 * Ticket cuisine : fusionne la saisie courante dans itemsToPay et vide items.
 * Ne quitte pas l’écran commande.
 */
export function sendDraftToKitchen(orderId: string): Order | undefined {
  const orders = loadOrders()
  const orderIndex = orders.findIndex((o) => o.id === orderId)
  if (orderIndex === -1) return undefined

  const order = orders[orderIndex]
  if (!order.items.length) return undefined

  order.itemsToPay = mergeOrderItemLists(order.itemsToPay ?? [], order.items)
  order.items = []
  order.status = 'sent'
  order.updatedAt = new Date()
  saveOrders(orders)
  return order
}

/** @deprecated utiliser sendDraftToKitchen */
export function markOrderAsSent(orderId: string): Order | undefined {
  return sendDraftToKitchen(orderId)
}

// Mark order as paid (keeps it in history)
export function markOrderAsPaid(orderId: string): Order | undefined {
  const orders = loadOrders()
  const orderIndex = orders.findIndex((o) => o.id === orderId)
  
  if (orderIndex === -1) return undefined
  
  orders[orderIndex].status = 'paid'
  orders[orderIndex].paidAt = new Date()
  orders[orderIndex].updatedAt = new Date()
  saveOrders(orders)
  
  return orders[orderIndex]
}

// Clear order (remove from storage)
export function clearOrder(orderId: string): void {
  const orders = loadOrders()
  const filtered = orders.filter((o) => o.id !== orderId)
  saveOrders(filtered)
}

function sumItems(lines: OrderItem[]): number {
  return lines.reduce((total, item) => total + item.menuItem.prix * item.quantity, 0)
}

/** Total saisie en cours (onglet Commande) */
export function calculateDraftTotal(order: Order): number {
  return sumItems(order.items ?? [])
}

/** Total à encaisser (Clover / accueil) */
export function calculateToPayTotal(order: Order): number {
  return sumItems(order.itemsToPay ?? [])
}

/** Tout ce qui est sur la table (saisie + à payer) */
export function calculateOrderTotal(order: Order): number {
  return calculateDraftTotal(order) + calculateToPayTotal(order)
}

// Get all active orders (pending or sent, not yet paid)
export function getActiveOrders(): Order[] {
  return loadOrders().filter(
    (o) =>
      (o.status === 'pending' || o.status === 'sent') &&
      ((o.items?.length ?? 0) > 0 || (o.itemsToPay?.length ?? 0) > 0)
  )
}

// Get tables with active orders
export function getTablesWithOrders(): number[] {
  return getActiveOrders().map((o) => o.tableNumber)
}

// Get all orders for today
export function getTodayOrders(): Order[] {
  const orders = loadOrders()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  return orders.filter((o) => {
    const orderDate = new Date(o.createdAt)
    orderDate.setHours(0, 0, 0, 0)
    return orderDate.getTime() === today.getTime()
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

// Get orders by table for today
export function getTodayOrdersByTable(tableNumber: number): Order[] {
  return getTodayOrders().filter((o) => o.tableNumber === tableNumber)
}

// Get total revenue for today
export function getTodayRevenue(): number {
  const todayOrders = getTodayOrders()
  return todayOrders
    .filter((o) => o.status === 'paid')
    .reduce((total, order) => {
      return total + order.items.reduce(
        (sum, item) => sum + item.menuItem.prix * item.quantity,
        0
      )
    }, 0)
}

// Clear old orders (keep only today's orders)
export function clearOldOrders(): void {
  const todayOrders = getTodayOrders()
  saveOrders(todayOrders)
}
