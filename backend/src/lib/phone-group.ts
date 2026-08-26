import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Gruparea telefoanelor de același model.
 *
 * Produsele de tip telefon sunt „simple": fiecare combinație stocare + culoare e
 * un produs separat, cu URL propriu (așa au venit din WooCommerce și așa le
 * împinge și gestiunea Laravel). Nu le unim în variante Medusa — am colapsa ~37
 * de URL-uri iPhone în ~10 și am pierde SEO — ci le **legăm** prin metadata:
 *
 *   phone_group     — slug-ul modelului (ex. "apple-iphone-17-pro-max")
 *   phone_model     — eticheta modelului (ex. "Apple iPhone 17 Pro Max")
 *   phone_brand     — marca (ex. "Apple")
 *   storage / ram   — "256GB" / "12GB"
 *   color/color_hex — "Deep Blue" / "#2f3b54" (pastila de culoare)
 *   phone_spec      — linie scurtă pentru card, ex. "256GB · 12GB RAM · 5G"
 *   phone_siblings  — [{handle, storage, gb, color, color_hex, thumbnail}]
 *
 * Fișierul ăsta e sursa unică a logicii: îl folosesc și migrarea completă
 * (`scripts/link-phone-variants.ts`), și subscriberul care leagă automat la
 * fiecare salvare de produs (`subscribers/phone-group-link.ts`).
 *
 * Două reguli care nu sunt evidente:
 *
 * 1. `phone_siblings` conține **doar produse publicate**. Gestiunea creează
 *    produsele ca draft, iar un handle de draft în selector duce clientul într-un
 *    404 (storefront-ul face `notFound()` pentru ce nu întoarce Store API).
 *    Excepția e produsul însuși: un draft se vede în propria listă, ca selectorul
 *    să arate corect la preview și în clipa publicării.
 *
 * 2. Ordinea e stabilă (sortare pe handle înainte de dedup). Fără ea, două
 *    listări cu aceeași stocare+culoare ar putea alterna între rulări, iar
 *    subscriberul — care scrie doar când se schimbă ceva — ar intra în buclă
 *    infinită de update-uri.
 */

/** Categoria rădăcină a telefoanelor; subcategoriile pe marcă intră automat. */
export const PHONE_CATEGORY_HANDLE =
  process.env.PHONE_CATEGORY_HANDLE || "telefoane-mobile"

// ── Parser nume ──────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Ce nu e telefon, chiar dacă stă în categoria telefoanelor. Categoria e
 * curatoriată de om, deci conține și accesorii, și (azi) câteva tablete —
 * fără filtrul ăsta un iPad ar căpăta `phone_group` și pastile de culoare.
 */
const NOT_A_PHONE_RE =
  /\b(husa|husă|carcas|folie|sticl[aă]|[îi]nc[aă]rc|cablu|suport|adaptor|c[aă][sș]ti|baterie|ipad|tablet[aă]?|smartwatch|watch|buds|stylus|power\s?bank|docking)\b/i

/** Prefixe de listare care nu fac parte din numele modelului. */
const TITLE_PREFIX_RE = /^\s*(telefon(\s+mobil)?|smartphone)\s+/i

