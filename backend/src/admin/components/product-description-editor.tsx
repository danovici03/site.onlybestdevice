import { DocumentText, PencilSquare } from "@medusajs/icons"
import { AdminProduct } from "@medusajs/types"
import {
  Alert,
  Button,
  Container,
  FocusModal,
  Heading,
  Prompt,
  Text,
  clx,
  toast,
} from "@medusajs/ui"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { htmlToText } from "../../lib/woo-description"
import { hideSectionRow } from "../lib/hide-section-row"
import {
  DescriptionConflictError,
  fetchProductDescription,
  sanitizeDescription,
  saveProductDescription,
} from "../lib/product-description"
import RichTextEditor from "./rich-text-editor"

/**
 * Descrierea produsului: previzualizare în pagină, editor în modal.
 *
 * Descrierile importate din WooCommerce sunt HTML cu galerii de poze, iar
 * câmpul nativ le arată ca text — un perete de markup care umple ecranul.
 * Widgetul îl înlocuiește: ascunde rândul nativ, arată începutul descrierii
 * așa cum va apărea în magazin, iar editarea se face pe tot ecranul.
 */

/**
 * Markup pe care editorul nu-l modelează și l-ar aplatiza la primul salvat.
 * Listele de definiții apar în 6 produse, `figcaption` în niciunul — dar dacă
 * apar, se editează pe HTML brut, nu le pierdem.
 */
const NEEDS_HTML_MODE = /<(dl|dt|dd|figcaption)\b/i

/**
 * Clientul react-query al dashboard-ului, dacă widgetul chiar rulează în
 * arborele lui. Îl folosim doar ca să împrospătăm pagina după salvare, deci
 * lipsa lui nu justifică un widget care crapă.
 */
const useOptionalQueryClient = () => {
  try {
    return useQueryClient()
  } catch {
    return null
  }
}

