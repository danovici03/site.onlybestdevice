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
import { uploadImages, uploadVideos } from "../../lib/admin-uploads"

type HeroSlide = {
  id: string
  image_url: string
  video_url: string | null
  video_url_mobile: string | null
  image_url_mobile: string | null
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
  video_url: null as string | null,
  video_url_mobile: null as string | null,
  image_url_mobile: null as string | null,
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

const HeroPage = () => {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingMobile, setUploadingMobile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<
    Partial<HeroSlide> & { id?: string }
  >(emptySlide)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  // Crește la fiecare închidere a ferestrei. Un upload ține minte valoarea de
  // la pornire și, dacă între timp s-a schimbat, rezultatul lui nu mai are
  // unde să ajungă: altfel fișierul ar intra în următorul slide deschis și, la
  // câmpul vertical, i-ar șterge varianta existentă.
  const editSession = useRef(0)

  const busy = uploading || uploadingVideo || uploadingMobile

  const closeDrawer = () => {
    editSession.current += 1
    setUploading(false)
    setUploadingVideo(false)
    setUploadingMobile(false)
    setDrawerOpen(false)
  }

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

  const pickFile =
    (
      setBusy: (busy: boolean) => void,
      upload: (
        file: File
      ) => Promise<{ fields: Partial<HeroSlide>; message: string }>
    ) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Golit acum, ca același fișier să poată fi ales din nou după o eroare.
      e.target.value = ""
      if (!file) return
      const session = editSession.current
      setBusy(true)
      try {
        const { fields, message } = await upload(file)
        if (session !== editSession.current) return
        setEditing((prev) => ({ ...prev, ...fields }))
        toast.success(message)
      } catch (err: any) {
        if (session === editSession.current) toast.error(err.message)
      } finally {
        if (session === editSession.current) setBusy(false)
      }
    }

  const onPickFile = pickFile(setUploading, async (file) => {
    const [url] = await uploadImages([file])
    return { fields: { image_url: url }, message: "Imagine încărcată" }
  })

  const onPickVideo = pickFile(setUploadingVideo, async (file) => {
    const [url] = await uploadVideos([file])
    return { fields: { video_url: url }, message: "Video încărcat" }
  })

  // Câmpul vertical ține un singur fișier: fie video, fie poză. Cel nou îl
  // înlocuiește pe celălalt, ca operatorul să vadă mereu ce rulează pe mobil.
  const onPickMobile = pickFile(setUploadingMobile, async (file) => {
    const isVideo = file.type.startsWith("video/")
    const [url] = isVideo
      ? await uploadVideos([file])
      : await uploadImages([file])
    return {
      fields: {
        video_url_mobile: isVideo ? url : null,
        image_url_mobile: isVideo ? null : url,
      },
      message: isVideo ? "Video încărcat" : "Imagine încărcată",
    }
  })

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
        video_url: editing.video_url || null,
        video_url_mobile: editing.video_url_mobile || null,
        image_url_mobile: editing.image_url_mobile || null,
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
      closeDrawer()
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
                  <div className="relative h-12 w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.image_url}
                      alt={slide.alt}
                      className="h-full w-full rounded object-cover bg-ui-bg-subtle"
                    />
                    {(slide.video_url || slide.video_url_mobile) && (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                        video
                      </span>
                    )}
                    {(slide.image_url_mobile || slide.video_url_mobile) && (
                      <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] font-medium text-white">
                        vertical
                      </span>
                    )}
                  </div>
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

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => (open ? setDrawerOpen(true) : closeDrawer())}
      >
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>
              {editing.id ? "Editează slide" : "Slide nou"}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4 overflow-auto">
            <HeroSlidePreview
              imageUrl={editing.image_url}
              videoUrl={editing.video_url || editing.video_url_mobile}
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
                disabled={saving}
                onClick={() => fileInputRef.current?.click()}
              >
                {editing.image_url ? "Schimbă imaginea" : "Încarcă imagine"}
              </Button>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Recomandat: imagine orizontală, minim 1920×1080px (peisaj).
                Dacă adaugi și un video, imaginea rămâne poster-ul lui.
              </Text>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Video (opțional)</Label>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm"
                className="hidden"
                onChange={onPickVideo}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  isLoading={uploadingVideo}
                  disabled={saving}
                  onClick={() => videoInputRef.current?.click()}
                >
                  {editing.video_url ? "Schimbă videoul" : "Încarcă video"}
                </Button>
                {editing.video_url && (
                  <Button
                    variant="danger"
                    size="small"
                    disabled={uploadingVideo}
                    onClick={() => setEditing({ ...editing, video_url: null })}
                  >
                    Elimină
                  </Button>
                )}
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">
                mp4 sau webm, maxim 20 MB, orizontal. Rulează în buclă, fără
                sunet și fără controale — comprimă-l la ~1080p și scoate-i pista
                audio.
              </Text>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Video sau poză pentru ecrane verticale (opțional)</Label>
              <input
                ref={mobileInputRef}
                type="file"
                accept="video/mp4,video/webm,image/*"
                className="hidden"
                onChange={onPickMobile}
              />
              {editing.video_url_mobile ? (
                <video
                  key={editing.video_url_mobile}
                  src={editing.video_url_mobile}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-40 w-[90px] rounded object-cover bg-ui-bg-subtle"
                />
              ) : editing.image_url_mobile ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={editing.image_url_mobile}
                  alt=""
                  className="h-40 w-[90px] rounded object-cover bg-ui-bg-subtle"
                />
              ) : null}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  isLoading={uploadingMobile}
                  disabled={saving}
                  onClick={() => mobileInputRef.current?.click()}
                >
                  {editing.video_url_mobile
                    ? "Schimbă videoul vertical"
                    : editing.image_url_mobile
                      ? "Schimbă poza verticală"
                      : "Încarcă video sau poză"}
                </Button>
                {(editing.video_url_mobile || editing.image_url_mobile) && (
                  <Button
                    variant="danger"
                    size="small"
                    disabled={uploadingMobile}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        video_url_mobile: null,
                        image_url_mobile: null,
                      })
                    }
                  >
                    Elimină
                  </Button>
                )}
              </div>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Se folosește pe telefon și pe tabletă ținute în picioare.
                Încarcă o variantă verticală sau pătrată — altfel, dintr-un
                banner lat se vede pe mobil doar fâșia din mijloc, mărită.
                Video: mp4 sau webm, maxim 20 MB. Poză: JPG, PNG, WebP, AVIF,
                GIF sau SVG, maxim 8 MB. Cu o poză aici, pe vertical nu mai
                rulează videoul orizontal. Dacă lași câmpul gol, pe vertical
                rămân imaginea și videoul orizontale.
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
            <Button
              onClick={save}
              isLoading={saving}
              disabled={busy}
            >
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
