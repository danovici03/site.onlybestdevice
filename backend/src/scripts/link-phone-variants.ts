/**
 * Leagă variantele de telefon (același model) între ele.
 *
 * Produsele importate din WooCommerce sunt „simple" — fiecare combinație
 * stocare + culoare e un produs separat (ex. „iPhone 16, 256GB, Black" și
 * „iPhone 16, 256GB, Teal" sunt două produse distincte). Acest script NU le
 * unește, ci le **leagă**: parsează numele (model / stocare / RAM / culoare),
 * grupează după model și scrie în `product.metadata`:
 *
 *   phone_group     — slug-ul modelului (ex. "apple-iphone-16")
 *   phone_model     — eticheta modelului (ex. "Apple iPhone 16")
 *   phone_brand     — marca (ex. "Apple")
 *   storage         — "256GB" / "1TB"
 *   ram             — "8GB" (dacă există în nume)
 *   color           — "Black"
 *   color_hex       — "#1c1c1e" (pentru pastila de culoare)
 *   phone_spec      — linie scurtă pentru card, ex. "256GB · 8GB RAM · 5G"
 *   phone_siblings  — [{handle, storage, gb, color, color_hex, thumbnail}]
 *                     toate variantele grupului (inclusiv el însuși); scris
 *                     doar când grupul are ≥ 2 produse.
 *
 * Nedistructiv și idempotent: păstrează restul metadata-ei și sare peste
 * produsele deja la zi. Re-rulează după ce adaugi modele/culori noi.
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/link-phone-variants.ts
 *   Opțional: DRY_RUN=1 (doar raport, fără scriere)
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

const DRY_RUN = !!process.env.DRY_RUN

// Serializare cu chei sortate recursiv: Postgres jsonb nu păstrează ordinea
// cheilor, deci comparația de idempotență trebuie să fie independentă de ordine.
function stableStringify(v: unknown): string {
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

// ── Parser nume ──────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Cuvânt-cheie de culoare → hex. Cele mai specifice (multi-cuvânt) primele,
// fiindcă potrivirea e prin „includes". Acoperă engleză + română.
const COLOR_HEX: [string, string][] = [
  ["cosmic orange", "#d4502e"], ["cloud white", "#eef0f1"], ["light gold", "#e8d6a8"],
  ["space black", "#2a2a2c"], ["sky blue", "#a9c8e0"], ["mist blue", "#aebfd0"],
  ["deep blue", "#2f3b54"], ["midnight blue", "#1e2a44"], ["forest green", "#2e4d3a"],
  ["ice blue", "#cfe3ee"], ["clover green", "#4f7a52"], ["pioneer green", "#3f6f52"],
  ["awesome graphite", "#3b3b3d"], ["titan gray", "#6f7072"], ["titan black", "#1c1c1e"],
  ["blue black", "#20262e"], ["cobalt violet", "#7c5cbf"], ["moonlight purple", "#9b8bc4"],
  ["starry black", "#1c1c1e"], ["ultramarine", "#3a4aa0"], ["midnight black", "#101216"],
  ["ripple green", "#9fc6a3"], ["jetblack", "#0e0e10"], ["icyblue", "#cfe0ec"],
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
  ["albastru", "#3b5b8c"], ["verde", "#5b8c6e"], ["argintiu", "#d9dada"], ["auriu", "#e8d6a8"],
  ["roz", "#f3c5cf"], ["galben", "#e8cf6a"], ["portocaliu", "#e07b3c"], ["gri", "#9aa0a6"],
]

function colorHex(label: string): string | null {
  const l = label.toLowerCase()
  for (const [k, hex] of COLOR_HEX) if (l.includes(k)) return hex
  return null
}

const SPEC_RE = /^(5g|4g|3g|2g|lte|dual\s*sim|nfc)$/i
const isSpecSeg = (s: string): boolean =>
  SPEC_RE.test(s) ||
  /\b\d+\s*(gb|tb)\b/i.test(s) ||
  /\bram\b/i.test(s) ||
  /\d+\s*mah/i.test(s) ||
  /\d+\s*nuclee/i.test(s)

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

export function parsePhone(title: string): ParsedPhone | null {
  if (!/^Telefon\s+/i.test(title)) return null
  const segs = title
    .replace(/^Telefon\s+(mobil\s+)?/i, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (segs.length < 2) return null

  // Model = primul segment, fără tokeni de rețea (5G/4G/LTE/Dual SIM) ca să nu
  // fragmenteze grupul (ex. „iPhone 16 Plus 5G" și „iPhone 16 Plus").
  const model = segs[0]
    .replace(/\s+(5g|4g|lte|dual\s*sim)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
  if (!model) return null
  const brand = model.split(/\s+/)[0]
  const group = slugify(model)

  // Culoare = ultimul segment care nu e „spec"; curăță prefixul 5G/4G lipit.
  let ci = segs.length - 1
  while (ci > 0 && isSpecSeg(segs[ci])) ci--
  let color: string | null =
    ci > 0 ? segs[ci].replace(/^(5g|4g)\s+/i, "").trim() : null
  if (!color || isSpecSeg(color) || /\b\d+\s*(gb|tb|mah)\b/i.test(color)) {
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

  return { group, model, brand, storage, gb, ram, color, color_hex: color ? colorHex(color) : null, spec }
}

// ── Migrare ─────────────────────────────────────────────────────────────────

type DbProduct = {
  id: string
  handle: string
  title: string
  thumbnail: string | null
  metadata: Record<string, unknown> | null
}

type Sibling = {
  handle: string
  storage: string | null
  gb: number | null
  color: string | null
  color_hex: string | null
  thumbnail: string | null
}

export default async function linkPhoneVariants({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: all } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "thumbnail", "metadata"],
    pagination: { take: 5000, skip: 0 },
  } as any)

  const phones: { p: DbProduct; parsed: ParsedPhone }[] = []
  for (const p of all as DbProduct[]) {
    const parsed = parsePhone(p.title || "")
    if (parsed) phones.push({ p, parsed })
  }
  logger.info(`Găsite ${phones.length} produse de tip telefon (din ${all.length}).`)

  // Grupare după model.
  const groups = new Map<string, { p: DbProduct; parsed: ParsedPhone }[]>()
  for (const ph of phones) {
    const arr = groups.get(ph.parsed.group) ?? []
    arr.push(ph)
    groups.set(ph.parsed.group, arr)
  }
  const multi = [...groups.values()].filter((g) => g.length > 1)
  logger.info(
    `${groups.size} modele distincte; ${multi.length} cu mai multe variante (se leagă).`
  )

  // Pentru fiecare grup, construiește lista de „siblings" deduplicată pe
  // stocare+culoare (păstrează prima apariție cu thumbnail).
  const siblingsByGroup = new Map<string, Sibling[]>()
  for (const [g, arr] of groups) {
    if (arr.length < 2) continue
    const seen = new Set<string>()
    const sibs: Sibling[] = []
    for (const { p, parsed } of arr) {
      const key = `${parsed.storage ?? ""}|${(parsed.color ?? "").toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      sibs.push({
        handle: p.handle,
        storage: parsed.storage,
        gb: parsed.gb,
        color: parsed.color,
        color_hex: parsed.color_hex,
        thumbnail: p.thumbnail ?? null,
      })
    }
    // Dacă după dedup rămâne o singură combinație distinctă (listări duplicate),
    // nu e nimic de comutat — nu lega.
    if (sibs.length < 2) continue
    sibs.sort((a, b) => (a.gb ?? 0) - (b.gb ?? 0) || (a.color ?? "").localeCompare(b.color ?? ""))
    siblingsByGroup.set(g, sibs)
  }

  // Construiește update-urile (merge cu metadata existentă), sare peste cele la zi.
  let updated = 0
  let unchanged = 0
  const colorless = new Set<string>()

  for (const { p, parsed } of phones) {
    if (parsed.color && !parsed.color_hex) colorless.add(parsed.color)
    const siblings = siblingsByGroup.get(parsed.group)

    const next: Record<string, unknown> = {
      ...(p.metadata ?? {}),
      phone_group: parsed.group,
      phone_model: parsed.model,
      phone_brand: parsed.brand,
    }
    // Setează cheile opționale doar când au valoare (altfel curăță-le). Medusa
    // normalizează string-ul gol în jsonb la null, deci nu stoca "" deloc.
    const setOrDelete = (k: string, v: unknown) => {
      if (v === null || v === undefined || v === "") delete next[k]
      else next[k] = v
    }
    setOrDelete("phone_spec", parsed.spec)
    setOrDelete("storage", parsed.storage)
    setOrDelete("ram", parsed.ram)
    setOrDelete("color", parsed.color)
    setOrDelete("color_hex", parsed.color_hex)
    setOrDelete("phone_siblings", siblings && siblings.length > 1 ? siblings : null)

    // Skip dacă nimic relevant nu s-a schimbat.
    const prev = (p.metadata ?? {}) as Record<string, unknown>
    const sameKeys = [
      "phone_group", "phone_model", "phone_brand", "phone_spec",
      "storage", "ram", "color", "color_hex", "phone_siblings",
    ]
    const changed = sameKeys.some(
      (k) => stableStringify(prev[k]) !== stableStringify(next[k])
    )
    if (changed && process.env.DEBUG) {
      const diffKeys = sameKeys.filter(
        (k) => stableStringify(prev[k]) !== stableStringify(next[k])
      )
      for (const k of diffKeys) {
        logger.info(
          `  ~ ${p.handle} [${k}]: ${stableStringify(prev[k]).slice(0, 120)} → ${stableStringify(next[k]).slice(0, 120)}`
        )
      }
    }
    if (!changed) {
      unchanged++
      continue
    }

    if (DRY_RUN) {
      updated++
      continue
    }

    await updateProductsWorkflow(container).run({
      input: { selector: { id: p.id }, update: { metadata: next } },
    })
    updated++
  }

  logger.info(
    `${DRY_RUN ? "[DRY_RUN] " : ""}` +
      `Actualizate: ${updated}, neschimbate: ${unchanged}.`
  )
  if (colorless.size) {
    logger.warn(
      `Culori fără hex (fără pastilă, nume neclar): ${[...colorless].join(", ")}`
    )
  }
  // Raport scurt pe grupurile legate.
  for (const [g, sibs] of siblingsByGroup) {
    const storages = [...new Set(sibs.map((s) => s.storage).filter(Boolean))]
    const colors = [...new Set(sibs.map((s) => s.color).filter(Boolean))]
    logger.info(
      `  • ${g}: ${sibs.length} variante — stocări [${storages.join(", ")}] · culori [${colors.join(", ")}]`
    )
  }
}
