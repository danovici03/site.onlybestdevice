import { ArrowDownTray, CheckCircle, Link as LinkIcon } from "@medusajs/icons"
import { AdminProduct } from "@medusajs/types"
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Container,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  clx,
  toast,
} from "@medusajs/ui"
import { useCallback, useMemo, useState } from "react"

import {
  applyImport,
  fetchPreview,
  PreviewError,
  type ImportPreview,
  type ImportedSpec,
} from "../lib/product-import"
import { useOptionalQueryClient } from "../lib/use-optional-query-client"

/**
 * Importul descrierii, al fișei tehnice și al pozelor de pe pagina altui
 * magazin.
 *
 * Regula întregului panou: NIMIC nu se scrie fără bifă. Extragerea e
 * automată, alegerea e a operatorului — de aceea previzualizarea arată și ce
 * are produsul ACUM pe fiecare secțiune, nu doar ce ar veni.
 *
 * Etichetele de specificații se mapează pe vocabularul nostru (vezi
 * `lib/product-import/vocabulary.ts`). Cele recunoscute vin cu forma de casă
 * completată; cele noi rămân cum le scrie sursa, iar operatorul le poate
 * rescrie sau alege din lista de etichete deja folosite. Fără pasul ăsta,
 * panoul „Specificații" din magazin ar căpăta două rânduri pentru același
 * lucru — unul cu diacritice, unul fără.
 */

const SPEC_LIST_ID = "obd-spec-vocabulary"

type SpecRow = ImportedSpec & {
  selected: boolean
  /** Eticheta finală, editabilă de operator. */
  target: string
}

