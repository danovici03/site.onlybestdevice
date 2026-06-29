import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight, PencilSquare, Trash, Plus } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type FaqItem = {
  id: string
  question: string
  answer: string
  display_order: number
  is_published: boolean
}

type FaqCategory = {
  id: string
  slug: string
  title: string
  description: string | null
  display_order: number
  is_published: boolean
  items?: FaqItem[]
}

const emptyCategory = {
  slug: "",
  title: "",
  description: "",
  display_order: 0,
  is_published: true,
}

const emptyItem = {
  category_id: "",
  question: "",
  answer: "",
  display_order: 0,
  is_published: true,
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.formErrors?.[0] || body?.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

const FaqPage = () => {
  const [categories, setCategories] = useState<FaqCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [catDrawerOpen, setCatDrawerOpen] = useState(false)
  const [itemDrawerOpen, setItemDrawerOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<Partial<FaqCategory> & { id?: string }>(emptyCategory)
  const [editingItem, setEditingItem] = useState<Partial<FaqItem> & { id?: string; category_id: string }>(emptyItem)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ categories: FaqCategory[] }>("/admin/faq/categories")
      setCategories(data.categories.sort((a, b) => a.display_order - b.display_order))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveCategory = async () => {
    try {
      const payload = {
        slug: editingCat.slug,
        title: editingCat.title,
        description: editingCat.description || null,
        display_order: Number(editingCat.display_order ?? 0),
        is_published: editingCat.is_published ?? true,
      }
      if (editingCat.id) {
        await api(`/admin/faq/categories/${editingCat.id}`, {
          method: "POST",
          body: JSON.stringify(payload),
        })
      } else {
        await api("/admin/faq/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      toast.success("Categoria salvata")
      setCatDrawerOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm("Eliminare la categoria e tutte le sue domande?")) return
    try {
      await api(`/admin/faq/categories/${id}`, { method: "DELETE" })
      toast.success("Categoria eliminata")
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const saveItem = async () => {
    try {
      const payload: any = {
        question: editingItem.question,
        answer: editingItem.answer,
        display_order: Number(editingItem.display_order ?? 0),
        is_published: editingItem.is_published ?? true,
      }
      if (!editingItem.id) payload.category_id = editingItem.category_id

      if (editingItem.id) {
        await api(`/admin/faq/items/${editingItem.id}`, {
          method: "POST",
          body: JSON.stringify(payload),
        })
      } else {
        await api("/admin/faq/items", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      toast.success("Domanda salvata")
      setItemDrawerOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Eliminare la domanda?")) return
    try {
      await api(`/admin/faq/items/${id}`, { method: "DELETE" })
      toast.success("Domanda eliminata")
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>FAQ — Domande Frequenti</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Gestisci categorie e domande visibili sullo storefront alla pagina /faq.
          </Text>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setEditingCat({ ...emptyCategory })
            setCatDrawerOpen(true)
          }}
        >
          <Plus />
          Nuova categoria
        </Button>
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center">
          <Text>Caricamento…</Text>
        </div>
      ) : categories.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Text>Nessuna categoria. Crea la prima oppure esegui lo script di seed.</Text>
        </div>
      ) : (
        categories.map((cat) => (
          <div key={cat.id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Heading level="h3">{cat.title}</Heading>
                  <Badge size="2xsmall" color={cat.is_published ? "green" : "grey"}>
                    {cat.is_published ? "pubblicata" : "bozza"}
                  </Badge>
                  <Badge size="2xsmall" color="grey">/{cat.slug}</Badge>
                </div>
                {cat.description && (
                  <Text size="small" className="text-ui-fg-subtle mt-1">
                    {cat.description}
                  </Text>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setEditingItem({ ...emptyItem, category_id: cat.id })
                    setItemDrawerOpen(true)
                  }}
                >
                  <Plus />
                  Domanda
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    setEditingCat(cat)
                    setCatDrawerOpen(true)
                  }}
                >
                  <PencilSquare />
                </Button>
                <Button variant="danger" size="small" onClick={() => deleteCategory(cat.id)}>
                  <Trash />
                </Button>
              </div>
            </div>

            {(cat.items ?? []).length > 0 && (
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Domanda</Table.HeaderCell>
                    <Table.HeaderCell className="w-24">Ordine</Table.HeaderCell>
                    <Table.HeaderCell className="w-32">Stato</Table.HeaderCell>
                    <Table.HeaderCell className="w-32 text-right">Azioni</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {(cat.items ?? [])
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((item) => (
                      <Table.Row key={item.id}>
                        <Table.Cell className="max-w-md truncate">{item.question}</Table.Cell>
                        <Table.Cell>{item.display_order}</Table.Cell>
                        <Table.Cell>
                          <Badge size="2xsmall" color={item.is_published ? "green" : "grey"}>
                            {item.is_published ? "pubblicata" : "bozza"}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => {
                                setEditingItem({ ...item, category_id: cat.id })
                                setItemDrawerOpen(true)
                              }}
                            >
                              <PencilSquare />
                            </Button>
                            <Button variant="danger" size="small" onClick={() => deleteItem(item.id)}>
                              <Trash />
                            </Button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                </Table.Body>
              </Table>
            )}
          </div>
        ))
      )}

      <Drawer open={catDrawerOpen} onOpenChange={setCatDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{editingCat.id ? "Modifica categoria" : "Nuova categoria"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-auto">
            <div className="flex flex-col gap-1">
              <Label>Slug</Label>
              <Input
                value={editingCat.slug ?? ""}
                onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })}
                placeholder="es. spedizioni-e-consegna"
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                Solo minuscole, numeri e trattini. Usato nell&apos;URL ?tab=…
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Titolo</Label>
              <Input
                value={editingCat.title ?? ""}
                onChange={(e) => setEditingCat({ ...editingCat, title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Descrizione (opzionale)</Label>
              <Textarea
                value={editingCat.description ?? ""}
                onChange={(e) => setEditingCat({ ...editingCat, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Ordine</Label>
              <Input
                type="number"
                value={editingCat.display_order ?? 0}
                onChange={(e) =>
                  setEditingCat({ ...editingCat, display_order: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingCat.is_published ?? true}
                onCheckedChange={(v) => setEditingCat({ ...editingCat, is_published: v })}
              />
              <Label>Pubblicata</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Annulla</Button>
            </Drawer.Close>
            <Button onClick={saveCategory}>Salva</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={itemDrawerOpen} onOpenChange={setItemDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{editingItem.id ? "Modifica domanda" : "Nuova domanda"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-auto">
            <div className="flex flex-col gap-1">
              <Label>Domanda</Label>
              <Input
                value={editingItem.question ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem, question: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Risposta (Markdown supportato)</Label>
              <Textarea
                value={editingItem.answer ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem, answer: e.target.value })}
                rows={10}
                placeholder="Puoi usare **grassetto**, *corsivo*, elenchi e [link](https://...)"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Ordine</Label>
              <Input
                type="number"
                value={editingItem.display_order ?? 0}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, display_order: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingItem.is_published ?? true}
                onCheckedChange={(v) => setEditingItem({ ...editingItem, is_published: v })}
              />
              <Label>Pubblicata</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Annulla</Button>
            </Drawer.Close>
            <Button onClick={saveItem}>Salva</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "FAQ",
  icon: ChatBubbleLeftRight,
})

export default FaqPage
