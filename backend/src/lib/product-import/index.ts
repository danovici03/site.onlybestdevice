/**
 * Extragerea unui produs dintr-o pagină de magazin.
 *
 * Trei surse, contopite în ordinea încrederii:
 *  1. adaptorul site-ului (eMAG…) — știe unde stau galeria și descrierea;
 *  2. JSON-LD `Product` — standard, dă marca, EAN-ul și fișa structurată;
 *  3. euristica generică — OpenGraph plus căutarea de tabele.
 *
 * Nu alegem o singură sursă, le COMBINĂM pe câmpuri: pe eMAG adaptorul are
 * descrierea, JSON-LD-ul are EAN-ul, iar fișele lor coincid — dar pe un site de
 * producător poate exista doar JSON-LD, sau doar un tabel. Regula e simplă:
 * primul care are ceva pe câmpul respectiv câștigă, iar la specificații
 * reunim listele (cea mai bogată dă ordinea, restul completează golurile).
 *
 * Ieșirea e deja sanitizată cu `sanitizeWooHtml` — adică exact prin filtrul
 * prin care au trecut și descrierile importate din WooCommerce, deci nu apare
 * un al doilea dialect de HTML în baza de date.
 */
import { sanitizeWooHtml, hasVisibleContent, stripEmptyBlocks } from "../woo-description"
import { absolutizeUrls, parseHtml } from "./html"
import { specKey, type SpecPair } from "./specs"
import { emag } from "./sources/emag"
import { generic } from "./sources/generic"
import { extractJsonLd } from "./sources/json-ld"
import type { RawExtraction, SourceAdapter } from "./sources/types"

/** Adaptoarele specifice, încercate în ordine. `generic` rulează mereu, la final. */
const ADAPTERS: SourceAdapter[] = [emag]

export type ExtractedProduct = {
  url: string
  /** Id-ul adaptorului care a dat structura („emag", „generic"). */
  source: string
  sourceLabel: string
  title?: string
  brand?: string
  ean?: string
  /** Codul de piesă al producătorului (Apple: „MFYM4ZD/A"), când există. */
  mpn?: string
  /** HTML sanitizat, gata de scris în `product.description`. */
  descriptionHtml: string
  /** Pozele care apar ÎN descriere (hotlinkate încă pe domeniul sursei). */
  descriptionImages: string[]
  /** Pozele de galerie, candidate pentru `product.images`. */
  images: string[]
  specs: SpecPair[]
  notes: string[]
}

const firstOf = <T>(...values: (T | undefined)[]): T | undefined =>
  values.find((v) => v !== undefined && v !== null && (typeof v !== "string" || v.trim() !== ""))

/** Reunește listele de specificații: cea mai lungă dă ordinea, restul completează. */
function mergeSpecs(lists: { label: string; value: string; group?: string }[][]): SpecPair[] {
  const ordered = [...lists].sort((a, b) => b.length - a.length)
  const seen = new Set<string>()
  const out: SpecPair[] = []

  for (const list of ordered) {
    for (const pair of list) {
      const key = specKey(pair.label)
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(pair)
    }
  }
  return out
}

/**
 * Aceeași poză apare de mai multe ori, în mărimi diferite.
 *
 * Pe eMAG galeria dă originalul (`…/res_f997….jpg`), iar JSON-LD-ul și
 * euristica generică dau redimensionări ale ACELEIAȘI poze
 * (`…/res_f997….jpg?width=450&hash=…`). Fără regula asta, operatorul ar vedea
 * de trei ori quad-ul albastru și ar urca de trei ori aceiași octeți în S3.
 *
 * Identitatea e calea fără parametri, iar dintre variante câștigă cea FĂRĂ
 * query — pe eMAG hash-ul e legat de dimensiune, deci varianta curată e
 * originalul la rezoluție maximă.
 */
const dedupeUrls = (urls: string[]): string[] => {
  const byPath = new Map<string, string>()
  const order: string[] = []

  for (const url of urls) {
    if (!url) continue
    let key = url
    let clean = false
    try {
      const parsed = new URL(url)
      key = parsed.origin + parsed.pathname
      clean = !parsed.search
    } catch {
      /* URL nevalid — rămâne cheia lui, se deduplică doar cu el însuși */
    }
    const existing = byPath.get(key)
    if (existing === undefined) {
      byPath.set(key, url)
      order.push(key)
      continue
    }
    if (clean && existing.includes("?")) byPath.set(key, url)
  }

  return order.map((key) => byPath.get(key)!)
}

/**
 * Textul simplu ca ultimă soluție de descriere.
 *
 * Newline-urile devin paragrafe — descrierea din JSON-LD e un bloc de text cu
 * `\n`, iar scrisă ca atare ar apărea în magazin ca un perete fără spații.
 */
const textToHtml = (text: string): string =>
  text
    .split(/\n{1,}/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`)
    .join("")

export function extractProduct(html: string, pageUrl: string): ExtractedProduct {
  const url = new URL(pageUrl)
  const root = parseHtml(html)

  // Întâi absolutizăm: adaptoarele citesc atribute și se așteaptă la URL-uri
  // gata de folosit, iar sanitizatorul aruncă orice nu e `http(s)://`.
  absolutizeUrls(root, pageUrl)

  const adapter = ADAPTERS.find((a) => a.matches(url))
  const site: Partial<RawExtraction> = adapter?.extract(root, url) ?? {}
  const fallback = generic.extract(root, url)
  const jsonLd = extractJsonLd(root)

  const rawDescription = firstOf(site.descriptionHtml, fallback.descriptionHtml)
  const rawText = firstOf(site.descriptionText, fallback.descriptionText, jsonLd?.description)

  const sanitized = sanitizeWooHtml(
    rawDescription && rawDescription.trim() ? rawDescription : textToHtml(rawText ?? ""),
    // Fără linkuri: descrierile copiate din alt magazin vin pline de trimiteri
    // înapoi la el. Aceeași regulă ca la importul din WooCommerce.
    { allowLinks: false }
  )

  const descriptionHtml = hasVisibleContent(sanitized.html)
    ? stripEmptyBlocks(sanitized.html)
    : ""

  const notes = [...(site.notes ?? []), ...(fallback.notes ?? [])]
  if (sanitized.droppedImages) {
    notes.push(`${sanitized.droppedImages} poze din descriere n-aveau sursă utilizabilă.`)
  }

  return {
    url: pageUrl,
    source: adapter?.id ?? generic.id,
    sourceLabel: adapter?.label ?? generic.label,
    title: firstOf(site.title, jsonLd?.name, fallback.title),
    brand: firstOf(site.brand, jsonLd?.brand, fallback.brand),
    ean: firstOf(site.ean, jsonLd?.ean, fallback.ean),
    mpn: jsonLd?.mpn,
    descriptionHtml,
    descriptionImages: sanitized.images,
    // Euristica generică intră la poze DOAR când adaptorul site-ului n-a găsit
    // galeria. Pe eMAG ea mai adună un thumbnail de clip și o poză de layout
    // din secțiunea de review-uri — zgomot pe care operatorul ar trebui să-l
    // debifeze de fiecare dată. Când adaptorul a livrat galeria, ea e completă.
    images: dedupeUrls(
      site.images?.length
        ? [...site.images, ...(jsonLd?.images ?? [])]
        : [...(jsonLd?.images ?? []), ...(fallback.images ?? [])]
    ),
    specs: mergeSpecs([site.specs ?? [], jsonLd?.specs ?? [], fallback.specs ?? []]),
    notes,
  }
}

export { specKey } from "./specs"
export type { SpecPair } from "./specs"