const ProductImportPanel = ({ product }: { product: AdminProduct }) => {
  const queryClient = useOptionalQueryClient()

  const [url, setUrl] = useState("")
  const [pastedHtml, setPastedHtml] = useState("")
  const [showPaste, setShowPaste] = useState(false)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [open, setOpen] = useState(false)

  const [takeDescription, setTakeDescription] = useState(true)
  const [specRows, setSpecRows] = useState<SpecRow[]>([])
  const [specsMode, setSpecsMode] = useState<"merge" | "replace">("merge")
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [setThumbnail, setSetThumbnail] = useState(false)

  const load = useCallback(async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const data = await fetchPreview({
        url: url.trim(),
        html: showPaste && pastedHtml.trim() ? pastedHtml : undefined,
        product_id: product.id,
      })
      setPreview(data)
      setTakeDescription(!!data.description.html)
      setSpecRows(
        data.specs.map((spec) => ({ ...spec, selected: true, target: spec.label }))
      )
      setSpecsMode("merge")
      // Pozele NU sunt bifate din start: produsul are de obicei deja galeria
      // lui, iar 12 poze adăugate din greșeală se scot una câte una.
      setSelectedImages(new Set())
      setSetThumbnail(false)
      setOpen(true)
      setShowPaste(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Eroare necunoscută"
      toast.error(message)
      if (err instanceof PreviewError && err.canPasteHtml) setShowPaste(true)
    } finally {
      setLoading(false)
    }
  }, [pastedHtml, product.id, showPaste, url])

  const selectedSpecs = useMemo(
    () => specRows.filter((row) => row.selected && row.target.trim()),
    [specRows]
  )

  const conflictingSpecs = useMemo(() => {
    const current = preview?.current?.specs ?? {}
    return selectedSpecs.filter(
      (row) => current[row.target] !== undefined && current[row.target] !== row.value
    ).length
  }, [preview, selectedSpecs])

  const nothingSelected =
    !(takeDescription && preview?.description.html) &&
    !selectedSpecs.length &&
    !selectedImages.size

  const apply = useCallback(async () => {
    if (!preview) return
    setApplying(true)
    try {
      const specs: Record<string, string> = {}
      for (const row of selectedSpecs) specs[row.target.trim()] = row.value

      const report = await applyImport({
        product_id: product.id,
        source_url: preview.url,
        ...(takeDescription && preview.description.html
          ? { description: preview.description.html }
          : {}),
        ...(Object.keys(specs).length ? { specs, specs_mode: specsMode } : {}),
        ...(selectedImages.size
          ? {
              images: preview.images.filter((img) => selectedImages.has(img)),
              set_thumbnail: setThumbnail,
            }
          : {}),
      })

      const done = [
        report.description_updated && "descrierea",
        report.specs_written ? `${report.specs_written} specificații` : null,
        report.images_added ? `${report.images_added} poze` : null,
      ].filter(Boolean)

      toast.success(`Importat: ${done.join(", ") || "nimic"}.`)
      if (report.failures.length) {
        toast.warning(
          `${report.failures.length} poze n-au putut fi aduse: ${report.failures[0].reason}`
        )
      }

      queryClient?.invalidateQueries({ queryKey: ["products"] })
      setOpen(false)
      // Descrierea și specificațiile sunt randate de alte widgeturi, care își
      // citesc datele la montare — reîncărcarea e cel mai onest mod de a arăta
      // rezultatul, fără să ne prefacem că știm cheile lor de cache.
      window.setTimeout(() => window.location.reload(), 600)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Importul a eșuat")
    } finally {
      setApplying(false)
    }
  }, [
    preview,
    product.id,
    queryClient,
    selectedImages,
    selectedSpecs,
    setThumbnail,
    specsMode,
    takeDescription,
  ])

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <ArrowDownTray />
          <Heading level="h2">Import de pe link</Heading>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Lipește linkul paginii de produs de pe eMAG, Altex sau de pe site-ul
          producătorului. Nu se scrie nimic până nu bifezi ce vrei să iei.
        </Text>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="text-ui-fg-muted absolute left-2 top-1/2 -translate-y-1/2">
              <LinkIcon />
            </div>
            <Input
              className="pl-8"
              placeholder="https://www.emag.ro/…/pd/D499FV3BM/"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load()
              }}
              disabled={loading}
            />
          </div>
          <Button
            size="small"
            variant="secondary"
            isLoading={loading}
            disabled={!url.trim()}
            onClick={() => void load()}
          >
            Citește pagina
          </Button>
        </div>

        {showPaste && (
          <div className="flex flex-col gap-2">
            <Alert variant="warning">
              Magazinul a refuzat cererea venită din server. Deschide linkul în
              browser, apasă Cmd+U (sau Ctrl+U) pentru sursa paginii, copiaz-o
              și lipește-o aici. Linkul de mai sus rămâne necesar — din el se
              rezolvă adresele pozelor.
            </Alert>
            <Textarea
              rows={4}
              placeholder="<!doctype html>…"
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
            />
            <div>
              <Button
                size="small"
                variant="secondary"
                isLoading={loading}
                disabled={!pastedHtml.trim()}
                onClick={() => void load()}
              >
                Citește sursa lipită
              </Button>
            </div>
          </div>
        )}
      </div>

      <FocusModal open={open} onOpenChange={setOpen}>
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-between gap-4">
              <FocusModal.Title asChild>
                <Heading level="h2">Ce importăm</Heading>
              </FocusModal.Title>
              <FocusModal.Description className="sr-only">
                Alege ce se copiază de pe pagina sursă în produsul curent.
              </FocusModal.Description>
              <div className="flex items-center gap-2">
                <Button size="small" variant="secondary" onClick={() => setOpen(false)}>
                  Renunță
                </Button>
                <Button
                  size="small"
                  isLoading={applying}
                  disabled={nothingSelected}
                  onClick={() => void apply()}
                >
                  Importă
                </Button>
              </div>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="overflow-y-auto px-6 py-6">
            {preview && (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                <SourceSummary preview={preview} />

                <DescriptionSection
                  preview={preview}
                  checked={takeDescription}
                  onChange={setTakeDescription}
                />

                <SpecsSection
                  preview={preview}
                  rows={specRows}
                  onRows={setSpecRows}
                  mode={specsMode}
                  onMode={setSpecsMode}
                  conflicting={conflictingSpecs}
                />

                <ImagesSection
                  preview={preview}
                  selected={selectedImages}
                  onSelected={setSelectedImages}
                  thumbnail={setThumbnail}
                  onThumbnail={setSetThumbnail}
                />
              </div>
            )}
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

const SourceSummary = ({ preview }: { preview: ImportPreview }) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <Badge size="small">{preview.source_label}</Badge>
      {preview.brand && <Badge size="small">{preview.brand}</Badge>}
      {preview.ean && <Badge size="small">EAN {preview.ean}</Badge>}
      {!preview.ean && preview.mpn && <Badge size="small">Cod {preview.mpn}</Badge>}
    </div>
    <Text size="small" className="text-ui-fg-base">
      {preview.title ?? "(fără titlu în pagină)"}
    </Text>
    {preview.current && (
      <Text size="small" className="text-ui-fg-muted">
        Se importă în: {preview.current.title}
      </Text>
    )}
    {preview.notes.map((note) => (
      <Alert key={note} variant="info">
        {note}
      </Alert>
    ))}
  </div>
)

