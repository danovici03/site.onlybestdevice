import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Photo,
  PencilSquare,
  Trash,
  Plus,
  ArrowUpMini,
  ArrowDownMini,
} from "@medusajs/icons"
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
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import HeroSlidePreview from "../../components/hero-slide-preview"

type HeroSlide = {
  id: string
  image_url: string
  alt: string
  title_line_1: string
  title_line_2: string | null
  cta_text: string | null
  cta_href: string | null
  display_order: number
  is_published: boolean
}

const emptySlide = {
  image_url: "",
  alt: "",
  title_line_1: "",
  title_line_2: "",
  cta_text: "",
  cta_href: "",
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
    throw new Error(
      body?.error?.formErrors?.[0] ||
        body?.message ||
        `Cererea a eșuat: ${res.status}`
    )
  }
  return res.json()
}

async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append("files", file)
  // Nu setăm Content-Type — browserul adaugă boundary-ul corect pentru FormData.
  const res = await fetch("/admin/uploads", {
    method: "POST",
    credentials: "include",
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || "Încărcarea imaginii a eșuat")
  }
  const data = await res.json()
  const url = data?.files?.[0]?.url
  if (!url) throw new Error("Răspuns invalid de la încărcare")
  return url
}

const HeroPage = () => {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<
    Partial<HeroSlide> & { id?: string }
  >(emptySlide)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ slides: HeroSlide[] }>("/admin/hero-slides")
      setSlides(
        [...data.slides].sort((a, b) => a.display_order - b.display_order)
      )
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openNew = () => {
    setEditing({ ...emptySlide, display_order: slides.length })
    setDrawerOpen(true)
  }

  const openEdit = (slide: HeroSlide) => {
    setEditing({ ...slide })
    setDrawerOpen(true)
  }

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file)
      setEditing((prev) => ({ ...prev, image_url: url }))
      toast.success("Imagine încărcată")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const save = async () => {
    if (!editing.image_url) {
      toast.error("Adaugă o imagine pentru slide")
      return
    }
    if (!editing.title_line_1?.trim()) {
      toast.error("Completează primul rând al titlului")
      return
    }
    setSaving(true)
    try {
      const payload = {
        image_url: editing.image_url,
        alt: editing.alt?.trim() || editing.title_line_1 || "",
        title_line_1: editing.title_line_1,
        title_line_2: editing.title_line_2?.trim() || null,
        cta_text: editing.cta_text?.trim() || null,
        cta_href: editing.cta_href?.trim() || null,
        display_order: Number(editing.display_order ?? 0),
        is_published: editing.is_published ?? true,
      }
      if (editing.id) {
        await api(`/admin/hero-slides/${editing.id}`, {
          method: "POST",
          body: JSON.stringify(payload),
        })
      } else {
        await api("/admin/hero-slides", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      toast.success("Slide salvat")
      setDrawerOpen(false)
      load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Ștergi acest slide?")) return
    try {
      await api(`/admin/hero-slides/${id}`, { method: "DELETE" })
      toast.success("Slide șters")
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Mută slide-ul în sus/jos schimbând display_order cu vecinul.
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= slides.length) return
    const a = slides[index]
    const b = slides[target]
    try {
      await Promise.all([
        api(`/admin/hero-slides/${a.id}`, {
          method: "POST",
          body: JSON.stringify({ display_order: b.display_order }),
        }),
        api(`/admin/hero-slides/${b.id}`, {
          method: "POST",
          body: JSON.stringify({ display_order: a.display_order }),
        }),
      ])
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading>Hero — Slider pagina principală</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Gestionează slide-urile afișate în partea de sus a paginii
            principale. Ordinea de mai jos este ordinea din slider.
          </Text>
        </div>
        <Button variant="secondary" onClick={openNew}>
          <Plus />
          Slide nou
        </Button>
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center">
          <Text>Se încarcă…</Text>
        </div>
      ) : slides.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <Text>Niciun slide încă. Adaugă primul cu „Slide nou".</Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell className="w-28">Imagine</Table.HeaderCell>
              <Table.HeaderCell>Titlu</Table.HeaderCell>
              <Table.HeaderCell className="w-40">Buton</Table.HeaderCell>
              <Table.HeaderCell className="w-28">Stare</Table.HeaderCell>
              <Table.HeaderCell className="w-44 text-right">
                Acțiuni
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {slides.map((slide, index) => (
              <Table.Row key={slide.id}>
                <Table.Cell>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.image_url}
                    alt={slide.alt}
                    className="h-12 w-20 rounded object-cover bg-ui-bg-subtle"
                  />
                </Table.Cell>
                <Table.Cell>
                  <Text size="small" weight="plus">
                    {slide.title_line_1}
                  </Text>
                  {slide.title_line_2 && (
                    <Text size="small" className="text-ui-fg-subtle">
                      {slide.title_line_2}
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  {slide.cta_text ? (
                    <div>
                      <Text size="small">{slide.cta_text}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle truncate">
                        {slide.cta_href}
                      </Text>
                    </div>
                  ) : (
                    <Text size="small" className="text-ui-fg-muted">
                      —
                    </Text>
                  )}
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    size="2xsmall"
                    color={slide.is_published ? "green" : "grey"}
                  >
                    {slide.is_published ? "publicat" : "ascuns"}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="transparent"
                      size="small"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Mută în sus"
                    >
                      <ArrowUpMini />
                    </Button>
                    <Button
                      variant="transparent"
                      size="small"
                      disabled={index === slides.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Mută în jos"
                    >
                      <ArrowDownMini />
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => openEdit(slide)}
                    >
                      <PencilSquare />
                    </Button>
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => remove(slide.id)}
                    >
                      <Trash />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editing.id ? "Editează slide" : "Slide nou"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-auto">
            <HeroSlidePreview
              imageUrl={editing.image_url}
              titleLine1={editing.title_line_1}
              titleLine2={editing.title_line_2}
              ctaText={editing.cta_text}
            />
            <div className="flex flex-col gap-2">
              <Label>Imagine</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
              />
              <Button
                variant="secondary"
                size="small"
                isLoading={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {editing.image_url ? "Schimbă imaginea" : "Încarcă imagine"}
              </Button>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Recomandat: imagine orizontală, minim 1920×1080px (peisaj).
              </Text>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Titlu — rândul 1</Label>
              <Input
                value={editing.title_line_1 ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, title_line_1: e.target.value })
                }
                placeholder="ex. CELE MAI NOI"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>Titlu — rândul 2 (opțional)</Label>
              <Input
                value={editing.title_line_2 ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, title_line_2: e.target.value })
                }
                placeholder="ex. TELEFOANE MOBILE"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label>Text alternativ (alt)</Label>
              <Input
                value={editing.alt ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, alt: e.target.value })
                }
                placeholder="Descriere imagine pentru SEO/accesibilitate"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label>Text buton (opțional)</Label>
                <Input
                  value={editing.cta_text ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, cta_text: e.target.value })
                  }
                  placeholder="ex. Vezi telefoanele"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Link buton (opțional)</Label>
                <Input
                  value={editing.cta_href ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, cta_href: e.target.value })
                  }
                  placeholder="ex. /categories/laptop"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Ordine</Label>
              <Input
                type="number"
                value={String(editing.display_order ?? 0)}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    display_order: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Publicat</Label>
              <Switch
                checked={editing.is_published ?? true}
                onCheckedChange={(v) =>
                  setEditing({ ...editing, is_published: v })
                }
              />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Anulează</Button>
            </Drawer.Close>
            <Button onClick={save} isLoading={saving} disabled={uploading}>
              Salvează
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Hero",
  icon: Photo,
})

export default HeroPage
