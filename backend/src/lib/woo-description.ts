/**
 * Curăță descrierile HTML importate din WooCommerce, ca să poată fi randate
 * direct în storefront (`dangerouslySetInnerHTML`).
 *
 * Descrierile au fost copiate de pe paginile altor magazine (eMAG, Altex,
 * Flixcar, site-urile producătorilor), așa că vin cu tot markup-ul lor:
 *  - imagini lazy-load: `src` e un `loading.gif`, URL-ul real stă în `data-src`
 *    sau `data-flixsrcset` (peste jumătate din cele ~5.900 de imagini);
 *  - tabele cu DOUĂ roluri diferite (vezi mai jos);
 *  - `class`/`align`/`width=""` de la CKEditor, plus `script`/`iframe`/`style`;
 *  - linkuri către magazinul de unde s-a copiat conținutul;
 *  - markup efectiv rupt (`<strong>x</strong></p>` fără `<p>` deschis) — de
 *    aceea reconstruim HTML-ul pe o stivă, nu doar cu `replace`.
 *
 * Tabelele: în sursă, ~1.370 de tabele sunt aproape toate pe două coloane, dar
 * doar o parte sunt fișe de specificații (etichetă | valoare). Restul sunt
 * LAYOUT — celula stângă are textul de marketing, cea dreaptă poza. Un
 * `dropTables` global ar arunca jumătate din descriere, așa că:
 *  - fișele de specificații se ARUNCĂ (sunt deja în `metadata.specs`, afișate
 *    în panoul „Specificații" — vezi `extract-product-specs.ts`);
 *  - tabelele de layout se DESFAC, celulă cu celulă, în blocuri pe verticală
 *    (și se citesc mai bine pe mobil decât tabelul original).
 *
 * Sanitizarea se face O SINGURĂ DATĂ, la import — în baza de date ajunge HTML
 * deja curat, iar storefront-ul îl randează fără sanitizare la runtime.
 * Deci: nu băga aici HTML din altă sursă decât admin/importul nostru.
 *
 * Pozele rămân hotlinkate pe domeniile originale (decizie asumată). Dacă vreun
 * CDN blochează hotlinkul, `migrate-images-to-s3.ts` e locul unde se rescriu.
 */

/** Tag-uri păstrate ca atare. */
const KEEP_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "figure",
  "figcaption",
  "img",
  "dl",
  "dt",
  "dd",
])

/** Fără conținut propriu — nu se închid niciodată. */
const VOID_TAGS = new Set(["img", "br"])

/** Eliminate cu tot cu conținut. */
const DROP_WITH_CONTENT = [
  "script",
  "style",
  "iframe",
  "noscript",
  "form",
  "button",
  "svg",
  "video",
  "audio",
  "template",
  "head",
]

/** `h1` intră în conflict cu titlul produsului din pagină. */
const REMAP_TAGS: Record<string, string> = { h1: "h2", u: "em" }

/** URL-uri de placeholder pentru lazy-load — nu au ce căuta în pagină. */
const PLACEHOLDER_RE =
  /(loading|spacer|blank|placeholder|pixel|1x1|transparent)\.(gif|png|jpe?g|webp)(\?|$)/i

/** Blocuri care pot deschide un paragraf nou (pentru celulele desfăcute). */
const BLOCK_START_RE = /^\s*<(p|h[1-6]|ul|ol|li|figure|table|dl|div)\b/i

export type SanitizeOptions = {
  /**
   * Etichetele deja extrase în `metadata.specs`, normalizate cu `normLabel`.
   * Cu ele, fișele de specificații se recunosc sigur; fără, cădem pe euristică.
   */
  specLabels?: Set<string>
  /** Limită de siguranță pentru descrierile monstruoase (implicit 120.000). */
  maxLength?: number
}

export type SanitizeResult = {
  html: string
  /** URL-urile imaginilor păstrate, în ordine (pentru rapoarte/rehosting). */
  images: string[]
  /** Imagini aruncate fiindcă nu aveau o sursă utilizabilă. */
  droppedImages: number
  /** Fișe de specificații eliminate (dublate de panoul „Specificații"). */
  droppedSpecTables: number
  /** Tabele de layout desfăcute în blocuri. */
  unwrappedTables: number
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#0?38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")

/** Cheie de comparație pentru etichetele de specificații. */
export const normLabel = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[:：]\s*$/, "")
    .trim()