const SectionHeader = ({
  title,
  hint,
  right,
}: {
  title: string
  hint?: string
  right?: React.ReactNode
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex flex-col">
      <Heading level="h3">{title}</Heading>
      {hint && (
        <Text size="small" className="text-ui-fg-muted">
          {hint}
        </Text>
      )}
    </div>
    {right}
  </div>
)

const DescriptionSection = ({
  preview,
  checked,
  onChange,
}: {
  preview: ImportPreview
  checked: boolean
  onChange: (v: boolean) => void
}) => {
  const { description, current } = preview

  if (!description.html) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <SectionHeader title="Descriere" />
        <Text size="small" className="text-ui-fg-muted">
          Pagina n-are o descriere pe care să o putem folosi.
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <SectionHeader
        title="Descriere"
        hint={`${description.chars.toLocaleString("ro-RO")} caractere${
          description.image_count ? ` · ${description.image_count} poze` : ""
        }`}
        right={
          <div className="flex items-center gap-2">
            <Checkbox
              id="import-description"
              checked={checked}
              onCheckedChange={(v) => onChange(v === true)}
            />
            <Label htmlFor="import-description">Importă</Label>
          </div>
        }
      />

      {current?.has_description && checked && (
        <Alert variant="warning">
          Produsul are deja o descriere de{" "}
          {current.description_chars.toLocaleString("ro-RO")} caractere. Importul
          o înlocuiește.
        </Alert>
      )}

      <div
        className={clx(
          "max-h-64 overflow-y-auto rounded-md border p-3 text-ui-fg-subtle",
          "[&_p]:my-1 [&_p]:text-sm",
          "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ui-fg-base",
          "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ui-fg-base",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:text-sm",
          "[&_figure]:my-2 [&_img]:max-h-32 [&_img]:w-auto [&_img]:rounded-md"
        )}
        // HTML-ul vine deja sanitizat de rută (`sanitizeWooHtml`), cu același
        // filtru prin care trece orice descriere din baza noastră.
        dangerouslySetInnerHTML={{ __html: description.html }}
      />

      <Text size="small" className="text-ui-fg-muted">
        Pozele din descriere se aduc în stocarea magazinului la import, ca să nu
        depindă de site-ul sursă.
      </Text>
    </div>
  )
}

