/**
 * Extragerea cu model, pentru paginile pe care euristica le ratează.
 *
 * NU înlocuiește `extractProduct` — rulează DUPĂ el și doar când ce-a ieșit e
 * prea subțire (fără fișă, fără poze, fără descriere). Pe eMAG adaptorul scoate
 * 23 de specificații și 10 poze fără să coste nimic; ar fi risipă să întrebăm
 * modelul. Pe site-ul unui producător mic, fără JSON-LD și fără tabele, el e
 * singura variantă în afară de a scrie un adaptor nou pentru un site pe care
 * îl atingem o dată pe an.
 *
 * ═══ Regula care ține feature-ul onest ═══
 *
 * Un model care citește HTML poate inventa: un URL de poză plauzibil, o valoare
 * „Rezolutie: 1920x1080" care sună bine dar nu scrie nicăieri în pagină. De
 * aceea NIMIC din ce întoarce nu ajunge la operator neverificat:
 *
 *  - pozele trebuie să apară în HTML-ul sursă, comparate ca URL absolut — și
 *    cele din galerie, și cele din descriere (`collectPageUrls`);
 *  - valorile din fișă trebuie să apară în textul paginii (`keepGrounded`);
 *  - descrierea trece printr-un test de propoziții — dacă prea puține din ea
 *    se regăsesc în pagină, e rescrisă de model, nu copiată, și o aruncăm.
 *
 * Ce cade la verificare se numără în `notes` și operatorul vede în modal că
 * s-a aruncat ceva. Un model care halucinează devine astfel un model care
 * întoarce mai puțin, nu unul care umple magazinul cu date inventate.
 */
import Anthropic from "@anthropic-ai/sdk"

import { htmlToText } from "../woo-description"
import type { SpecPair } from "./specs"

/** Implicit Opus 5. Se schimbă din env fără atins codul (ex. `claude-haiku-4-5`). */
const DEFAULT_MODEL = "claude-opus-5"

/**
 * Peste atât, HTML-ul curățat nu mai încape rezonabil într-o cerere.
 *
 * Nu tăiem pagina — trecem pe o reprezentare mai săracă (text + lista de poze),
 * care e completă în felul ei. O pagină tăiată la jumătate ar da o fișă tăiată
 * la jumătate, fără ca cineva să afle de ce.
 */
const MAX_HTML_CHARS = 600_000

/**
 * Bugetul de ieșire.
 *
 * Generos pentru că pe Opus 5 gândirea se scade din același buget: o fișă de 30
 * de rânduri plus descrierea, pornite după o gândire lungă, ar atinge un plafon
 * mic, iar răspunsul s-ar opri la jumătatea JSON-ului. Cererea e oricum pe
 * stream, deci un plafon mare nu riscă timeout de HTTP.
 */
const MAX_OUTPUT_TOKENS = 64_000

/**
 * Plafonul reprezentării reduse.
 *
 * `MAX_HTML_CHARS` doar schimbă forma; fără plafonul ăsta, o pagină lipită de 6
 * MB (cât acceptă ruta de preview) ar pleca întreagă spre model — sute de mii
 * de tokeni și câțiva dolari pe o singură apăsare de buton. Peste, refuzăm cu
 * un mesaj clar, nu tăiem pe tăcute.
 */
const MAX_REDUCED_CHARS = 400_000

/** Peste atât, cererea se oprește singură (SDK-ul are implicit 10 minute). */
const REQUEST_TIMEOUT_MS = 180_000

/** Valorile acceptate de `output_config.effort`. */
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const
type Effort = (typeof EFFORT_LEVELS)[number]

export type AiExtraction = {
  model: string
  title?: string
  brand?: string
  ean?: string
  mpn?: string
  /** HTML brut (NEsanitizat) — trece prin `sanitizeWooHtml` la apelant. */
  descriptionHtml?: string
  images: string[]
  specs: SpecPair[]
  notes: string[]
  usage: { input: number; output: number }
}