// Cuvânt-cheie de culoare → hex. Cele mai specifice (multi-cuvânt) primele,
// fiindcă potrivirea e prin „includes". Acoperă engleză + română.
const COLOR_HEX: [string, string][] = [
  ["cosmic orange", "#d4502e"], ["cloud white", "#eef0f1"], ["light gold", "#e8d6a8"],
  ["space black", "#2a2a2c"], ["space grey", "#5b5c60"], ["sky blue", "#a9c8e0"],
  ["mist blue", "#aebfd0"], ["deep blue", "#2f3b54"], ["midnight blue", "#1e2a44"],
  ["forest green", "#2e4d3a"], ["ice blue", "#cfe3ee"], ["clover green", "#4f7a52"],
  ["pioneer green", "#3f6f52"], ["awesome graphite", "#3b3b3d"], ["titan gray", "#6f7072"],
  ["titan black", "#1c1c1e"], ["titanium silver", "#c9ccd1"], ["titanium black", "#26262a"],
  ["silver shadow", "#b9bcc0"], ["blue black", "#20262e"], ["jet black", "#0e0e10"],
  ["cobalt violet", "#7c5cbf"], ["moonlight purple", "#9b8bc4"], ["starry black", "#1c1c1e"],
  ["ultramarine", "#3a4aa0"], ["midnight black", "#101216"], ["ripple green", "#9fc6a3"],
  ["razor green", "#4f8f5a"], ["fluid silver", "#cdd2d6"], ["surf blue", "#3f6fa8"],
  ["camouflage gray", "#7a7f74"], ["jetblack", "#0e0e10"], ["icyblue", "#cfe0ec"],
  ["skyblue", "#a9c8e0"], ["obsidian", "#1c1c1e"], ["lavender", "#c8b6e2"],
  ["graphite", "#3b3b3d"], ["titanium", "#8e8e8e"], ["midnight", "#191b22"],
  ["spellbound", "#2a3550"], ["navy", "#26314a"], ["silver", "#d9dada"],
  ["sage", "#b6c2a8"], ["teal", "#3f6f72"], ["pink", "#f3c5cf"], ["white", "#eef0f1"],
  ["black", "#1c1c1e"], ["blue", "#3b5b8c"], ["green", "#5b8c6e"], ["gold", "#e8d6a8"],
  ["purple", "#9b8bc4"], ["violet", "#7c5cbf"], ["orange", "#e07b3c"], ["red", "#b23b3b"],
  ["yellow", "#e8cf6a"], ["gray", "#9aa0a6"], ["grey", "#9aa0a6"], ["beige", "#d8ccb8"],
  ["cream", "#efe7d6"], ["mint", "#a8d8c0"], ["lilac", "#c8b6e2"],
  // română
  ["negru", "#1c1c1e"], ["alba", "#eef0f1"], ["alb", "#eef0f1"], ["rosu", "#b23b3b"],
  ["roșu", "#b23b3b"], ["albastru", "#3b5b8c"], ["verde", "#5b8c6e"],
  ["argintiu", "#d9dada"], ["auriu", "#e8d6a8"], ["roz", "#f3c5cf"],
  ["galben", "#e8cf6a"], ["portocaliu", "#e07b3c"], ["gri", "#9aa0a6"],
]

function colorHex(label: string): string | null {
  const l = label.toLowerCase()
  for (const [k, hex] of COLOR_HEX) if (l.includes(k)) return hex
  return null
}

/**
 * Segment care descrie o specificație, nu o culoare. Lista a crescut după ce
 * parserul a scos „45W", „T606" și „Unisoc UMS9230" pe post de culori — sunt
 * ultimul segment în titluri care se termină în fișa tehnică.
 */
