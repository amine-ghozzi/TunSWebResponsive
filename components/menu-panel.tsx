'use client'

import { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Menu, MenuItem } from '@/lib/types'
import { formatPrice, sortCategoriesForDisplay } from '@/lib/services/menu-service'
import {
  fetchCloverItemImageBlobUrl,
  getCloverSettings,
} from '@/lib/services/clover-service'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MenuPanelProps {
  menu: Menu
  onAddItem: (item: MenuItem) => void
}

export function MenuPanel({ menu, onAddItem }: MenuPanelProps) {
  const sortedCategories = useMemo(
    () => sortCategoriesForDisplay(menu.categories),
    [menu.categories]
  )

  const [activeCategory, setActiveCategory] = useState<string>(
    () => sortCategoriesForDisplay(menu.categories)[0]?.id ?? ''
  )

  useEffect(() => {
    if (sortedCategories.length === 0) {
      setActiveCategory('')
      return
    }
    setActiveCategory((prev) =>
      prev && sortedCategories.some((c) => c.id === prev)
        ? prev
        : sortedCategories[0].id
    )
  }, [sortedCategories])

  const currentCategory = sortedCategories.find((c) => c.id === activeCategory)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Onglets catégories : fixes, au-dessus de la liste */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-card p-2 pb-2 sm:p-3 md:gap-2.5 md:px-3 md:py-2">
        {sortedCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              'min-h-11 shrink-0 touch-manipulation whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 md:text-base',
              activeCategory === category.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {category.nom}
          </button>
        ))}
      </div>

      {/* Liste verticale des articles (une colonne) */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 md:p-4">
        <ul className="m-0 flex list-none flex-col gap-2 p-0 sm:gap-3">
          {currentCategory?.items.map((item) => (
            <li key={item.id}>
              <MenuItemCard item={item} onAdd={onAddItem} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

interface MenuItemCardProps {
  item: MenuItem
  onAdd: (item: MenuItem) => void
}

function MenuItemCard({ item, onAdd }: MenuItemCardProps) {
  const [blobImageUrl, setBlobImageUrl] = useState<string | undefined>(undefined)

  const displayImageUrl = item.imageUrl ?? blobImageUrl

  useEffect(() => {
    if (item.imageUrl || !item.cloverFetchImage) return
    const prefix = 'clover-item-'
    if (!item.id.startsWith(prefix)) return
    const cloverId = item.id.slice(prefix.length)
    if (!cloverId) return

    let cancelled = false
    let created: string | undefined

    ;(async () => {
      const blobUrl = await fetchCloverItemImageBlobUrl(
        getCloverSettings(),
        cloverId
      )
      if (cancelled || !blobUrl) return
      created = blobUrl
      setBlobImageUrl(blobUrl)
    })()

    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [item.id, item.imageUrl, item.cloverFetchImage])

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-secondary/50 sm:gap-3 sm:p-3 md:min-h-[4.5rem] md:p-3">
      {displayImageUrl ? (
        <img
          src={displayImageUrl}
          alt={item.nom}
          className="mr-0 h-12 w-12 shrink-0 rounded-md border border-border object-cover sm:mr-1 sm:h-14 sm:w-14 md:h-16 md:w-16"
        />
      ) : null}
      <div className="min-w-0 flex-1 pr-1 sm:pr-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-medium text-foreground sm:text-base md:text-[0.95rem] md:leading-snug lg:text-base">
            {item.nom}
          </h3>
          <span className="shrink-0 text-sm font-semibold text-primary sm:text-base">
            {formatPrice(item.prix)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
          {item.description}
        </p>
      </div>
      <Button
        size="icon"
        variant="outline"
        className="h-11 w-11 shrink-0 touch-manipulation border-primary text-primary hover:bg-primary hover:text-primary-foreground md:h-12 md:w-12"
        onClick={() => onAdd(item)}
      >
        <Plus className="h-5 w-5" />
      </Button>
    </div>
  )
}
