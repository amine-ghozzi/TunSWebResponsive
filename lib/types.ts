// Menu types
export interface MenuItem {
  id: string
  nom: string
  prix: number
  description: string
  /** URL absolue d’image (réponse Clover expand=images ou href résolu). */
  imageUrl?: string
  /** Si true sans imageUrl : photo présente côté Clover, chargée via GET .../items/{id}/image + token. */
  cloverFetchImage?: boolean
}

export interface MenuCategory {
  id: string
  nom: string
  items: MenuItem[]
}

export interface Menu {
  categories: MenuCategory[]
}

// Order types
export interface OrderItem {
  menuItem: MenuItem
  quantity: number
  notes: string
}

export interface Order {
  id: string
  tableNumber: number
  /** Lignes en cours de saisie (onglet Commande), avant envoi cuisine */
  items: OrderItem[]
  /** Lignes envoyées en cuisine, en attente du paiement caisse (Clover) */
  itemsToPay: OrderItem[]
  status: 'pending' | 'sent' | 'paid' | 'completed'
  createdAt: Date
  updatedAt: Date
  paidAt?: Date
}

// Table types
export interface Table {
  number: number
  status: 'available' | 'occupied' | 'reserved'
  currentOrderId?: string
}

// Printer settings
export interface PrinterSettings {
  ipAddress: string
  port: number
}

// Clover settings
export interface CloverSettings {
  merchantId: string
  apiToken: string
}