const SPEC_RE = /^(5g|4g|3g|2g|lte|dual\s*sim|nfc|wi-?fi|esim)$/i
const UNIT_RE = /^\d+(?:[.,]\d+)?\s*(gb|tb|mb|w|mp|mah|hz|nm|inch|")$/i
const CHIPSET_RE = /^(unisoc|mediatek|snapdragon|dimensity|helio|exynos|kirin|tensor)\b|^[a-z]\d{3,4}$/i
const DISPLAY_RE =
  /\d+(?:[.,]\d+)?\s*("|”|inch)|\b(fhd|hd\+|qhd|amoled|oled|lcd|ips|retina)\b/i
const SPEC_WORD_RE =
  /\b(camera|android|ios|harmonyos|procesor|acumulator|ecran|display|rezolu|baterie|nuclee|ram)\b/i

const isSpecSeg = (s: string): boolean =>
  SPEC_RE.test(s) ||
  UNIT_RE.test(s) ||
  CHIPSET_RE.test(s) ||
  SPEC_WORD_RE.test(s) ||
  DISPLAY_RE.test(s) ||
  /\b\d+\s*(gb|tb)\b/i.test(s) ||
  /\d+\s*mp\b/i.test(s) ||
  /\d+\s*mah/i.test(s)

/** Culorile reale sunt scurte; un segment lung e o frază de marketing. */
const MAX_COLOR_LEN = 28

export type ParsedPhone = {
  group: string
  model: string
  brand: string
  storage: string | null
  gb: number | null
  ram: string | null
  color: string | null
  color_hex: string | null
  spec: string
}

/**
 * Parsează titlul unei listări de telefon. Formatul așteptat e cel folosit de
 * toți furnizorii de feed:
 *
 *   [Telefon [mobil]] <Marcă Model>, <Capacitate>, [<RAM> RAM], [5G], <Culoare>
 *
 * Prefixul „Telefon" e opțional — jumătate din catalog nu-l are, iar cerându-l
 * am rupe familia în două (vezi `Apple iPhone 17 Pro Max` vs
 * `Telefon mobil Apple iPhone 17 Pro Max`, același model, două grupuri).
 */
export function parsePhone(title: string): ParsedPhone | null {
  if (!title) return null

  const segs = title
    .replace(TITLE_PREFIX_RE, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (segs.length < 2) return null

  // Filtrul de accesorii se aplică **doar primului segment** (numele
  // produsului), nu întregului titlu: fișa tehnică a unui telefon conține
  // cuvinte ca „Baterie 4300mAh", care altfel l-ar exclude din grup.
  if (NOT_A_PHONE_RE.test(segs[0])) return null

  // Model = primul segment, fără tokeni de rețea (5G/4G/LTE/Dual SIM) ca să nu
  // fragmenteze grupul (ex. „iPhone 16 Plus 5G" și „iPhone 16 Plus").
  const model = segs[0]
    .replace(/\s+(5g|4g|lte|dual\s*sim)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (!model) return null
  const brand = model.split(/\s+/)[0]
  const group = slugify(model)
  if (!group) return null

  // Culoare = ultimul segment care nu e „spec"; curăță prefixul 5G/4G lipit.
  let ci = segs.length - 1
  while (ci > 0 && isSpecSeg(segs[ci])) ci--
  let color: string | null =
    ci > 0 ? segs[ci].replace(/^(5g|4g)\s+/i, "").trim() : null
  if (
    !color ||
    isSpecSeg(color) ||
    color.length > MAX_COLOR_LEN ||
    // Paranteze = notă de listare („… nu suporta E-SIM )"), nu culoare.
    /[()]/.test(color) ||
    /\b\d+\s*(gb|tb|mah)\b/i.test(color)
  ) {
    color = null
  }

  // Stocare/RAM = toți tokenii GB/TB. RAM = segmentul marcat „RAM"; dacă sunt
  // mai mulți tokeni nemarcați, cel mai mare = stocare, cel mai mic = RAM.
  const toks: { gb: number; disp: string; ram: boolean }[] = []
  for (const seg of segs) {
    const ramSeg = /\bram\b/i.test(seg)
    const re = /(\d+(?:[.,]\d+)?)\s*(TB|GB)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(seg))) {
      const val = parseFloat(m[1].replace(",", "."))
      const tb = /tb/i.test(m[2])
      toks.push({ gb: tb ? val * 1024 : val, disp: tb ? `${val}TB` : `${val}GB`, ram: ramSeg })
    }
  }
  let storage: string | null = null
  let gb: number | null = null
  let ram: string | null = null
  const nonRam = toks.filter((t) => !t.ram).sort((a, b) => b.gb - a.gb)
  const ramToks = toks.filter((t) => t.ram).sort((a, b) => b.gb - a.gb)
  if (nonRam.length) {
    storage = nonRam[0].disp
    gb = nonRam[0].gb
    if (nonRam.length > 1) ram = nonRam[nonRam.length - 1].disp
  }
  if (ramToks.length) ram = ramToks[0].disp

  const has5g = /\b5g\b/i.test(title)
  const spec = [storage, ram ? `${ram} RAM` : null, has5g ? "5G" : null]
    .filter(Boolean)
    .join(" · ")

  return {
    group,
    model,
    brand,
    storage,
    gb,
    ram,
    color,
    color_hex: color ? colorHex(color) : null,
    spec,
  }
}

// ── Selecția produselor ──────────────────────────────────────────────────────

export type PhoneCandidate = {
  id: string
  handle: string
  title: string
  status: string
  thumbnail: string | null
  metadata: Record<string, unknown> | null
  categories?: { id: string }[] | null
}

export const CANDIDATE_FIELDS = [
  "id",
  "handle",
  "title",
  "status",
  "thumbnail",
  "metadata",
  "categories.id",
]

export type Sibling = {
  handle: string
  storage: string | null
  gb: number | null
  color: string | null
  color_hex: string | null
  thumbnail: string | null
}

/** Câte produse într-o rulare de updateProductsWorkflow. */
const UPDATE_CHUNK = 50

const META_KEYS = [
  "phone_group",
  "phone_model",
  "phone_brand",
  "phone_spec",
  "storage",
  "ram",
  "color",
  "color_hex",
  "phone_siblings",
] as const

// Serializare cu chei sortate recursiv: Postgres jsonb nu păstrează ordinea
// cheilor, deci comparația de idempotență trebuie să fie independentă de ordine.
export function stableStringify(v: unknown): string {
  if (v === undefined || v === null) return "null"
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(",")}}`
  }
  return JSON.stringify(v)
}

/**
 * Categoria telefoanelor + toate subcategoriile ei (Apple, Samsung, Xiaomi…).
 * Un produs stă de obicei doar în subcategoria mărcii, deci fără descendenți am
 * rata majoritatea catalogului.
 */
export async function resolvePhoneCategoryIds(container: any): Promise<Set<string>> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "parent_category_id"],
    pagination: { take: 1000, skip: 0 },
  } as any)

  const rows = (data ?? []) as { id: string; handle: string; parent_category_id: string | null }[]
  const root = rows.find((c) => c.handle === PHONE_CATEGORY_HANDLE)
  if (!root) return new Set()

  const ids = new Set<string>([root.id])
  let grew = true
  while (grew) {
    grew = false
    for (const c of rows) {
      if (c.parent_category_id && ids.has(c.parent_category_id) && !ids.has(c.id)) {
        ids.add(c.id)
        grew = true
      }
    }
  }
  return ids
}

/**
 * E telefon dacă stă în categoria telefoanelor (sau într-o subcategorie de
 * marcă) ori dacă titlul o spune explicit. Ținem și varianta pe titlu ca plasă
 * de siguranță: produsele venite din gestiune sunt draft și pot ajunge fără
 * categorie, iar categoria se pune abia la publicare.
 */
export function isPhoneCandidate(p: PhoneCandidate, categoryIds: Set<string>): boolean {
  if ((p.categories ?? []).some((c) => c?.id && categoryIds.has(c.id))) return true
  return TITLE_PREFIX_RE.test(p.title || "")
}

// ── Construcția grupurilor ───────────────────────────────────────────────────

const comboKey = (p: ParsedPhone) =>
  `${p.storage ?? ""}|${(p.color ?? "").toLowerCase()}`

const toSibling = (p: PhoneCandidate, parsed: ParsedPhone): Sibling => ({
  handle: p.handle,
  storage: parsed.storage,
  gb: parsed.gb,
  color: parsed.color,
  color_hex: parsed.color_hex,
  thumbnail: p.thumbnail ?? null,
})

/** Dedup pe stocare+culoare, ordine stabilă (capacitate → culoare → handle). */
function toSiblingList(members: { p: PhoneCandidate; parsed: ParsedPhone }[]): Sibling[] {
  const seen = new Set<string>()
  const sibs: Sibling[] = []
  for (const m of members) {
    const key = comboKey(m.parsed)
    if (seen.has(key)) continue
    seen.add(key)
    sibs.push(toSibling(m.p, m.parsed))
  }
  sibs.sort(
    (a, b) =>
      (a.gb ?? 0) - (b.gb ?? 0) ||
      (a.color ?? "").localeCompare(b.color ?? "") ||
      a.handle.localeCompare(b.handle)
  )
  return sibs
}

export type PhoneGroupReport = {
  scanned: number
  phones: number
  groups: string[]
  linkedGroups: number
  updated: number
  unchanged: number
  colorless: string[]
  changes: { handle: string; key: string; from: string; to: string }[]
  /** Rezumat pe grup, pentru raportul scriptului. */
  summary: { group: string; count: number; storages: string[]; colors: string[] }[]
}

/**
 * Recalculează metadata de grup pentru un set de produse deja încărcate.
 * `candidates` trebuie să conțină **toți** membrii grupurilor atinse, altfel
 * `phone_siblings` ar ieși trunchiat.
 */
export async function applyPhoneGroups(
  container: any,
  candidates: PhoneCandidate[],
  categoryIds: Set<string>,
  opts: { dryRun?: boolean; collectChanges?: boolean } = {}
): Promise<PhoneGroupReport> {
  const report: PhoneGroupReport = {
    scanned: candidates.length,
    phones: 0,
    groups: [],
    linkedGroups: 0,
    updated: 0,
    unchanged: 0,
    colorless: [],
    changes: [],
    summary: [],
  }

  const phones: { p: PhoneCandidate; parsed: ParsedPhone }[] = []
  for (const p of candidates) {
    if (!isPhoneCandidate(p, categoryIds)) continue
    const parsed = parsePhone(p.title || "")
    if (parsed) phones.push({ p, parsed })
  }
  // Ordine stabilă înainte de orice dedup: fără ea, două listări cu aceeași
  // stocare+culoare ar putea alterna între rulări și subscriberul ar scrie la
  // nesfârșit.
  phones.sort((a, b) => a.p.handle.localeCompare(b.p.handle))
  report.phones = phones.length

  const groups = new Map<string, { p: PhoneCandidate; parsed: ParsedPhone }[]>()
  for (const ph of phones) {
    const arr = groups.get(ph.parsed.group) ?? []
    arr.push(ph)
    groups.set(ph.parsed.group, arr)
  }
  report.groups = [...groups.keys()]

  // Frații vizibili pe site = doar produsele publicate.
  const publishedByGroup = new Map<string, Sibling[]>()
  for (const [g, arr] of groups) {
    publishedByGroup.set(
      g,
      toSiblingList(arr.filter((m) => m.p.status === "published"))
    )
  }

  const colorless = new Set<string>()
  const updates: { id: string; metadata: Record<string, unknown> }[] = []

  for (const { p, parsed } of phones) {
    if (parsed.color && !parsed.color_hex) colorless.add(parsed.color)

    // Un draft nu apare în lista celorlalți (ar fi 404), dar se vede pe sine —
    // ca selectorul să fie corect la preview și în clipa publicării.
    const published = publishedByGroup.get(parsed.group) ?? []
    let siblings = published
    if (p.status !== "published") {
      const merged = [...groups.get(parsed.group)!].filter(
        (m) => m.p.status === "published" || m.p.id === p.id
      )
      siblings = toSiblingList(merged)
    }

    const prev = (p.metadata ?? {}) as Record<string, unknown>

    const next: Record<string, unknown> = {
      ...prev,
      phone_group: parsed.group,
      phone_model: parsed.model,
      phone_brand: parsed.brand,
    }
    /**
     * Setează cheile opționale doar când au valoare. Medusa face **merge** pe
     * `metadata`, nu înlocuire: o cheie pur și simplu lipsă din obiect rămâne
     * în baza de date. Ca s-o ștergem cu adevărat trebuie trimisă explicit
     * `null` — altfel comparația de idempotență ar găsi veșnic aceeași
     * diferență și subscriberul ar rescrie la infinit.
     */
    const setOrDelete = (k: string, v: unknown) => {
      if (v === null || v === undefined || v === "") {
        if (prev[k] === undefined || prev[k] === null) delete next[k]
        else next[k] = null
      } else next[k] = v
    }
    setOrDelete("phone_spec", parsed.spec)
    setOrDelete("storage", parsed.storage)
    setOrDelete("ram", parsed.ram)
    setOrDelete("color", parsed.color)
    setOrDelete("color_hex", parsed.color_hex)
    setOrDelete("phone_siblings", siblings.length > 1 ? siblings : null)

    const diffKeys = META_KEYS.filter(
      (k) => stableStringify(prev[k]) !== stableStringify(next[k])
    )

    if (!diffKeys.length) {
      report.unchanged++
      continue
    }

    if (opts.collectChanges) {
      for (const k of diffKeys) {
        report.changes.push({
          handle: p.handle,
          key: k,
          from: stableStringify(prev[k]).slice(0, 120),
          to: stableStringify(next[k]).slice(0, 120),
        })
      }
    }

    report.updated++
    if (!opts.dryRun) updates.push({ id: p.id, metadata: next })
  }

  // Un singur workflow per lot: un grup de 11 variante ar însemna altfel 11
  // rulări, fiecare cu overhead-ul ei — inacceptabil pentru un subscriber care
  // pornește la fiecare salvare de produs.
  for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
    await updateProductsWorkflow(container).run({
      input: { products: updates.slice(i, i + UPDATE_CHUNK) },
    })
  }

  report.colorless = [...colorless]
  for (const [g, sibs] of publishedByGroup) {
    if (sibs.length < 2) continue
    report.linkedGroups++
    report.summary.push({
      group: g,
      count: sibs.length,
      storages: [...new Set(sibs.map((s) => s.storage).filter(Boolean) as string[])],
      colors: [...new Set(sibs.map((s) => s.color).filter(Boolean) as string[])],
    })
  }
  report.summary.sort((a, b) => b.count - a.count || a.group.localeCompare(b.group))

  return report
}

// ── Puncte de intrare ────────────────────────────────────────────────────────

/** Migrarea completă: scanează tot catalogul. Folosită de script. */
export async function syncAllPhoneGroups(
  container: any,
  opts: { dryRun?: boolean; collectChanges?: boolean } = {}
): Promise<PhoneGroupReport> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const categoryIds = await resolvePhoneCategoryIds(container)

  const { data } = await query.graph({
    entity: "product",
    fields: CANDIDATE_FIELDS,
    pagination: { take: 5000, skip: 0 },
  } as any)

  return applyPhoneGroups(container, (data ?? []) as PhoneCandidate[], categoryIds, opts)
}

/** Scoate cheile de grup de pe un produs care nu mai e telefon (redenumit). */
async function stripPhoneMetadata(
  container: any,
  p: PhoneCandidate,
  dryRun: boolean
): Promise<boolean> {
  const prev = (p.metadata ?? {}) as Record<string, unknown>
  if (!META_KEYS.some((k) => prev[k] !== undefined && prev[k] !== null)) return false

  // `null`, nu `delete`: metadata se face merge (vezi setOrDelete).
  const next = { ...prev }
  for (const k of META_KEYS) {
    if (next[k] !== undefined && next[k] !== null) next[k] = null
  }

  if (!dryRun) {
    await updateProductsWorkflow(container).run({
      input: { selector: { id: p.id }, update: { metadata: next } },
    })
  }
  return true
}

/**
 * Recalculează doar grupurile atinse de produsele date. Asta rulează
 * subscriberul la fiecare salvare, deci nu-și permite să scaneze tot catalogul:
 * caută membrii după numele modelului (`$ilike` pe titlu), ceea ce înseamnă
 * zeci de rânduri, nu sute.
 *
 * Limita căutării: un titlu care ajunge în același grup dar scrie modelul altfel
 * (spații duble, diacritice) nu e găsit de `$ilike`. Rare, și le repară rularea
 * completă a scriptului.
 */
export async function syncPhoneGroupsForProducts(
  container: any,
  productIds: string[],
  opts: { dryRun?: boolean; collectChanges?: boolean } = {}
): Promise<PhoneGroupReport> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const categoryIds = await resolvePhoneCategoryIds(container)

  const { data: touchedRaw } = await query.graph({
    entity: "product",
    fields: CANDIDATE_FIELDS,
    filters: { id: productIds },
  } as any)
  const touched = (touchedRaw ?? []) as PhoneCandidate[]

  const affectedGroups = new Set<string>()
  const searchTerms = new Set<string>()
  let cleaned = 0

  for (const p of touched) {
    const isPhone = isPhoneCandidate(p, categoryIds)
    const parsed = isPhone ? parsePhone(p.title || "") : null

    if (parsed) {
      affectedGroups.add(parsed.group)
      searchTerms.add(parsed.model)
    } else if (await stripPhoneMetadata(container, p, !!opts.dryRun)) {
      // Nu mai e telefon, dar a fost: grupul vechi rămâne cu un frate în minus.
      cleaned++
    }

    // Grupul vechi (redenumire, scoatere din categorie, depublicare) trebuie
    // recalculat chiar dacă produsul nu mai face parte din el.
    const prevGroup = (p.metadata ?? {})["phone_group"]
    const prevModel = (p.metadata ?? {})["phone_model"]
    if (typeof prevGroup === "string" && prevGroup) affectedGroups.add(prevGroup)
    if (typeof prevModel === "string" && prevModel) searchTerms.add(prevModel)
  }

  if (!affectedGroups.size) {
    return {
      scanned: touched.length,
      phones: 0,
      groups: [],
      linkedGroups: 0,
      updated: cleaned,
      unchanged: 0,
      colorless: [],
      changes: [],
      summary: [],
    }
  }

  // Membrii grupurilor atinse: căutare pe numele modelului, apoi filtrare exactă
  // pe grup. Fără filtrarea pe grup am scrie `phone_siblings` trunchiat pentru
  // grupurile prinse doar parțial de căutare (ex. „iPhone 16" prinde și „16 Plus").
  const byId = new Map<string, PhoneCandidate>()
  for (const term of searchTerms) {
    const { data } = await query.graph({
      entity: "product",
      fields: CANDIDATE_FIELDS,
      filters: { title: { $ilike: `%${term}%` } },
    } as any)
    for (const p of (data ?? []) as PhoneCandidate[]) byId.set(p.id, p)
  }
  for (const p of touched) byId.set(p.id, p)

  const members = [...byId.values()].filter((p) => {
    const parsed = parsePhone(p.title || "")
    return !!parsed && affectedGroups.has(parsed.group)
  })

  const report = await applyPhoneGroups(container, members, categoryIds, opts)
  report.updated += cleaned
  return report
}