const ProductDescriptionEditor = ({ product }: { product: AdminProduct }) => {
  const { t } = useTranslation()
  const queryClient = useOptionalQueryClient()

  /** Descrierea așa cum e pe server. */
  const [saved, setSaved] = useState(product.description ?? "")
  /** Ce se editează acum, în modal. */
  const [draft, setDraft] = useState(product.description ?? "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [discarding, setDiscarding] = useState(false)

  /**
   * Toate variantele de descriere pe care le-am văzut. Rândul nativ se
   * potrivește după text, iar textul se schimbă la fiecare salvare. Descrierea
   * goală apare în pagină ca „-”, deci o ținem minte sub forma aia.
   */
  const known = useRef(new Set<string>())
  const remember = useCallback((value: string) => {
    known.current.add(value.trim() || "-")
  }, [])
  if (!known.current.size) {
    remember(product.description ?? "")
  }

  useEffect(() => {
    let cancelled = false
    // Citim de la server, nu din prop: widgetul primește produsul de la
    // încărcarea paginii, iar scrierile noastre nu trec prin cache-ul lui.
    fetchProductDescription(product.id)
      .then((current) => {
        if (cancelled) return
        remember(current)
        setSaved(current)
        setDraft(current)
      })
      .catch((err: Error) => {
        if (!cancelled) toast.error(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [product.id, remember])

  // Eticheta vine din i18n-ul dashboard-ului, dar dacă extensia n-ar prinde
  // instanța lui, `t` întoarce cheia — de aceea și variantele scrise de mână.
  useEffect(
    () =>
      hideSectionRow(
        [t("fields.description"), "Descriere", "Description"],
        (text) => known.current.has(text.trim())
      ),
    [t]
  )

  const persist = useCallback(
    async (force: boolean) => {
      setSaving(true)
      try {
        const written = await saveProductDescription(product.id, draft, {
          expectedCurrent: saved,
          force,
        })
        remember(written)
        setSaved(written)
        setDraft(written)
        setOpen(false)
        toast.success(
          written === draft
            ? "Descriere salvată"
            : "Descriere salvată (markup-ul neacceptat a fost curățat)"
        )
        // Fără invalidare, restul paginii (panoul JSON, metadata) ar rămâne pe
        // descrierea veche până la un refresh din browser.
        queryClient?.invalidateQueries({ queryKey: ["products"] })
      } catch (err: any) {
        if (err instanceof DescriptionConflictError) {
          setConflict(true)
        } else {
          toast.error(err.message || "Eroare la salvare")
        }
      } finally {
        setSaving(false)
      }
    },
    [draft, product.id, queryClient, remember, saved]
  )

  const dirty = draft !== saved

  const requestClose = () => {
    if (dirty) {
      setDiscarding(true)
      return
    }
    setOpen(false)
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <DocumentText />
          <Heading level="h2">Descriere</Heading>
        </div>
        <Button
          size="small"
          variant="secondary"
          disabled={loading}
          onClick={() => {
            setDraft(saved)
            setOpen(true)
          }}
        >
          <PencilSquare />
          Editează
        </Button>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <Text size="small" className="text-ui-fg-subtle">
            Se încarcă…
          </Text>
        ) : (
          <DescriptionPreview html={saved} />
        )}
      </div>

      <FocusModal
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : requestClose())}
      >
        <FocusModal.Content>
          <FocusModal.Header>
            <div className="flex w-full items-center justify-between gap-4">
              <FocusModal.Title asChild>
                <Heading level="h2">Descrierea produsului</Heading>
              </FocusModal.Title>
              {/* Radix cere o descriere pentru cititoarele de ecran. */}
              <FocusModal.Description className="sr-only">
                Editorul descrierii afișate în pagina produsului din magazin.
              </FocusModal.Description>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  type="button"
                  onClick={requestClose}
                >
                  Renunță
                </Button>
                <Button
                  size="small"
                  type="button"
                  isLoading={saving}
                  disabled={!dirty}
                  onClick={() => persist(false)}
                >
                  Salvează
                </Button>
              </div>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-col gap-4 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
              <Text size="small" className="text-ui-fg-subtle">
                {product.title}
              </Text>

              {NEEDS_HTML_MODE.test(saved) && (
                <Alert variant="warning">
                  Descrierea conține liste de definiții sau legende de imagine,
                  pe care editorul vizual nu le poate reda — de aceea se
                  deschide pe HTML brut. Comutatorul <code>&lt;/&gt;</code> te
                  duce în editor, dar formatările astea se vor pierde.
                </Alert>
              )}

              {open && (
                <RichTextEditor
                  value={draft}
                  onChange={setDraft}
                  disabled={saving}
                  initialHtmlMode={NEEDS_HTML_MODE.test(saved)}
                  minHeight="28rem"
                />
              )}

              <Text size="small" className="text-ui-fg-subtle">
                Pozele urcate ajung în stocarea magazinului; cele lipite după
                URL rămân găzduite la sursă și pot dispărea dacă sursa le
                șterge. La salvare, HTML-ul e curățat automat: rămân doar text,
                titluri, liste, poze și linkuri.
              </Text>
            </div>
          </FocusModal.Body>
        </FocusModal.Content>
      </FocusModal>

      <Prompt open={conflict} onOpenChange={setConflict}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Descrierea s-a schimbat între timp</Prompt.Title>
            <Prompt.Description>
              Altcineva (sau alt tab) a salvat descrierea acestui produs după ce
              ai deschis pagina. Dacă salvezi, versiunea lor se pierde.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Renunță</Prompt.Cancel>
            <Prompt.Action
              onClick={() => {
                setConflict(false)
                void persist(true)
              }}
            >
              Suprascrie
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      <Prompt open={discarding} onOpenChange={setDiscarding}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Renunți la modificări?</Prompt.Title>
            <Prompt.Description>
              Ai modificări nesalvate în descriere. Dacă închizi editorul, se
              pierd.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Înapoi la editor</Prompt.Cancel>
            <Prompt.Action
              onClick={() => {
                setDiscarding(false)
                setDraft(saved)
                setOpen(false)
              }}
            >
              Renunță
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

/**
 * Începutul descrierii, randat ca în magazin și tăiat după câteva rânduri.
 *
 * Randăm HTML-ul, nu textul: cu poze și subtitluri se vede dintr-o privire
 * dacă descrierea e cea bună. Trece încă o dată prin sanitizator — în baza de
 * date ajunge deja curat, dar previzualizarea nu e locul unde vrem să aflăm
 * că altcineva a scris altceva prin API.
 */
const DescriptionPreview = ({ html }: { html: string }) => {
  const clean = useMemo(() => sanitizeDescription(html), [html])
  const images = useMemo(() => (clean.match(/<img\b/g) || []).length, [clean])
  const characters = useMemo(() => htmlToText(clean).length, [clean])

  if (!clean) {
    return (
      <Text size="small" className="text-ui-fg-muted">
        Produsul n-are descriere.
      </Text>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={clx(
          "max-h-40 overflow-hidden text-ui-fg-subtle",
          "[mask-image:linear-gradient(to_bottom,#000_60%,transparent_100%)]",
          "[&_p]:my-1 [&_p]:text-sm",
          "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ui-fg-base",
          "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ui-fg-base",
          "[&_strong]:text-ui-fg-base",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:text-sm",
          "[&_figure]:my-2 [&_img]:max-h-24 [&_img]:w-auto [&_img]:rounded-md"
        )}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      <Text size="small" className="text-ui-fg-muted">
        {characters.toLocaleString("ro-RO")} caractere
        {images ? ` · ${images} ${images === 1 ? "poză" : "poze"}` : ""}
      </Text>
    </div>
  )
}

export default ProductDescriptionEditor
