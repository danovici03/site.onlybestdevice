import { AdminProduct } from "@medusajs/types"

/**
 * Bife de produs implementate ca taguri.
 *
 * Medusa nu are câmpuri booleene proprii pe produs, iar `metadata` nu se poate
 * filtra în listări. Tagul e singura etichetă pe care o putem și pune dintr-un
 * switch în admin, și interoga eficient din storefront (`/store/catalog`).
 */

type ProductTag = { id: string; value: string }

export const hasTag = (product: AdminProduct, value: string): boolean =>
  (product.tags ?? []).some(
    (t) => (t.value ?? "").toLowerCase() === value.toLowerCase()
  )

/**
 * Id-ul tagului cu valoarea dată, creându-l dacă nu există încă.
 *
 * Prima bifare dintr-o instalație curată n-are ce tag să atașeze — îl creăm
 * atunci, ca operatorul să nu fie nevoit să treacă întâi prin ecranul de taguri.
 */
const resolveTagId = async (value: string): Promise<string> => {
  const listRes = await fetch(
    `/admin/product-tags?value=${encodeURIComponent(value)}&limit=1`,
    { credentials: "include" }
  )
  if (listRes.ok) {
    const body = await listRes.json().catch(() => ({}))
    const found = (body?.product_tags ?? []).find(
      (t: ProductTag) => (t.value ?? "").toLowerCase() === value.toLowerCase()
    )
    if (found?.id) {
      return found.id
    }
  }

  const createRes = await fetch(`/admin/product-tags`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  })
  if (!createRes.ok) {
    const body = await createRes.json().catch(() => ({}))
    throw new Error(
      body?.message || `Eroare la crearea tagului „${value}" (${createRes.status})`
    )
  }
  const created = await createRes.json()
  const id = created?.product_tag?.id
  if (!id) {
    throw new Error(`Tagul „${value}" a fost creat, dar nu a returnat un id`)
  }
  return id
}

/** Tagurile produsului așa cum sunt ACUM pe server. */
const fetchCurrentTags = async (productId: string): Promise<ProductTag[]> => {
  const res = await fetch(`/admin/products/${productId}`, {
    credentials: "include",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      body?.message || `Nu am putut citi tagurile produsului (${res.status})`
    )
  }
  const body = await res.json()
  return (body?.product?.tags ?? []) as ProductTag[]
}

/**
 * Pune sau scoate un singur tag, păstrându-le pe celelalte.
 *
 * Lista de taguri se citește de la server, nu din prop-ul widgetului.
 * `POST /admin/products/:id` înlocuiește lista în întregime, iar pe pagina de
 * produs stau mai multe bife care scriu fiecare setul complet. Scrierea se face
 * cu `fetch`, nu prin SDK, deci cache-ul react-query nu se invalidează și
 * prop-ul rămâne la valoarea de la încărcarea paginii — a doua bifă ar trimite
 * o listă din care lipsește exact ce tocmai a scris prima, ștergându-i tagul.
 */
export const setProductTag = async (
  productId: string,
  value: string,
  next: boolean
): Promise<void> => {
  const current = await fetchCurrentTags(productId)
  const others = current
    .filter((t) => (t.value ?? "").toLowerCase() !== value.toLowerCase())
    .map((t) => ({ id: t.id }))

  const tags = next
    ? [...others, { id: await resolveTagId(value) }]
    : others

  const res = await fetch(`/admin/products/${productId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `Eroare ${res.status}`)
  }
}
