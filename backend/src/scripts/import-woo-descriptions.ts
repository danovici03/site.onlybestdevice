/**
 * Readuce pozele în descrierile importate din WooCommerce.
 *
 * Importul inițial (`import-woocommerce.ts`) trecea descrierea prin `stripHtml`,
 * deci a păstrat doar textul: cele ~5.900 de imagini din descrieri (galeriile
 * „rich description" copiate de pe eMAG, Altex, site-urile producătorilor) s-au
 * pierdut. Scriptul ăsta ia HTML-ul din exportul WooCommerce, îl trece prin
 * `sanitizeWooHtml` (vezi `src/lib/woo-description.ts`) și îl scrie înapoi în
 * `product.description`, pentru produsele DEJA existente în Medusa.
 *
 * De ce în `description` și nu în `metadata`: listările de produse cer
 * `+metadata` (storefront/src/lib/data/products.ts), deci orice blob pus acolo
 * ar călători cu fiecare pagină de magazin. Descrierea e oricum câmp implicit,
 * iar storefront-ul o randează ca HTML doar pe pagina de produs.
 *
 * Siguranță:
 *  - implicit NU scrie nimic, doar raportul (`woo-descriptions-report.csv`);
 *  - sare peste produsele a căror descriere actuală nu mai seamănă cu textul
 *    din WooCommerce (semn că a fost editată manual în Admin) — `FORCE=1` le
 *    rescrie și pe alea;
 *  - sare peste produsele unde sanitizarea nu lasă nimic vizibil (descrieri
 *    care erau strict fișă de specificații — acelea trăiesc în `metadata.specs`);
 *  - idempotent: la a doua rulare totul iese „neschimbat".
 *
 * Rulare:
 *   cd backend && yarn medusa exec ./src/scripts/import-woo-descriptions.ts
 *   APPLY=1 ...                     scrie în baza de date
 *   CHECK_IMAGES=1 ...              cere fiecare poză și le scoate pe cele moarte
 *   ONLY=handle-1,handle-2 ...      doar produsele astea (verificare punctuală)
 *   FORCE=1 ...                     rescrie și descrierile editate manual
 *   WC_EXPORT=/cale/altfel.json     alt fișier de export
 *   CHECK_CONCURRENCY=24            câte poze se verifică în paralel
 */
import fs from "node:fs"
import path from "node:path"
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import {
  dropImages,
  hasVisibleContent,
  htmlToText,
  normLabel,
  sanitizeWooHtml,
} from "../lib/woo-description"

const EXPORT_PATH =
  process.env.WC_EXPORT ||
  path.join(process.cwd(), "../migration/data/wc-export.json")
