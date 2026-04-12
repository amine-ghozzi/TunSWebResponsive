'use client'

import type { Menu, MenuCategory, MenuItem } from '@/lib/types'
import { loadMenuFromClover } from '@/lib/services/clover-service'

const MENU_STORAGE_KEY = 'restaurant-menu'

// Default menu (will be loaded from menu.json initially)
let defaultMenu: Menu | null = null

// Load menu from localStorage or default
export function loadMenu(): Menu {
  if (typeof window === 'undefined') {
    return { categories: [] }
  }

  const stored = localStorage.getItem(MENU_STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return defaultMenu || { categories: [] }
    }
  }

  return defaultMenu || { categories: [] }
}

// Initialize with default menu from JSON
export async function initializeMenu(): Promise<Menu> {
  if (typeof window === 'undefined') {
    return { categories: [] }
  }

  // Prefer Clover as the source of truth when configured.
  const cloverResult = await loadMenuFromClover()
  if (cloverResult.success && cloverResult.menu) {
    defaultMenu = cloverResult.menu
    saveMenu(cloverResult.menu)
    return cloverResult.menu
  }

  // Check if already stored
  const stored = localStorage.getItem(MENU_STORAGE_KEY)
  if (stored) {
    try {
      const menu = JSON.parse(stored)
      defaultMenu = menu
      return menu
    } catch {
      // Continue to load from JSON
    }
  }

  // Load from JSON file
  try {
    const response = await fetch('/menu.json')
    const menu = await response.json()
    defaultMenu = menu
    saveMenu(menu)
    return menu
  } catch {
    return { categories: [] }
  }
}

// Save menu to localStorage
export function saveMenu(menu: Menu): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menu))
}

// Add a new category
export function addCategory(nom: string): Menu {
  const menu = loadMenu()
  const id = `cat-${Date.now()}`
  menu.categories.push({
    id,
    nom,
    items: [],
  })
  saveMenu(menu)
  return menu
}

// Update a category
export function updateCategory(categoryId: string, nom: string): Menu {
  const menu = loadMenu()
  const category = menu.categories.find((c) => c.id === categoryId)
  if (category) {
    category.nom = nom
    saveMenu(menu)
  }
  return menu
}

// Delete a category
export function deleteCategory(categoryId: string): Menu {
  const menu = loadMenu()
  menu.categories = menu.categories.filter((c) => c.id !== categoryId)
  saveMenu(menu)
  return menu
}

// Add a menu item to a category
export function addMenuItem(
  categoryId: string,
  item: Omit<MenuItem, 'id'>
): Menu {
  const menu = loadMenu()
  const category = menu.categories.find((c) => c.id === categoryId)
  if (category) {
    const id = `item-${Date.now()}`
    category.items.push({
      id,
      ...item,
    })
    saveMenu(menu)
  }
  return menu
}

// Update a menu item
export function updateMenuItem(
  categoryId: string,
  itemId: string,
  updates: Partial<Omit<MenuItem, 'id'>>
): Menu {
  const menu = loadMenu()
  const category = menu.categories.find((c) => c.id === categoryId)
  if (category) {
    const item = category.items.find((i) => i.id === itemId)
    if (item) {
      Object.assign(item, updates)
      saveMenu(menu)
    }
  }
  return menu
}

// Delete a menu item
export function deleteMenuItem(categoryId: string, itemId: string): Menu {
  const menu = loadMenu()
  const category = menu.categories.find((c) => c.id === categoryId)
  if (category) {
    category.items = category.items.filter((i) => i.id !== itemId)
    saveMenu(menu)
  }
  return menu
}

// Move category up or down
export function moveCategory(categoryId: string, direction: 'up' | 'down'): Menu {
  const menu = loadMenu()
  const index = menu.categories.findIndex((c) => c.id === categoryId)
  if (index === -1) return menu

  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= menu.categories.length) return menu

  const [category] = menu.categories.splice(index, 1)
  menu.categories.splice(newIndex, 0, category)
  saveMenu(menu)
  return menu
}

// Reset menu to default
export async function resetMenuToDefault(): Promise<Menu> {
  if (typeof window === 'undefined') {
    return { categories: [] }
  }

  localStorage.removeItem(MENU_STORAGE_KEY)
  return initializeMenu()
}
