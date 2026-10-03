/**
 * Tipurile și cererile comune ecranelor de filtre din admin: pagina „Filtre",
 * cardul de pe produs și cel de pe categorie. Formele oglindesc răspunsurile
 * rutelor din `src/api/admin/product-filters/**` — acolo e sursa adevărului.
 */

export type FilterType = "select" | "number"
export type FilterDisplay = "chips" | "swatch"

export type AdminFilterValue = {
  id: string
  value: string
  slug: string
  hex: string | null
  aliases: string[]
  rank: number
  product_count: number
}

export type AdminFilterAttribute = {
  id: string
  key: string
  label: string
  type: FilterType
  display: FilterDisplay
  unit: string | null
  is_global: boolean
  is_multi: boolean
  /** Completarea automată nu creează valori noi — doar potrivește pe cele existente. */
  closed_values: boolean
  sources: string[]
  extractor: string | null
  rank: number
  category_ids: string[]
  product_count: number
  values: AdminFilterValue[]
}

export type FilterMeta = {
  extractors: { id: string; label: string; type: FilterType }[]
  categories: {
    id: string
    name: string
    handle: string
    parent_category_id: string | null
    rank: number
    product_count: number
  }[]
  spec_labels: { label: string; product_count: number; samples: string[] | null }[]
}

export type AutofillReport = {
  products: number
  rowsCreated: number
  rowsDeleted: number
  valuesCreated: number
}

/**
 * `fetch` cu sesiunea adminului. Erorile rutelor vin ca `{ message }`; le
 * ridicăm ca `Error`, ca apelantul să le arate direct în toast.
 */
export async function filtersApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/admin/product-filters${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `Cererea a eșuat: ${res.status}`)
  }
  return res.json()
}

export const postJson = <T>(path: string, body: unknown) =>
  filtersApi<T>(path, { method: "POST", body: JSON.stringify(body) })

/** Textul din toast după o completare automată. */
export const describeReport = (r: AutofillReport): string => {
  const parts = [`${r.rowsCreated} valori scrise`, `${r.rowsDeleted} scoase`]
  if (r.valuesCreated) parts.push(`${r.valuesCreated} valori noi`)
  return `${r.products} produse verificate: ${parts.join(", ")}.`
}

/** Aceeași formă de slug ca `lib/product-filters/normalize.ts` din backend. */
export const slugifyKey = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)

/** „6.1 inch", „5000 mAh" — numerele din real vin cu zecimale parazite. */
export const formatNumber = (n: number, unit: string | null): string => {
  const rounded = Math.round(n * 100) / 100
  return `${rounded.toLocaleString("ro-RO")}${unit ? ` ${unit}` : ""}`
}