/** Ce întoarce modelul, înainte de verificări. */
type ModelOutput = {
  title: string | null
  brand: string | null
  ean: string | null
  mpn: string | null
  description_html: string | null
  images: string[]
  specs: { label: string; value: string; group: string | null }[]
  notes: string[]
}

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: ["string", "null"], description: "Numele produsului, exact cum apare în pagină." },
    brand: { type: ["string", "null"] },
    ean: { type: ["string", "null"], description: "Cod EAN/GTIN de 8-14 cifre, doar dacă scrie în pagină." },
    mpn: { type: ["string", "null"], description: "Codul de piesă al producătorului." },
    description_html: {
      type: ["string", "null"],
      description:
        "Descrierea comercială, COPIATĂ din pagină, ca HTML simplu: <p>, <ul>, <li>, <strong>, <h3>, <img src>. Fără linkuri, fără atribute de stil, fără meniuri sau text de subsol.",
    },
    images: {
      type: "array",
      description: "URL-urile absolute ale pozelor de produs, copiate literal din pagină. Fără logo-uri, iconițe, bannere sau poze de review.",
      items: { type: "string" },
    },
    specs: {
      type: "array",
      description: "Fișa tehnică. Valorile se copiază exact cum scriu în pagină.",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          group: { type: ["string", "null"], description: "Antetul secțiunii, dacă fișa e grupată." },
        },
        required: ["label", "value", "group"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "array",
      description: "Avertismente scurte pentru operator (descriere tradusă automat, fișă incompletă, pagină de listare în loc de produs).",
      items: { type: "string" },
    },
  },
  required: ["title", "brand", "ean", "mpn", "description_html", "images", "specs", "notes"],
  additionalProperties: false,
} as const

const SYSTEM = `Ești un extractor de date de produs pentru un magazin online din România.
Primești sursa unei pagini de produs de pe alt site și întorci datele structurate.

Reguli absolute:
- COPIEZI, nu compui. Fiecare valoare din fișă și fiecare frază din descriere trebuie să existe deja în pagină, cuvânt cu cuvânt.
- Dacă un câmp nu apare în pagină, îl lași null sau lista goală. Nu deduci, nu completezi din ce știi despre produs, nu traduci.
- URL-urile pozelor se copiază caracter cu caracter din sursă, exact în forma din pagină (relativă sau absolută). Nu construiești, nu ghicești variante de dimensiune.
- Iei doar pozele produsului: nu logo-uri, iconițe de plată, bannere de campanie, avatare din review-uri sau poze de la „produse similare".
- Descrierea e doar blocul comercial al produsului: fără meniuri, breadcrumb, preț, stoc, livrare, review-uri, subsol.
- Etichetele fișei rămân cum scriu în pagină. Maparea pe vocabularul magazinului se face separat.`

export const aiExtractionEnabled = (): boolean =>
  !!process.env.ANTHROPIC_API_KEY && process.env.PRODUCT_IMPORT_AI !== "off"

/**
 * Merită chemat modelul?
 *
 * Condiția e SAU, nu ȘI: o pagină cu fișă completă dar cu descrierea de trei
 * rânduri tot ajunge la model, ca să încerce să o găsească. Pe o pagină eMAG
 * normală nu se ajunge — adaptorul dă și fișa, și galeria, și descrierea — dar
 * un produs eMAG fără descriere e un caz real, nu unul imposibil.
 */
export const isThinExtraction = (e: {
  descriptionHtml: string
  images: string[]
  specs: unknown[]
}): boolean => e.specs.length === 0 || e.images.length < 2 || e.descriptionHtml.length < 200

/** Normalizare pentru comparat text: fără diacritice, fără punctuație, un spațiu. */
export const groundKey = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

/**
 * Aduce un URL la forma cu care se compară: absolut, fără `&amp;`, fără
 * punctuația lipită la sfârșit. `null` dacă nu iese nimic folosibil.
 *
 * Absolutizarea e obligatorie pe AMBELE părți. `extractProduct` primește
 * arborele deja absolutizat (`absolutizeUrls`), dar `aiExtract` lucrează pe
 * HTML-ul brut, unde `src="/img/a.jpg"` a rămas relativ. Fără pasul ăsta, pe un
 * site care scrie căi relative — adică exact publicul stratului de AI —
 * mulțimea de referință n-ar conține nicio poză și le-am arunca pe toate ca
 * inventate.
 */
