import type { Menu, MenuCategory, MenuItem } from '@/lib/types'

let cachedMenu: Menu | null = null

/** Normalisation pour comparer les noms de catégories (accents, casse). */
function normalizeMenuLabel(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Ordre d’affichage souhaité. Chaque entrée : formes normalisées équivalentes.
 * Les catégories non listées restent après, dans l’ordre d’origine.
 */
const CATEGORY_ORDER_ALIASES: string[][] = [
  ['entree', 'entrees'],
  ['salade', 'salades'],
  ['menu enfant', 'menus enfant'],
  ['les plats', 'plats'],
  ['sandwich', 'sandwichs'],
  ['pizza', 'pizzas'],
  ['brunch'],
  ['crepe', 'crepes'],
  ['cafe', 'cafes'],
  ['boisson', 'boissons', 'brevage', 'brevages'],
]

function categoryPriorityIndex(nom: string): number | null {
  const n = normalizeMenuLabel(nom)
  for (let i = 0; i < CATEGORY_ORDER_ALIASES.length; i++) {
    for (const alias of CATEGORY_ORDER_ALIASES[i]) {
      if (n === alias || n.startsWith(alias + ' ')) {
        return i
      }
    }
  }
  return null
}

/** Tri des onglets catégories (caisse / commande table). */
export function sortCategoriesForDisplay(categories: MenuCategory[]): MenuCategory[] {
  const annotated = categories.map((cat, originalIndex) => ({
    cat,
    originalIndex,
    prio: categoryPriorityIndex(cat.nom),
  }))
  annotated.sort((a, b) => {
    const ap = a.prio
    const bp = b.prio
    if (ap !== null && bp !== null && ap !== bp) return ap - bp
    if (ap !== null && bp === null) return -1
    if (ap === null && bp !== null) return 1
    return a.originalIndex - b.originalIndex
  })
  return annotated.map((x) => x.cat)
}

export async function loadMenu(): Promise<Menu> {
  if (cachedMenu) {
    return cachedMenu
  }

  const response = await fetch('/menu.json')
  if (!response.ok) {
    throw new Error('Failed to load menu')
  }

  cachedMenu = await response.json()
  return cachedMenu as Menu
}

export function getCategories(menu: Menu): MenuCategory[] {
  return menu.categories
}

export function getItemsByCategory(menu: Menu, categoryId: string): MenuItem[] {
  const category = menu.categories.find((c) => c.id === categoryId)
  return category?.items || []
}

export function getItemById(menu: Menu, itemId: string): MenuItem | undefined {
  for (const category of menu.categories) {
    const item = category.items.find((i) => i.id === itemId)
    if (item) return item
  }
  return undefined
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(price)
}