const APPLY = !!process.env.APPLY
const FORCE = !!process.env.FORCE
const ONLY = (process.env.ONLY || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
const CHECK_IMAGES = !!process.env.CHECK_IMAGES
const CHECK_CONCURRENCY = Number(process.env.CHECK_CONCURRENCY || "24")

/**
 * Cere fiecare URL o dată și ține minte verdictul. La ultima verificare, 77 din
 * 2.839 de poze erau moarte la sursă (mai ales linkuri Apple vechi).
 */
async function findDeadImages(urls: string[]): Promise<Set<string>> {
  const unique = [...new Set(urls)]
  const dead = new Set<string>()

  const worker = async (queue: string[]) => {
    for (const url of queue) {
      try {
        const signal = AbortSignal.timeout(15_000)
        let res = await fetch(url, { method: "HEAD", signal })
        // Unele CDN-uri refuză HEAD; reîncercăm cu un GET de câțiva octeți.
        if (res.status === 403 || res.status === 405) {
          res = await fetch(url, { headers: { range: "bytes=0-100" }, signal })
        }
        if (res.status !== 200 && res.status !== 206) dead.add(url)
      } catch {
        dead.add(url)
      }
    }
  }

  const n = Math.max(1, CHECK_CONCURRENCY)
  await Promise.all(
    Array.from({ length: n }, (_, i) =>
      worker(unique.filter((_, j) => j % n === i))
    )
  )
  return dead
}

type WcProduct = { slug?: string; name?: string; description?: string }
type DbProduct = {
  id: string
  handle: string
  title: string
  description?: string | null
  metadata?: Record<string, unknown> | null
}

/** Comparație „e același text?", tolerantă la punctuație și diacritice. */
const fingerprint = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * Descrierea din baza de date mai e cea importată din WooCommerce, sau a fost
 * editată în Admin? Textul din DB a trecut prin `stripHtml` și, la unele
 * produse, prin `extract-product-specs.ts` (care taie fișa de specificații),
 * deci nu e identic cu sursa — dar rămâne un fragment din ea.
 */
function looksUntouched(dbDescription: string, wcHtml: string): boolean {
  // `htmlToText` și pe descrierea din baza de date: după prima rulare acolo e
  // HTML, iar altfel numele de tag-uri și URL-urile pozelor ar strica potrivirea
  // (și fiecare rulare ar raporta tot catalogul ca „editat manual").
  const db = fingerprint(htmlToText(dbDescription))
  if (!db) return true // descriere goală: nu avem ce pierde

  const wc = fingerprint(htmlToText(wcHtml))
  if (!wc) return false

  if (wc.includes(db) || db.includes(wc)) return true

  // Fișa de specificații scoasă din DB rupe includerea; comparăm pe cuvinte.
  const wcWords = new Set(wc.split(" "))
  const dbWords = db.split(" ")
  const common = dbWords.filter((w) => wcWords.has(w)).length
  return common / dbWords.length >= 0.9
}

export default async function importWooDescriptions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  if (!fs.existsSync(EXPORT_PATH)) {
    logger.error(`Lipsește exportul WooCommerce: ${EXPORT_PATH}`)
    return
  }

  const exp = JSON.parse(fs.readFileSync(EXPORT_PATH, "utf8")) as {
    products: WcProduct[]
  }
  const bySlug = new Map<string, WcProduct>()
  for (const p of exp.products || []) {
    if (p.slug) bySlug.set(p.slug, p)
  }

  const { data: all } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "description", "metadata"],
    pagination: { take: 5000, skip: 0 },
  } as any)
  const products = (all as DbProduct[]).filter(
    (p) => !ONLY.length || ONLY.includes(p.handle)
  )

  const rows = [
    "handle;stare;lungime_veche;lungime_noua;imagini;fise_spec_scoase;tabele_desfacute",
  ]
  let updated = 0
  let unchanged = 0
  let noMatch = 0
  let edited = 0
  let emptied = 0
  let totalImages = 0

  // Sanitizarea întâi pentru tot catalogul: verificarea pozelor are nevoie de
  // lista completă de URL-uri, ca să ceară fiecare adresă o singură dată.
  const pending: { product: DbProduct; res: ReturnType<typeof sanitizeWooHtml> }[] = []

  for (const p of products) {
    // Duplicatele făcute din Admin primesc sufixul „-copie"; sursa lor e tot
    // produsul original din WooCommerce.
    const wc =
      bySlug.get(p.handle) ||
      bySlug.get(p.handle.replace(/-copie(-\d+)?$/, "")) ||
      null

    if (!wc?.description?.trim()) {
      noMatch++
      continue
    }

    const current = p.description || ""
    if (!FORCE && !looksUntouched(current, wc.description)) {
      edited++
      rows.push(`${p.handle};editat-manual;${current.length};;;;`)
      continue
    }

    const specs = (p.metadata?.specs ?? null) as Record<string, string> | null
    const specLabels = specs
      ? new Set(Object.keys(specs).map((k) => normLabel(k)))
      : undefined

    const res = sanitizeWooHtml(wc.description, { specLabels })

    if (!hasVisibleContent(res.html)) {
      // Descrierea era strict fișă de specificații — o lăsăm cum e.
      emptied++
      rows.push(`${p.handle};fara-continut;${current.length};0;0;${res.droppedSpecTables};0`)
      continue
    }

    pending.push({ product: p, res })
  }

  let deadImages = new Set<string>()
  if (CHECK_IMAGES) {
    const urls = pending.flatMap((x) => x.res.images)
    logger.info(`Verific ${new Set(urls).size} URL-uri de imagini...`)
    deadImages = await findDeadImages(urls)
    logger.info(`Poze moarte la sursă: ${deadImages.size} — se scot din descrieri.`)
  }

  let removedImages = 0

  for (const { product: p, res } of pending) {
    let html = res.html
    let images = res.images.length

    if (deadImages.size) {
      const cleaned = dropImages(html, (src) => deadImages.has(src))
      html = cleaned.html
      images -= cleaned.removed
      removedImages += cleaned.removed
    }

    const current = p.description || ""
    if (html === current) {
      unchanged++
      continue
    }
    if (!hasVisibleContent(html)) {
      emptied++
      continue
    }

    totalImages += images
    rows.push(
      `${p.handle};${APPLY ? "actualizat" : "de-actualizat"};${current.length};` +
        `${html.length};${images};${res.droppedSpecTables};${res.unwrappedTables}`
    )

    if (APPLY) {
      await updateProductsWorkflow(container).run({
        input: { selector: { id: p.id }, update: { description: html } as any },
      })
    }
    updated++
  }

  const out = path.join(process.cwd(), "woo-descriptions-report.csv")
  fs.writeFileSync(out, rows.join("\n"), "utf8")

  const prefix = APPLY ? "" : "[DRY-RUN] "
  logger.info(
    `${prefix}Descrieri de rescris: ${updated} (cu ${totalImages} imagini), ` +
      `neschimbate: ${unchanged}.`
  )
  logger.info(
    `${prefix}Sărite — fără corespondent în export: ${noMatch}, editate manual: ${edited}` +
      `${edited && !FORCE ? " (FORCE=1 le rescrie)" : ""}, ` +
      `rămase fără conținut după curățare: ${emptied}.`
  )
  if (CHECK_IMAGES) {
    logger.info(`${prefix}Poze moarte scoase din descrieri: ${removedImages}.`)
  } else {
    logger.info(
      "Pozele NU au fost verificate — CHECK_IMAGES=1 le cere pe rând și le scoate " +
        "pe cele moarte la sursă."
    )
  }
  logger.info(`Raport: ${out}`)
  if (!APPLY) {
    logger.info("Nimic scris în baza de date. Rulează cu APPLY=1 după ce verifici raportul.")
  }
}