/** Primul URL dintr-un `srcset` („url 200w, url 400w"). */
const firstFromSrcset = (v: string) => v.split(",")[0]?.trim().split(/\s+/)[0] || ""

const isUsableUrl = (u: string) => /^https?:\/\/\S+$/i.test(u) && !PLACEHOLDER_RE.test(u)

/**
 * Alege sursa reală a unei imagini. Ordinea contează: `data-src`/`data-flixsrcset`
 * bat `src`, fiindcă la imaginile lazy `src` e placeholder-ul.
 */
function pickImageSrc(attrs: Record<string, string>): string | null {
  const candidates = [
    attrs["data-src"],
    attrs["data-original"],
    attrs["data-lazy-src"],
    attrs["data-flixsrcset"] && firstFromSrcset(attrs["data-flixsrcset"]),
    attrs["srcset"] && firstFromSrcset(attrs["srcset"]),
    attrs["data-srcset"] && firstFromSrcset(attrs["data-srcset"]),
    attrs["src"],
  ]
  for (const raw of candidates) {
    if (!raw) continue
    const url = decodeEntities(raw.trim())
    if (isUsableUrl(url)) return url
  }
  return null
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  for (const m of tag.matchAll(re)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? ""
  }
  return out
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

/** Dimensiune numerică validă (sursa are o grămadă de `width=""`). */
const dimension = (v?: string) =>
  v && /^\d+$/.test(v.trim()) && Number(v) > 1 ? v.trim() : null

/* -------------------------------------------------------------------------- */
/* Tabele                                                                      */
/* -------------------------------------------------------------------------- */

type TableRow = string[]

/** Celulele tabelului, ca text simplu, pe rânduri. */
function tableRows(inner: string): TableRow[] {
  return [...inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map((r) =>
    [...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map((c) =>
      htmlToText(c[1]).trim()
    )
  )
}

/**
 * Fișă de specificații (de aruncat) sau tabel de layout (de desfăcut)?
 * Semnalul decisiv sunt etichetele deja extrase în `metadata.specs`; fără ele,
 * ne uităm la forma clasică etichetă/valoare: fără poze, celule scurte.
 */
function isSpecTable(inner: string, specLabels?: Set<string>): boolean {
  if (/<img\b/i.test(inner)) return false

  const pairs = tableRows(inner).filter((r) => r.length === 2 && r[0] && r[1])
  if (pairs.length < 3) return false

  if (specLabels?.size) {
    const hits = pairs.filter((p) => specLabels.has(normLabel(p[0]))).length
    return hits / pairs.length >= 0.5
  }

  // Fără dicționar: etichetă scurtă + valoare scurtă, pe aproape toate rândurile.
  const short = pairs.filter((p) => p[0].length <= 40 && p[1].length <= 90).length
  return short / pairs.length >= 0.8
}

/** Celulele devin blocuri pe verticală, în ordinea din tabel. */
function unwrapTable(inner: string): string {
  const cells = [...inner.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map(
    (c) => c[1].trim()
  )
  return cells
    .filter((c) => htmlToText(c).trim() || /<img\b/i.test(c))
    .map((c) => (BLOCK_START_RE.test(c) ? c : `<p>${c}</p>`))
    .join("\n")
}

/**
 * Scoate `<figure class="table">` din jurul tabelelor, păstrând conținutul.
 * CKEditor le pune peste orice tabel; dacă rămân, tabelul desfăcut ajunge un
 * `<figure>` care conține alte `<figure>`-uri de imagine. Adâncimea contează
 * exact din motivul ăsta — figurile chiar se imbrică aici.
 */
function unwrapFigureTables(html: string): string {
  const openRe = /<figure\b[^>]*>/gi
  let out = ""
  let cursor = 0
  let m: RegExpExecArray | null

  while ((m = openRe.exec(html))) {
    if (m.index < cursor) continue
    if (!/class=["'][^"']*\btable\b/i.test(m[0])) continue

    const scan = /<figure\b[^>]*>|<\/figure\s*>/gi
    scan.lastIndex = m.index
    let depth = 0
    let close: RegExpExecArray | null = null
    let t: RegExpExecArray | null
    while ((t = scan.exec(html))) {
      depth += t[0].startsWith("</") ? -1 : 1
      if (depth === 0) {
        close = t
        break
      }
    }
    if (!close) continue

    const inner = html.slice(m.index + m[0].length, close.index)
    out += html.slice(cursor, m.index) + inner
    cursor = close.index + close[0].length
    openRe.lastIndex = cursor
  }

  return out + html.slice(cursor)
}

/**
 * Înlocuiește fiecare `<table>` (numărând adâncimea, ca tabelele imbricate să
 * nu rupă potrivirea) cu nimic — dacă e fișă de specificații — sau cu celulele
 * desfăcute.
 */
function processTables(
  html: string,
  specLabels: Set<string> | undefined,
  stats: { dropped: number; unwrapped: number }
): string {
  html = unwrapFigureTables(html)

  const openRe = /<table\b[^>]*>/gi
  let out = ""
  let cursor = 0
  let m: RegExpExecArray | null

  while ((m = openRe.exec(html))) {
    if (m.index < cursor) continue

    // Caută `</table>`-ul perechii, ținând cont de tabelele imbricate.
    const scan = /<table\b[^>]*>|<\/table\s*>/gi
    scan.lastIndex = m.index
    let depth = 0
    let end = -1
    let t: RegExpExecArray | null
    while ((t = scan.exec(html))) {
      depth += t[0].startsWith("</") ? -1 : 1
      if (depth === 0) {
        end = t.index + t[0].length
        break
      }
    }
    if (end === -1) break // tabel nechis: îl lăsăm pe seama rebuildului

    const inner = html.slice(m.index + m[0].length, end - "</table>".length)
    const replacement = isSpecTable(inner, specLabels)
      ? (stats.dropped++, "")
      : (stats.unwrapped++, unwrapTable(inner))

    out += html.slice(cursor, m.index) + replacement
    cursor = end
    openRe.lastIndex = end
  }

  out += html.slice(cursor)

  // `<figure class="table">` rămasă goală + resturi de tabel nechis.
  return out
    .replace(/<figure\b[^>]*class=["'][^"']*\btable\b[^"']*["'][^>]*>\s*<\/figure\s*>/gi, "")
    .replace(/<\/?(table|thead|tbody|tfoot|tr|th|td|colgroup|col|caption)\b[^>]*>/gi, "")
}

/* -------------------------------------------------------------------------- */
/* Sanitizare                                                                  */
/* -------------------------------------------------------------------------- */

export function sanitizeWooHtml(
  input?: string | null,
  opts: SanitizeOptions = {}
): SanitizeResult {
  const images: string[] = []
  let droppedImages = 0
  const tableStats = { dropped: 0, unwrapped: 0 }

  const empty: SanitizeResult = {
    html: "",
    images,
    droppedImages,
    droppedSpecTables: 0,
    unwrappedTables: 0,
  }
  if (!input || !input.trim()) return empty

  let html = input.replace(/<!--[\s\S]*?-->/g, "")
  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "")
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "")
  }
  html = html.replace(/<link\b[^>]*>/gi, "")

  html = processTables(html, opts.specLabels, tableStats)

  // Reconstrucție pe stivă: sursa are tag-uri nechise și `</p>` orfane, iar un
  // `replace` simplu le-ar propaga în pagină (unde ar rupe layoutul).
  const stack: string[] = []
  const out: string[] = []
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g
  let last = 0
  let m: RegExpExecArray | null

  while ((m = tagRe.exec(html))) {
    out.push(html.slice(last, m.index))
    last = m.index + m[0].length

    const raw = m[0]
    const name = m[1].toLowerCase()
    const closing = raw.startsWith("</")
    const mapped = REMAP_TAGS[name] || name

    // Necunoscut sau nedorit (`div`, `span`, `a`, `section`…): îl desfacem —
    // conținutul rămâne, tag-ul dispare.
    if (!KEEP_TAGS.has(mapped)) continue

    if (VOID_TAGS.has(mapped)) {
      if (closing) continue
      if (mapped === "br") {
        out.push("<br />")
        continue
      }
      const attrs = parseAttrs(raw)
      const src = pickImageSrc(attrs)
      if (!src) {
        droppedImages++
        continue
      }
      images.push(src)
      const alt = decodeEntities(attrs["alt"] || "").trim()
      const w = dimension(attrs["width"])
      const h = dimension(attrs["height"])
      out.push(
        `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"` +
          (w ? ` width="${w}"` : "") +
          (h ? ` height="${h}"` : "") +
          ` loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      )
      continue
    }

    if (closing) {
      const at = stack.lastIndexOf(mapped)
      if (at === -1) continue // `</p>` orfan — ignorat
      while (stack.length > at) out.push(`</${stack.pop()}>`)
      continue
    }

    // `<p>` nu poate conține alt `<p>`/`<figure>`: sursa deschide paragrafe pe
    // care nu le închide niciodată, iar imbricarea lor ar strica randarea.
    if ((mapped === "p" || mapped === "figure") && stack.includes("p")) {
      while (stack.length && stack[stack.length - 1] !== "p") {
        out.push(`</${stack.pop()}>`)
      }
      out.push(`</${stack.pop()}>`)
    }

    stack.push(mapped)
    out.push(`<${mapped}>`)
  }

  out.push(html.slice(last))
  while (stack.length) out.push(`</${stack.pop()}>`)

  html = out
    .join("")
    .replace(/&nbsp;/g, " ")
    .replace(/(<br \/>\s*){3,}/gi, "<br /><br />")
    .replace(/[ \t]{2,}/g, " ")

  html = stripEmptyBlocks(html)

  const max = opts.maxLength ?? 120_000
  if (html.length > max) {
    const cut = html.lastIndexOf("</p>", max)
    html = (cut > 0 ? html.slice(0, cut + 4) : html.slice(0, max)).trim()
  }

  return {
    html,
    images,
    droppedImages,
    droppedSpecTables: tableStats.dropped,
    unwrappedTables: tableStats.unwrapped,
  }
}

const EMPTY_BLOCK_RE =
  /<(p|h[2-6]|li|ul|ol|figure|figcaption|dl|dt|dd|strong|b|em|i)>\s*(<br \/>\s*)*<\/\1>/gi

/**
 * Scoate blocurile rămase goale. Golurile apar în valuri: un `<p>` gol dispare,
 * iar `<figure>`-ul care îl conținea rămâne gol la rândul lui.
 */
export function stripEmptyBlocks(html: string): string {
  let out = html
  for (let i = 0; i < 5; i++) {
    const next = out.replace(EMPTY_BLOCK_RE, "")
    if (next === out) break
    out = next
  }
  return out.replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * Scoate imaginile pentru care `isDead` întoarce `true` — pozele sunt
 * hotlinkate pe domenii străine, iar unele URL-uri au murit între timp la
 * sursă (link mort e mai urât în pagină decât lipsa pozei).
 */
export function dropImages(html: string, isDead: (src: string) => boolean) {
  let removed = 0
  const out = html.replace(/<img\b[^>]*src="([^"]*)"[^>]*>/gi, (tag, src) =>
    isDead(decodeEntities(src)) ? ((removed++), "") : tag
  )
  return { html: removed ? stripEmptyBlocks(out) : out, removed }
}

/** Textul curat dintr-un HTML (meta description, comparații, rapoarte). */
export function htmlToText(html?: string | null): string {
  if (!html) return ""
  return html
    .replace(/<\/(p|div|li|br|h[1-6]|tr|td|th)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#0?38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Are HTML-ul conținut vizibil (text sau imagini)? */
export function hasVisibleContent(html: string): boolean {
  return Boolean(htmlToText(html).length || /<img\b/i.test(html))
}
