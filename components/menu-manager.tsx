'use client'

import { useId, useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Book,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Save,
  X,
} from 'lucide-react'
import type { Menu, MenuCategory, MenuItem } from '@/lib/types'
import {
  initializeMenu,
  loadMenu,
  addCategory,
  updateCategory,
  deleteCategory,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  moveCategory,
  resetMenuToDefault,
} from '@/lib/stores/menu-store'
import { formatPrice } from '@/lib/services/menu-service'

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.onload = () => resolve(String(reader.result || ''))
    reader.readAsDataURL(file)
  })
}

export function MenuManager() {
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<Menu>({ categories: [] })
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<{
    categoryId: string
    itemId: string
  } | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [showAddItem, setShowAddItem] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'category' | 'item'
    categoryId: string
    itemId?: string
    name: string
  } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  // Form states for editing
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editItemForm, setEditItemForm] = useState<Omit<MenuItem, 'id'>>({
    nom: '',
    prix: 0,
    description: '',
    imageUrl: '',
  })
  const [newItemForm, setNewItemForm] = useState<Omit<MenuItem, 'id'>>({
    nom: '',
    prix: 0,
    description: '',
    imageUrl: '',
  })
  const editFileInputId = useId()
  const newFileInputId = useId()

  // Load menu on open
  useEffect(() => {
    if (open) {
      initializeMenu().then(setMenu)
    }
  }, [open])

  // Handle add category
  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const updated = addCategory(newCategoryName.trim())
      setMenu(updated)
      setNewCategoryName('')
      setShowAddCategory(false)
    }
  }

  // Handle update category
  const handleUpdateCategory = (categoryId: string) => {
    if (editCategoryName.trim()) {
      const updated = updateCategory(categoryId, editCategoryName.trim())
      setMenu(updated)
      setEditingCategory(null)
    }
  }

  // Handle delete category
  const handleDeleteCategory = () => {
    if (confirmDelete && confirmDelete.type === 'category') {
      const updated = deleteCategory(confirmDelete.categoryId)
      setMenu(updated)
      setConfirmDelete(null)
    }
  }

  // Handle add item
  const handleAddItem = (categoryId: string) => {
    if (newItemForm.nom.trim()) {
      const updated = addMenuItem(categoryId, newItemForm)
      setMenu(updated)
      setNewItemForm({ nom: '', prix: 0, description: '', imageUrl: '' })
      setShowAddItem(null)
    }
  }

  // Handle update item
  const handleUpdateItem = () => {
    if (editingItem && editItemForm.nom.trim()) {
      const updated = updateMenuItem(
        editingItem.categoryId,
        editingItem.itemId,
        editItemForm
      )
      setMenu(updated)
      setEditingItem(null)
    }
  }

  // Handle delete item
  const handleDeleteItem = () => {
    if (confirmDelete && confirmDelete.type === 'item' && confirmDelete.itemId) {
      const updated = deleteMenuItem(
        confirmDelete.categoryId,
        confirmDelete.itemId
      )
      setMenu(updated)
      setConfirmDelete(null)
    }
  }

  // Handle move category
  const handleMoveCategory = (categoryId: string, direction: 'up' | 'down') => {
    const updated = moveCategory(categoryId, direction)
    setMenu(updated)
  }

  // Handle reset menu
  const handleResetMenu = async () => {
    const updated = await resetMenuToDefault()
    setMenu(updated)
    setConfirmReset(false)
  }

  // Start editing category
  const startEditCategory = (category: MenuCategory) => {
    setEditingCategory(category.id)
    setEditCategoryName(category.nom)
  }

  // Start editing item
  const startEditItem = (categoryId: string, item: MenuItem) => {
    setEditingItem({ categoryId, itemId: item.id })
    setEditItemForm({
      nom: item.nom,
      prix: item.prix,
      description: item.description,
      imageUrl: item.imageUrl || '',
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="touch-manipulation gap-1.5 sm:gap-2 md:min-h-11 md:px-4"
          >
            <Book className="h-4 w-4 shrink-0" />
            <span className="hidden min-[380px]:inline">Gerer le Menu</span>
            <span className="min-[380px]:hidden">Menu</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[min(90dvh,900px)] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Gestion du Menu</DialogTitle>
            <DialogDescription>
              Ajoutez, modifiez ou supprimez des categories et des plats
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between border-b border-border pb-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowAddCategory(true)}
            >
              <Plus className="h-4 w-4" />
              Nouvelle Categorie
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => setConfirmReset(true)}
            >
              <RotateCcw className="h-4 w-4" />
              Reinitialiser
            </Button>
          </div>

          {/* Add category form */}
          {showAddCategory && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
              <Input
                placeholder="Nom de la categorie"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                autoFocus
              />
              <Button size="sm" onClick={handleAddCategory}>
                <Save className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddCategory(false)
                  setNewCategoryName('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <ScrollArea className="h-[50vh] pr-4">
            <Accordion type="multiple" className="w-full">
              {menu.categories.map((category, index) => (
                <AccordionItem key={category.id} value={category.id}>
                  <div className="flex items-center gap-2">
                    {/* Move buttons */}
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === 0}
                        onClick={() => handleMoveCategory(category.id, 'up')}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === menu.categories.length - 1}
                        onClick={() => handleMoveCategory(category.id, 'down')}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>

                    {editingCategory === category.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editCategoryName}
                          onChange={(e) => setEditCategoryName(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' &&
                            handleUpdateCategory(category.id)
                          }
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUpdateCategory(category.id)}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingCategory(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <AccordionTrigger className="flex-1 hover:no-underline">
                          <span className="text-base font-semibold">
                            {category.nom}
                          </span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({category.items.length} articles)
                          </span>
                        </AccordionTrigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditCategory(category)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDelete({
                              type: 'category',
                              categoryId: category.id,
                              name: category.nom,
                            })
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>

                  <AccordionContent>
                    <div className="space-y-2 pl-8">
                      {/* Items list */}
                      {category.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 p-3"
                        >
                          {editingItem?.itemId === item.id ? (
                            <div className="flex-1 space-y-2">
                              <Input
                                placeholder="Nom"
                                value={editItemForm.nom}
                                onChange={(e) =>
                                  setEditItemForm({
                                    ...editItemForm,
                                    nom: e.target.value,
                                  })
                                }
                              />
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Prix"
                                  value={editItemForm.prix}
                                  onChange={(e) =>
                                    setEditItemForm({
                                      ...editItemForm,
                                      prix: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-24"
                                />
                                <Input
                                  placeholder="Description"
                                  value={editItemForm.description}
                                  onChange={(e) =>
                                    setEditItemForm({
                                      ...editItemForm,
                                      description: e.target.value,
                                    })
                                  }
                                  className="flex-1"
                                />
                              </div>
                              <Input
                                placeholder="URL de la photo (https://...)"
                                value={editItemForm.imageUrl || ''}
                                onChange={(e) =>
                                  setEditItemForm({
                                    ...editItemForm,
                                    imageUrl: e.target.value,
                                  })
                                }
                              />
                              <div className="flex flex-wrap items-center gap-2">
                                <Label htmlFor={editFileInputId} className="text-xs text-muted-foreground">
                                  ou uploader une image
                                </Label>
                                <Input
                                  id={editFileInputId}
                                  type="file"
                                  accept="image/*"
                                  className="max-w-sm"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    const dataUrl = await fileToDataUrl(file)
                                    setEditItemForm((prev) => ({ ...prev, imageUrl: dataUrl }))
                                    e.target.value = ''
                                  }}
                                />
                                {editItemForm.imageUrl ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditItemForm((prev) => ({ ...prev, imageUrl: '' }))}
                                  >
                                    Retirer la photo
                                  </Button>
                                ) : null}
                              </div>
                              {editItemForm.imageUrl ? (
                                <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2">
                                  <img
                                    src={editItemForm.imageUrl}
                                    alt="Apercu"
                                    className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Apercu de la photo associee a l&apos;article.
                                  </p>
                                </div>
                              ) : null}
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleUpdateItem}>
                                  <Save className="mr-1 h-4 w-4" />
                                  Enregistrer
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingItem(null)}
                                >
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.nom}
                                  className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                                />
                              ) : null}
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{item.nom}</span>
                                  <span className="font-semibold text-primary">
                                    {formatPrice(item.prix)}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {item.description}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => startEditItem(category.id, item)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() =>
                                  setConfirmDelete({
                                    type: 'item',
                                    categoryId: category.id,
                                    itemId: item.id,
                                    name: item.nom,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Add item form */}
                      {showAddItem === category.id ? (
                        <div className="space-y-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3">
                          <Input
                            placeholder="Nom de l'article"
                            value={newItemForm.nom}
                            onChange={(e) =>
                              setNewItemForm({
                                ...newItemForm,
                                nom: e.target.value,
                              })
                            }
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <div className="w-24">
                              <Label className="text-xs">Prix ($)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newItemForm.prix || ''}
                                onChange={(e) =>
                                  setNewItemForm({
                                    ...newItemForm,
                                    prix: parseFloat(e.target.value) || 0,
                                  })
                                }
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs">Description</Label>
                              <Input
                                placeholder="Description"
                                value={newItemForm.description}
                                onChange={(e) =>
                                  setNewItemForm({
                                    ...newItemForm,
                                    description: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Photo (URL ou upload)</Label>
                            <Input
                              placeholder="https://.../image.jpg"
                              value={newItemForm.imageUrl || ''}
                              onChange={(e) =>
                                setNewItemForm({
                                  ...newItemForm,
                                  imageUrl: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Label htmlFor={newFileInputId} className="text-xs text-muted-foreground">
                              Uploader une image locale
                            </Label>
                            <Input
                              id={newFileInputId}
                              type="file"
                              accept="image/*"
                              className="max-w-sm"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                const dataUrl = await fileToDataUrl(file)
                                setNewItemForm((prev) => ({ ...prev, imageUrl: dataUrl }))
                                e.target.value = ''
                              }}
                            />
                            {newItemForm.imageUrl ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setNewItemForm((prev) => ({ ...prev, imageUrl: '' }))}
                              >
                                Retirer la photo
                              </Button>
                            ) : null}
                          </div>
                          {newItemForm.imageUrl ? (
                            <div className="flex items-center gap-3 rounded-md border border-border bg-background p-2">
                              <img
                                src={newItemForm.imageUrl}
                                alt="Apercu"
                                className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
                              />
                              <p className="text-xs text-muted-foreground">
                                Apercu de la photo associee a l&apos;article.
                              </p>
                            </div>
                          ) : null}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddItem(category.id)}
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              Ajouter
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShowAddItem(null)
                                setNewItemForm({
                                  nom: '',
                                  prix: 0,
                                  description: '',
                                  imageUrl: '',
                                })
                              }}
                            >
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5 border-dashed"
                          onClick={() => setShowAddItem(category.id)}
                        >
                          <Plus className="h-4 w-4" />
                          Ajouter un article
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {menu.categories.length === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                Aucune categorie. Cliquez sur &quot;Nouvelle Categorie&quot; pour
                commencer.
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={() => setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer{' '}
              {confirmDelete?.type === 'category'
                ? `la categorie "${confirmDelete?.name}" et tous ses articles`
                : `l'article "${confirmDelete?.name}"`}
              ? Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={
                confirmDelete?.type === 'category'
                  ? handleDeleteCategory
                  : handleDeleteItem
              }
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm reset dialog */}
      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reinitialiser le menu</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir reinitialiser le menu aux valeurs par
              defaut? Toutes vos modifications seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetMenu}>
              Reinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