const SpecsSection = ({
  preview,
  rows,
  onRows,
  mode,
  onMode,
  conflicting,
}: {
  preview: ImportPreview
  rows: SpecRow[]
  onRows: (rows: SpecRow[]) => void
  mode: "merge" | "replace"
  onMode: (mode: "merge" | "replace") => void
  conflicting: number
}) => {
  const currentSpecs = preview.current?.specs ?? {}
  const selectedCount = rows.filter((r) => r.selected).length
  const knownCount = rows.filter((r) => r.known).length

  const update = (index: number, patch: Partial<SpecRow>) =>
    onRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const toggleAll = (value: boolean) =>
    onRows(rows.map((row) => ({ ...row, selected: value })))

  if (!rows.length) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <SectionHeader title="Specificații" />
        <Text size="small" className="text-ui-fg-muted">
          N-am găsit o fișă tehnică în pagină.
        </Text>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <SectionHeader
        title="Specificații"
        hint={`${rows.length} găsite, ${knownCount} cu etichetă deja folosită la noi`}
        right={
          <div className="flex items-center gap-2">
            <Button size="small" variant="transparent" onClick={() => toggleAll(true)}>
              Toate
            </Button>
            <Button size="small" variant="transparent" onClick={() => toggleAll(false)}>
              Niciuna
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={mode} onValueChange={(v) => onMode(v as "merge" | "replace")}>
          <Select.Trigger className="w-64">
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="merge">Completează fișa existentă</Select.Item>
            <Select.Item value="replace">Înlocuiește toată fișa</Select.Item>
          </Select.Content>
        </Select>
        <Text size="small" className="text-ui-fg-muted">
          {mode === "merge"
            ? "Etichetele existente care nu vin acum rămân neatinse."
            : `Fișa actuală (${Object.keys(currentSpecs).length} etichete) se șterge complet.`}
        </Text>
      </div>

      {conflicting > 0 && (
        <Alert variant="warning">
          {conflicting}{" "}
          {conflicting === 1
            ? "etichetă are deja altă valoare la acest produs și va fi suprascrisă."
            : "etichete au deja alte valori la acest produs și vor fi suprascrise."}
        </Alert>
      )}

      {/* Lista de etichete folosite deja, ca sugestii la scriere. Un `datalist`
          în loc de 36 de select-uri: se poate și tasta o etichetă nouă. */}
      <datalist id={SPEC_LIST_ID}>
        {preview.vocabulary.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>

      <div className="flex flex-col divide-y rounded-md border">
        {rows.map((row, index) => {
          const currentValue = currentSpecs[row.target]
          const renamed = row.target !== row.sourceLabel
          return (
            <div
              key={`${row.sourceLabel}-${index}`}
              className={clx(
                "flex flex-col gap-2 p-3 md:flex-row md:items-center",
                !row.selected && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3 md:w-8">
                <Checkbox
                  checked={row.selected}
                  onCheckedChange={(v) => update(index, { selected: v === true })}
                />
              </div>

              {/* Eticheta primește mai mult loc decât valoarea: e câmp editabil,
                  iar denumirile lungi („Rezolutie camera principala") trebuie
                  citite întregi ca să poată fi corectate. */}
              <div className="flex min-w-0 flex-col gap-1 md:basis-1/2">
                <div className="flex items-center gap-2">
                  {/* Învelișul, nu `Input`-ul, primește `flex-1`: componenta din
                      @medusajs/ui randează un wrapper cu lățime automată, iar
                      clasa trimisă ei ajunge pe `<input>`-ul dinăuntru. */}
                  <div className="min-w-0 flex-1">
                    <Input
                      size="small"
                      className="w-full"
                      list={SPEC_LIST_ID}
                      value={row.target}
                      onChange={(e) => update(index, { target: e.target.value })}
                      disabled={!row.selected}
                    />
                  </div>
                  {row.known ? (
                    <Badge size="2xsmall" color="green">
                      {row.usage} produse
                    </Badge>
                  ) : (
                    <Badge size="2xsmall" color="orange">
                      etichetă nouă
                    </Badge>
                  )}
                </div>
                {renamed && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    în sursă: {row.sourceLabel}
                    {row.group ? ` · ${row.group}` : ""}
                  </Text>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col md:pl-2">
                <Text size="small" className="truncate text-ui-fg-base" title={row.value}>
                  {row.value}
                </Text>
                {currentValue !== undefined && currentValue !== row.value && (
                  <Text size="xsmall" className="truncate text-ui-fg-muted">
                    acum: {currentValue}
                  </Text>
                )}
                {currentValue !== undefined && currentValue === row.value && (
                  <Text size="xsmall" className="text-ui-fg-muted">
                    <CheckCircle className="inline" /> deja identică
                  </Text>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Text size="small" className="text-ui-fg-muted">
        {selectedCount} din {rows.length} bifate. Etichetele se pot rescrie —
        câmpul sugerează ce e deja folosit în magazin.
      </Text>
    </div>
  )
}

const ImagesSection = ({
  preview,
  selected,
  onSelected,
  thumbnail,
  onThumbnail,
}: {
  preview: ImportPreview
  selected: Set<string>
  onSelected: (next: Set<string>) => void
  thumbnail: boolean
  onThumbnail: (v: boolean) => void
}) => {
  if (!preview.images.length) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <SectionHeader title="Poze" />
        <Text size="small" className="text-ui-fg-muted">
          N-am găsit o galerie în pagină.
        </Text>
      </div>
    )
  }

  const toggle = (url: string) => {
    const next = new Set(selected)
    if (next.has(url)) next.delete(url)
    else next.add(url)
    onSelected(next)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <SectionHeader
        title="Poze"
        hint={`${preview.images.length} în galeria sursei · produsul are ${
          preview.current?.image_count ?? 0
        }`}
        right={
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="transparent"
              onClick={() => onSelected(new Set(preview.images))}
            >
              Toate
            </Button>
            <Button size="small" variant="transparent" onClick={() => onSelected(new Set())}>
              Niciuna
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
        {preview.images.map((url) => {
          const active = selected.has(url)
          return (
            <button
              key={url}
              type="button"
              onClick={() => toggle(url)}
              className={clx(
                "relative aspect-square overflow-hidden rounded-md border bg-ui-bg-subtle",
                active ? "border-ui-fg-interactive ring-2 ring-ui-fg-interactive" : "border-ui-border-base"
              )}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
              {active && (
                <div className="absolute right-1 top-1 rounded-full bg-ui-bg-base p-0.5 text-ui-fg-interactive">
                  <CheckCircle />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="import-thumbnail"
          checked={thumbnail}
          disabled={!selected.size}
          onCheckedChange={(v) => onThumbnail(v === true)}
        />
        <Label htmlFor="import-thumbnail">
          Pune prima poză bifată ca imagine principală
        </Label>
      </div>

      <Text size="small" className="text-ui-fg-muted">
        Pozele se adaugă la galeria existentă, nu o înlocuiesc. Se descarcă și
        se urcă în stocarea magazinului.
      </Text>
    </div>
  )
}

export default ProductImportPanel
