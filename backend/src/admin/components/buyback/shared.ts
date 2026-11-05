export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message || `Cererea a eșuat: ${res.status}`)
  return body as T
}

export type BuybackPriceRow = {
  id: string
  storage: string
  base_price: number | null
  sale_price: number | null
}

export type BuybackDevice = {
  id: string
  brand: string
  model: string
  handle: string
  phone_group: string | null
  image_url: string | null
  colors: string[] | null
  is_active: boolean
  rank: number
  competitor_price: number | null
  competitor_checked_at: string | null
  prices: BuybackPriceRow[]
}

export type RuleKind = "fixed" | "percent" | "reject"
export type RuleScope = "global" | "brand" | "device"

export type RuleDef = {
  key: string
  label: string
  section: "refuz" | "ecran" | "carcasa" | "baterie" | "defecte" | "setari"
  group?: string
  kinds: RuleKind[]
  default: { kind: RuleKind; value: number }
  setting?: boolean
  globalOnly?: boolean
  help?: string
}

export type RuleRow = {
  id: string
  key: string
  scope: RuleScope
  scope_value: string
  kind: RuleKind
  value: number
  note: string | null
}

export const lei = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("ro-RO")} lei`

export const KIND_LABEL: Record<RuleKind, string> = {
  fixed: "Sumă fixă (lei)",
  percent: "Procent din bază",
  reject: "Refuz",
}

export const SECTION_LABEL: Record<RuleDef["section"], string> = {
  refuz: "Refuz / rețea",
  ecran: "Ecran",
  carcasa: "Carcasă și ramă",
  baterie: "Baterie",
  defecte: "Alte defecte",
  setari: "Setări ofertă",
}

/** „256GB” → „256 GB”, cum scrie pe cutie. */
export const storageLabel = (s: string) => s.replace(/(\d)(GB|TB)$/, "$1 $2")
