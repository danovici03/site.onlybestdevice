/**
 * Citirea blocurilor `application/ld+json` de tip `Product`.
 *
 * E cea mai bună sursă când există: schema.org e standard, deci același cod
 * merge pe eMAG, pe Altex și pe site-ul producătorului. `additionalProperty`
 * conține fișa tehnică deja structurată (nume/valoare), fără nicio euristică
 * de tabel.
 *
 * Atenție — JSON-ul lor NU e valid JSON. Pe eMAG, `description` are newline-uri
 * brute în interiorul stringului, iar `JSON.parse` refuză din start (caracter
 * de control neescapat). De aceea reparăm înainte de parsare, în loc să
 * renunțăm la cea mai bogată sursă din pagină pentru un `\n`.
 */
import { decodeEntities, findAll, type Node } from "../html"

export type JsonLdProduct = {
  name?: string
  /** Text simplu, nu HTML — schema.org cere text. */
  description?: string
  brand?: string
  sku?: string
  ean?: string
  /** Codul de piesă al producătorului, când nu e un EAN valid. */
  mpn?: string
  images: string[]
  specs: { label: string; value: string }[]
}

/**
 * Escapează caracterele de control rămase brute în interiorul stringurilor.
 *
 * Trecem caracter cu caracter urmărind dacă suntem într-un string, ca să nu
 * atingem newline-urile dintre chei (acolo sunt legale).
 */
export function repairJson(raw: string): string {
  const out: string[] = []
  let inString = false
  let escaped = false

  for (const ch of raw) {
    if (escaped) {
      out.push(ch)
      escaped = false
      continue
    }
    if (ch === "\\") {
      out.push(ch)
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      out.push(ch)
      continue
    }
    if (inString && ch < " ") {
      out.push(ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : " ")
      continue
    }
    out.push(ch)
  }
  return out.join("")
}

const parseLenient = (raw: string): unknown => {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(repairJson(raw))
    } catch {
      return null
    }
  }
}

/** Aplatizează `@graph`, listele și obiectele imbricate într-un șir de noduri. */
function* flatten(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) {
    for (const v of value) yield* flatten(v)
    return
  }
  if (!value || typeof value !== "object") return
  const obj = value as Record<string, unknown>
  yield obj
  if (obj["@graph"]) yield* flatten(obj["@graph"])
}

const typeOf = (obj: Record<string, unknown>): string[] => {
  const t = obj["@type"]
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string")
}

/** `"TOYZ"`, `{ name: "TOYZ" }` sau `[{ name: "TOYZ" }]` — toate apar în practică. */
const nameOf = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined
  if (Array.isArray(value)) return nameOf(value[0])
  if (value && typeof value === "object") {
    const n = (value as Record<string, unknown>).name
    return typeof n === "string" ? n.trim() || undefined : undefined
  }
  return undefined
}

const urlsOf = (value: unknown): string[] => {
  const out: string[] = []
  const visit = (v: unknown) => {
    if (typeof v === "string") {
      const url = decodeEntities(v.trim())
      if (/^https?:\/\//i.test(url)) out.push(url)
      return
    }
    if (Array.isArray(v)) {
      v.forEach(visit)
      return
    }
    if (v && typeof v === "object") visit((v as Record<string, unknown>).url)
  }
  visit(value)
  return out
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined

/** EAN/UPC/GTIN: doar cifre, 8, 12, 13 sau 14 de ele. */
const looksLikeEan = (v: string) => /^\d{8}$|^\d{12,14}$/.test(v.replace(/[\s-]/g, ""))

const firstEan = (values: unknown[]): string | undefined => {
  for (const value of values) {
    const s = str(value) ?? (typeof value === "number" ? String(value) : undefined)
    if (s && looksLikeEan(s)) return s.replace(/[\s-]/g, "")
  }
  return undefined
}

export function extractJsonLd(root: Node): JsonLdProduct | null {
  const scripts = findAll(root, {
    tag: "script",
    attrs: { type: /ld\+json/i },
  })

  for (const script of scripts) {
    const raw = script.children.map((c) => (c.type === "text" ? c.text : "")).join("")
    const parsed = parseLenient(raw)
    if (!parsed) continue

    for (const node of flatten(parsed)) {
      if (!typeOf(node).some((t) => /(^|\/)Product$/i.test(t))) continue

      const specs: { label: string; value: string }[] = []
      const props = node.additionalProperty
      for (const prop of Array.isArray(props) ? props : props ? [props] : []) {
        if (!prop || typeof prop !== "object") continue
        const p = prop as Record<string, unknown>
        const label = str(p.name)
        const value =
          str(p.value) ?? (typeof p.value === "number" ? String(p.value) : undefined)
        if (label && value) specs.push({ label, value })
      }

      return {
        name: str(node.name),
        description: str(node.description),
        brand: nameOf(node.brand) ?? nameOf(node.manufacturer),
        sku: str(node.sku),
        // `gtin13` e cheia corectă; eMAG pune EAN-ul în `mpn`/`productID`, dar
        // tot acolo pune și codul de piesă al producătorului („MFYM4ZD/A" la
        // Apple). De aceea `mpn` e acceptat ca EAN doar dacă *arată* a EAN —
        // altfel ajungea cod de bare un string cu slash în el.
        ean: firstEan([node.gtin13, node.gtin, node.gtin14, node.mpn, node.productID]),
        mpn: str(node.mpn),
        images: urlsOf(node.image),
        specs,
      }
    }
  }

  return null
}