const canonicalUrl = (raw: string, pageUrl: string): string | null => {
  const trimmed = raw
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/[.,;:]+$/, "")
  if (!trimmed) return null
  try {
    const url = new URL(trimmed, pageUrl)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Toate URL-urile care apar în sursă.
 *
 * Deliberat pe HTML-ul brut, cu regex, nu pe arborele parsat: pozele stau și în
 * `data-src`, și în `srcset`, și în JSON-uri din `<script>`. Aici nu ne trebuie
 * structură, ne trebuie mulțimea a ce e demonstrabil în pagină.
 *
 * Două capcane, amândouă întâlnite pe pagini reale:
 *  - în JSON, `json_encode` scrie implicit `https:\/\/cdn.ro\/a.jpg`. Modelul
 *    citește JSON-ul corect și întoarce URL-ul curat; dacă noi am căuta doar
 *    forma literală, l-am declara inventat. De aceea scanăm și o copie cu
 *    `\/` desfăcut.
 *  - căile relative din atribute nu apar deloc la o căutare de `https://`, deci
 *    le luăm separat din atribute și le absolutizăm.
 */
export function collectPageUrls(html: string, pageUrl: string): Set<string> {
  const out = new Set<string>()

  const add = (raw: string) => {
    const url = canonicalUrl(raw, pageUrl)
    if (!url) return
    out.add(url)
    // Varianta fără parametri: modelul citește adesea `src`-ul redimensionat și
    // scrie calea curată, care e tot în pagină, doar în alt atribut.
    const q = url.indexOf("?")
    if (q > 0) out.add(url.slice(0, q))
  }

  for (const source of [html, html.replace(/\\\//g, "/")]) {
    for (const raw of source.match(/https?:\/\/[^\s"'<>\\)]+/gi) ?? []) add(raw)
  }

  // Atributele cu căi (relative sau absolute). `srcset` e o listă cu
  // descriptori de mărime, deci se sparge pe virgulă și se ia primul câmp.
  for (const [, attr, value] of html.matchAll(
    /\b(src|data-src|data-original|data-lazy|href|content|srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi
  )) {
    if (/srcset/i.test(attr)) {
      for (const candidate of value.split(",")) add(candidate.trim().split(/\s+/)[0])
    } else {
      add(value)
    }
  }

  return out
}

/**
 * Păstrează doar pozele care chiar apar în pagină.
 *
 * Comparația e pe forma canonică, nu pe șirul brut: modelul poate întoarce
 * calea relativă din atribut sau varianta absolutizată de el, iar amândouă sunt
 * corecte. Ce nu se reduce la un URL din pagină e inventat.
 */
export function keepKnownUrls(candidates: string[], pageUrls: Set<string>, pageUrl: string) {
  const kept: string[] = []
  let dropped = 0
  for (const candidate of candidates) {
    const url = typeof candidate === "string" ? canonicalUrl(candidate, pageUrl) : null
    if (url && pageUrls.has(url)) kept.push(url)
    else dropped++
  }
  return { kept, dropped }
}

/**
 * Aruncă din descriere pozele care nu apar în pagină.
 *
 * `isGroundedDescription` nu le poate prinde: rulează pe textul descrierii, iar
 * `htmlToText` scoate `<img>`-urile cu totul. Fără pasul ăsta, un `<img>`
 * inventat trece neatins prin sanitizare, ajunge în `descriptionImages` și de
 * acolo în `rehost.ts`, care încearcă să-l descarce.
 */
export function keepKnownDescriptionImages(html: string, pageUrls: Set<string>, pageUrl: string) {
  let dropped = 0
  const cleaned = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? ""
    const url = canonicalUrl(src, pageUrl)
    if (url && pageUrls.has(url)) return tag
    dropped++
    return ""
  })
  return { html: cleaned, dropped }
}

/** Păstrează doar specificațiile a căror valoare se regăsește în textul paginii. */
export function keepGroundedSpecs(
  specs: { label: string; value: string; group?: string | null }[],
  pageKey: string
) {
  const kept: SpecPair[] = []
  let dropped = 0
  for (const spec of specs) {
    const label = (spec.label ?? "").trim()
    const value = (spec.value ?? "").trim()
    if (!label || !value) {
      dropped++
      continue
    }
    const key = groundKey(value)
    // Valorile foarte scurte („Da", „4") apar oricum undeva în pagină; pe ele
    // testul n-ar dovedi nimic, deci le lăsăm să treacă pe seama etichetei.
    if (key.length > 3 && !pageKey.includes(key)) {
      dropped++
      continue
    }
    const group = spec.group?.trim()
    kept.push(group ? { label, value, group } : { label, value })
  }
  return { kept, dropped }
}

/**
 * Descrierea e copiată din pagină sau rescrisă de model?
 *
 * Test pe propoziții: cele lungi (peste 40 de caractere normalizate) trebuie să
 * se regăsească în text. Sub 60% potrivire înseamnă că modelul a repovestit
 * pagina — plauzibil, dar nu e ce scrie producătorul, deci nu intră în magazin.
 */
export function isGroundedDescription(html: string, pageKey: string): boolean {
  const sentences = htmlToText(html)
    .split(/[.!?\n]+/)
    .map(groundKey)
    .filter((s) => s.length > 40)

  if (!sentences.length) return true // descriere din fraze scurte — n-avem ce testa
  const found = sentences.filter((s) => pageKey.includes(s)).length
  return found / sentences.length >= 0.6
}

/**
 * Sursa dată modelului.
 *
 * Aruncăm `<script>`-urile executabile, stilurile și SVG-urile — zgomot care pe
 * o pagină de magazin e jumătate din octeți. Păstrăm însă `application/ld+json`
 * și `text/template`: acolo stau fișa și galeria pe multe site-uri (vezi
 * `sources/json-ld.ts`).
 */
export function buildModelInput(
  html: string,
  pageUrl: string
): { payload: string; reduced: boolean } {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (match, attrs: string) =>
      /json|template/i.test(attrs) ? match : ""
    )
    .replace(/<(style|svg|noscript|iframe)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()

  if (cleaned.length <= MAX_HTML_CHARS) return { payload: cleaned, reduced: false }

  // Prea mare pentru HTML complet: dăm textul întreg plus toate URL-urile.
  // Mai sărac, dar întreg — spre deosebire de o pagină tăiată la mijloc.
  const urls = [...collectPageUrls(html, pageUrl)].filter((u) =>
    /\.(jpe?g|png|webp|avif)($|\?)/i.test(u)
  )
  const payload = `TEXTUL PAGINII:\n${htmlToText(cleaned)}\n\nURL-URI DE POZE DIN PAGINĂ:\n${urls.join("\n")}`

  if (payload.length > MAX_REDUCED_CHARS) {
    throw new Error(
      `Pagina e prea mare pentru extragerea cu AI (${Math.round(payload.length / 1024)} KB de text). ` +
        "Importă din ea manual sau lipește doar secțiunea de produs."
    )
  }

  return { payload, reduced: true }
}

const textOf = (message: { content: { type: string }[] }): string =>
  message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("")

/**
 * Cere modelului extragerea și verifică ce întoarce.
 *
 * `null` înseamnă un singur lucru: nu e configurat (fără `ANTHROPIC_API_KEY`).
 * Orice altă problemă — refuz, răspuns tăiat, JSON stricat — se aruncă, pentru
 * că apelul a fost deja plătit și operatorul merită să afle de ce previzualizarea
 * lui a rămas săracă.
 */
export async function aiExtract(html: string, pageUrl: string): Promise<AiExtraction | null> {
  if (!aiExtractionEnabled()) return null

  const model = process.env.PRODUCT_IMPORT_AI_MODEL || DEFAULT_MODEL
  // Validat, nu doar convertit: o valoare greșită în env ar face API-ul să dea
  // 400 la FIECARE pagină subțire, iar operatorul ar vedea doar „vezi logurile".
  const rawEffort = process.env.PRODUCT_IMPORT_AI_EFFORT?.trim()
  const effort = EFFORT_LEVELS.includes(rawEffort as Effort) ? (rawEffort as Effort) : undefined
  if (rawEffort && !effort) {
    console.warn(
      `[product-import] PRODUCT_IMPORT_AI_EFFORT="${rawEffort}" nu e o valoare validă ` +
        `(${EFFORT_LEVELS.join(", ")}) — se ignoră.`
    )
  }

  const client = new Anthropic({ maxRetries: 1, timeout: REQUEST_TIMEOUT_MS })
  const { payload, reduced } = buildModelInput(html, pageUrl)

  const stream = client.beta.messages.stream({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    // Dacă modelul refuză cererea, API-ul o reia singur pe un model de rezervă,
    // în același apel. Fără asta, un refuz ar apărea operatorului ca „importul
    // a eșuat", fără nimic de făcut.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
      ...(effort ? { effort } : {}),
    },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Pagina: ${pageUrl}\n\n${payload}`,
      },
    ],
  })

  const message = await stream.finalMessage()

  if (message.stop_reason === "refusal") {
    throw new Error(
      `Modelul a refuzat extragerea (${message.stop_details?.category ?? "necunoscut"}).`
    )
  }
  // Răspuns tăiat de plafonul de ieșire: JSON-ul e incomplet, deci `JSON.parse`
  // ar arunca oricum. Îl semnalăm separat, ca să se vadă că e o problemă de
  // buget, nu de model.
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      `Răspunsul modelului s-a oprit la plafonul de ${MAX_OUTPUT_TOKENS} tokeni și e incomplet.`
    )
  }

  let parsed: ModelOutput
  try {
    parsed = JSON.parse(textOf(message))
  } catch (err) {
    // Nu `return null`: apelantul n-ar avea ce spune operatorului, iar apelul a
    // fost deja plătit. Aruncăm, ca ruta să logheze și să pună o notă.
    throw new Error(`Răspunsul modelului nu e JSON valid: ${(err as Error).message}`)
  }

  const notes = [...(Array.isArray(parsed.notes) ? parsed.notes : [])]
  if (reduced) {
    notes.push("Pagina era prea mare pentru citire integrală — s-a folosit doar textul ei.")
  }

  const pageUrls = collectPageUrls(html, pageUrl)
  const images = keepKnownUrls(
    Array.isArray(parsed.images) ? parsed.images : [],
    pageUrls,
    pageUrl
  )
  if (images.dropped) {
    notes.push(`${images.dropped} poze propuse de model nu apar în pagină și au fost aruncate.`)
  }

  const pageKey = groundKey(htmlToText(html))

  const specs = keepGroundedSpecs(Array.isArray(parsed.specs) ? parsed.specs : [], pageKey)
  if (specs.dropped) {
    notes.push(`${specs.dropped} specificații propuse de model nu se regăsesc în pagină.`)
  }

  let descriptionHtml = parsed.description_html?.trim() || undefined
  if (descriptionHtml && !isGroundedDescription(descriptionHtml, pageKey)) {
    descriptionHtml = undefined
    notes.push("Descrierea propusă de model era repovestită, nu copiată din pagină — s-a aruncat.")
  }
  if (descriptionHtml) {
    // Pozele din descriere trec prin aceeași verificare ca galeria: testul de
    // propoziții nu le vede, pentru că `htmlToText` scoate `<img>`-urile.
    const inline = keepKnownDescriptionImages(descriptionHtml, pageUrls, pageUrl)
    descriptionHtml = inline.html
    if (inline.dropped) {
      notes.push(`${inline.dropped} poze din descrierea propusă nu apar în pagină și au fost scoase.`)
    }
  }

  return {
    model: message.model,
    title: parsed.title?.trim() || undefined,
    brand: parsed.brand?.trim() || undefined,
    ean: parsed.ean?.trim() || undefined,
    mpn: parsed.mpn?.trim() || undefined,
    descriptionHtml,
    images: images.kept,
    specs: specs.kept,
    notes,
    usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
  }
}
