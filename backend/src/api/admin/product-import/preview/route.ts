import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { extractProduct } from "../../../../lib/product-import"
import { fetchPage, PageFetchError } from "../../../../lib/product-import/fetch-page"
import { loadVocabulary, mapSpecs } from "../../../../lib/product-import/vocabulary"
import { htmlToText } from "../../../../lib/woo-description"

/**
 * Citește o pagină de produs de pe alt site și arată ce s-ar putea importa.
 *
 *   POST /admin/product-import/preview
 *   { "url": "https://www.emag.ro/…/pd/D499FV3BM/", "product_id": "prod_…" }
 *
 * NU scrie nimic. Toată decizia e a operatorului, în modalul din Admin: ruta
 * doar extrage, mapează etichetele pe vocabularul nostru și spune ce ar
 * suprascrie.
 *
 * `html` în locul lui `url`: unele magazine refuză cererile venite din
 * datacenter (403), caz în care operatorul deschide pagina în browserul lui,
 * salvează sursa și o lipește. `url` rămâne obligatoriu și atunci — din el se
 * rezolvă adresele relative ale pozelor.
 */

type Body = {
  url?: string
  /** Sursa paginii, lipită de operator când `fetch`-ul e refuzat. */
  html?: string
  /** Produsul în care s-ar importa — doar ca să arătăm ce s-ar suprascrie. */
  product_id?: string
}

/** Peste atât, e altceva decât o pagină de produs lipită. */
const MAX_PASTED_HTML = 6 * 1024 * 1024

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const url = req.body?.url?.trim()
  const pasted = req.body?.html

  if (!url) {
    return res.status(400).json({ error: "`url` lipsește" })
  }
  if (pasted && pasted.length > MAX_PASTED_HTML) {
    return res.status(400).json({ error: "HTML-ul lipit e prea mare (peste 6 MB)" })
  }

  let html: string
  let finalUrl = url
  try {
    if (pasted?.trim()) {
      html = pasted
    } else {
      const page = await fetchPage(url)
      html = page.html
      finalUrl = page.url
    }
  } catch (err) {
    if (err instanceof PageFetchError) {
      return res.status(422).json({
        error: err.message,
        can_paste_html: err.canPasteHtml,
      })
    }
    throw err
  }

  let extracted: ReturnType<typeof extractProduct>
  try {
    extracted = extractProduct(html, finalUrl)
  } catch (err) {
    logger.warn(`[product-import] extragere eșuată pentru ${finalUrl}: ${(err as Error).message}`)
    return res.status(422).json({ error: "N-am putut citi pagina — structura ei nu seamănă cu o pagină de produs." })
  }

  const vocabulary = await loadVocabulary(req.scope)
  const specs = mapSpecs(extracted.specs, vocabulary)

  // Ce are produsul acum — ca operatorul să vadă ce ar suprascrie, nu doar ce
  // ar adăuga. Fără asta, „Importă" pe un produs deja completat e un pariu.
  let current: {
    title: string
    has_description: boolean
    description_chars: number
    specs: Record<string, string>
    image_count: number
  } | null = null

  if (req.body?.product_id) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title", "description", "metadata", "images.id"],
      filters: { id: req.body.product_id },
    })
    const product = data?.[0]
    if (product) {
      const existingSpecs = (product.metadata as any)?.specs
      current = {
        title: product.title,
        has_description: !!product.description?.trim(),
        description_chars: product.description?.length ?? 0,
        specs:
          existingSpecs && typeof existingSpecs === "object" && !Array.isArray(existingSpecs)
            ? existingSpecs
            : {},
        image_count: product.images?.length ?? 0,
      }
    }
  }

  return res.json({
    url: finalUrl,
    source: extracted.source,
    source_label: extracted.sourceLabel,
    title: extracted.title ?? null,
    brand: extracted.brand ?? null,
    ean: extracted.ean ?? null,
    mpn: extracted.mpn ?? null,
    description: {
      html: extracted.descriptionHtml,
      text: htmlToText(extracted.descriptionHtml).slice(0, 600),
      chars: extracted.descriptionHtml.length,
      image_count: extracted.descriptionImages.length,
    },
    images: extracted.images,
    specs,
    // Vocabularul, ca modalul să poată oferi maparea manuală pentru
    // etichetele nepotrivite automat („Rezolutie (pixeli)" → „Rezolutie").
    // Ordonat după cât de folosite sunt: primele sugestii sunt cele de casă.
    vocabulary: [...vocabulary.values()]
      .sort((a, b) => b.usage - a.usage || a.label.localeCompare(b.label, "ro"))
      .slice(0, 400)
      .map((entry) => entry.label),
    current,
    notes: extracted.notes,
  })
}
