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
    throw new Error(body?.error?.formErrors?.[0] || body?.message || `Cererea a eșuat: ${res.status}`)
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
      toast.success("Categorie salvată")
      setCatDrawerOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm("Ștergi categoria și toate întrebările din ea?")) return
    try {
      await api(`/admin/faq/categories/${id}`, { method: "DELETE" })
      toast.success("Categorie ștearsă")
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
      toast.success("Întrebare salvată")
      setItemDrawerOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Ștergi întrebarea?")) return
    try {
      await api(`/admin/faq/items/${id}`, { method: "DELETE" })
      toast.success("Întrebare ștearsă")
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>FAQ — Întrebări frecvente</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Administrează categoriile și întrebările afișate pe site la pagina /faq.
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
          Categorie nouă
        </Button>
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center">
          <Text>Se încarcă…</Text>
        </div>
      ) : categories.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Text>Nicio categorie. Creeaz-o pe prima sau rulează scriptul de seed.</Text>
        </div>
      ) : (
        categories.map((cat) => (
          <div key={cat.id} className="px-6 py-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Heading level="h3">{cat.title}</Heading>
                  <Badge size="2xsmall" color={cat.is_published ? "green" : "grey"}>
                    {cat.is_published ? "publicată" : "ciornă"}
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
                  Întrebare
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
                    <Table.HeaderCell>Întrebare</Table.HeaderCell>
                    <Table.HeaderCell className="w-24">Ordine</Table.HeaderCell>
                    <Table.HeaderCell className="w-32">Stare</Table.HeaderCell>
                    <Table.HeaderCell className="w-32 text-right">Acțiuni</Table.HeaderCell>
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
                            {item.is_published ? "publicată" : "ciornă"}
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
            <Drawer.Title>{editingCat.id ? "Editează categoria" : "Categorie nouă"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-auto">
            <div className="flex flex-col gap-1">
              <Label>Slug</Label>
              <Input
                value={editingCat.slug ?? ""}
                onChange={(e) => setEditingCat({ ...editingCat, slug: e.target.value })}
                placeholder="ex. livrare-si-transport"
              />
              <Text size="xsmall" className="text-ui-fg-subtle">
                Doar litere mici, cifre și cratime. Folosit în URL la ?tab=…
              </Text>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Titlu</Label>
              <Input
                value={editingCat.title ?? ""}
                onChange={(e) => setEditingCat({ ...editingCat, title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Descriere (opțional)</Label>
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
              <Label>Publicată</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Anulează</Button>
            </Drawer.Close>
            <Button onClick={saveCategory}>Salvează</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>

      <Drawer open={itemDrawerOpen} onOpenChange={setItemDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>{editingItem.id ? "Editează întrebarea" : "Întrebare nouă"}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-auto">
            <div className="flex flex-col gap-1">
              <Label>Întrebare</Label>
              <Input
                value={editingItem.question ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem, question: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Răspuns (acceptă Markdown)</Label>
              <Textarea
                value={editingItem.answer ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem, answer: e.target.value })}
                rows={10}
                placeholder="Poți folosi **îngroșat**, *italic*, liste și [link](https://...)"
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
              <Label>Publicată</Label>
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Anulează</Button>
            </Drawer.Close>
            <Button onClick={saveItem}>Salvează</Button>
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
