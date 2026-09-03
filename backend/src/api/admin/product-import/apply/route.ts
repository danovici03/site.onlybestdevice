import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { rehostImages, rewriteDescriptionImages } from "../../../../lib/product-import/rehost"
import { hasVisibleContent, sanitizeWooHtml, stripEmptyBlocks } from "../../../../lib/woo-description"

/**
 * Scrie în produs ce a bifat operatorul în previzualizare.
 *
 *   POST /admin/product-import/apply
 *   { "product_id": "prod_…", "source_url": "https://www.emag.ro/…",
 *     "description": "<p>…</p>", "specs": { "Culoare": "Argintiu" },
 *     "specs_mode": "merge", "images": ["https://…jpg"] }
 *
 * Fiecare secțiune e opțională și independentă: se poate importa doar fișa
 * tehnică, doar pozele, doar descrierea. Ce nu vine în body nu se atinge.
 *
 * Pozele se aduc în stocarea noastră (vezi `rehost.ts`) — și cele din galerie,
 * și cele din descriere. Descrierea se rescrie cu URL-urile noastre, deci după
 * import produsul nu mai depinde de CDN-ul magazinului sursă.
 *
 * Descrierea trece prin `sanitizeWooHtml` ÎNCĂ O DATĂ aici, chiar dacă
 * previzualizarea a sanitizat-o deja: între cele două apeluri stă browserul
 * operatorului, iar ce vine pe un POST nu e neapărat ce a trimis ruta de
 * preview.
 */

type Body = {
  product_id?: string
  /** Pagina sursă — se trimite ca `Referer` la descărcarea pozelor. */
  source_url?: string
  description?: string | null
  specs?: Record<string, string> | null
  /** `merge` (implicit) păstrează etichetele existente care nu vin acum. */
  specs_mode?: "merge" | "replace"
  images?: string[]
  /** Pune prima poză importată ca imagine principală. */
  set_thumbnail?: boolean
}

const MAX_IMAGES = 24

export const POST = async (req: MedusaRequest<Body>, res: MedusaResponse) => {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const body = req.body ?? {}

  if (!body.product_id) {
    return res.status(400).json({ error: "`product_id` lipsește" })
  }

  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "description", "thumbnail", "metadata", "images.url"],
    filters: { id: body.product_id },
  })
  const product = data?.[0]
  if (!product) {
    return res.status(404).json({ error: "Produsul nu există" })
  }

  const galleryUrls = (body.images ?? []).filter(Boolean).slice(0, MAX_IMAGES)

  // Descrierea: sanitizată întâi, ca lista de poze de adus să fie exact cea
  // care supraviețuiește filtrului — nu descărcăm poze pe care le-am arunca.
  let description: string | null = null
  let descriptionImages: string[] = []
  if (typeof body.description === "string") {
    const sanitized = sanitizeWooHtml(body.description, { allowLinks: false })
    description = hasVisibleContent(sanitized.html) ? stripEmptyBlocks(sanitized.html) : ""
    descriptionImages = sanitized.images
  }

  const { map, failures } = await rehostImages(
    req.scope,
    [...descriptionImages, ...galleryUrls],
    { referer: body.source_url, ourFileUrl: process.env.S3_FILE_URL }
  )

  if (description) {
    description = rewriteDescriptionImages(description, map)
    if (!hasVisibleContent(description)) description = ""
  }

  const update: Record<string, unknown> = { id: product.id }
  const report = {
    description_updated: false,
    specs_written: 0,
    images_added: 0,
    thumbnail_set: false,
    failures,
  }

  if (description !== null) {
    update.description = description
    report.description_updated = true
  }

  if (body.specs && Object.keys(body.specs).length) {
    const existing = (product.metadata as Record<string, unknown> | null)?.specs
    const previous =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? (existing as Record<string, string>)
        : {}
    // La `merge`, valorile noi bat pe cele vechi pentru aceeași etichetă —
    // operatorul a bifat explicit ce importă, deci alegerea lui e mai proaspătă.
    const specs = body.specs_mode === "replace" ? { ...body.specs } : { ...previous, ...body.specs }
    // `metadata` se scrie prin merge la nivelul cheilor de sus (comportament
    // Medusa), deci restul metadatelor produsului (`filter_*`, `phone_siblings`)
    // rămân neatinse — trimitem doar cheia `specs`.
    update.metadata = { specs }
    report.specs_written = Object.keys(specs).length
  }

  const rehostedGallery = galleryUrls.map((url) => map.get(url)).filter((u): u is string => !!u)
  if (rehostedGallery.length) {
    // `images` e un vector complet la scriere: ce nu retrimiți dispare. De aceea
    // pornim de la pozele existente și adăugăm la coadă (aceeași capcană ca la
    // `prices` — vezi lib/pricing.ts).
    const current = (product.images ?? []).map((img: { url: string }) => img.url)
    const merged = [...current]
    for (const url of rehostedGallery) {
      if (!merged.includes(url)) merged.push(url)
    }
    if (merged.length !== current.length) {
      update.images = merged.map((url) => ({ url }))
      report.images_added = merged.length - current.length
    }
    if (body.set_thumbnail && rehostedGallery[0]) {
      update.thumbnail = rehostedGallery[0]
      report.thumbnail_set = true
    }
  }

  const touchesProduct = Object.keys(update).length > 1
  if (touchesProduct) {
    await updateProductsWorkflow(req.scope).run({ input: { products: [update as any] } })
  }

  logger.info(
    `[product-import] ${product.id}: ` +
      `descriere ${report.description_updated ? "scrisă" : "neatinsă"}, ` +
      `${report.specs_written} specificații, ${report.images_added} poze noi, ` +
      `${failures.length} poze ratate.`
  )

  return res.json(report)
}
