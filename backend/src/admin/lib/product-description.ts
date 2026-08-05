import { sanitizeWooHtml } from "../../lib/woo-description"

/**
 * Citirea și scrierea descrierii unui produs din Admin.
 *
 * Descrierea trece prin ACELAȘI sanitizator ca pe server (subscriberul
 * `product-description-sanitize`), rulat aici înainte de trimitere. Nu e o
 * dublare inutilă: altfel operatorul ar salva, ar vedea textul lui, iar o
 * secundă mai târziu serverul l-ar rescrie pe tăcute. Așa vede pe loc exact ce
 * s-a scris, iar subscriberul iese pe `next === current`.
 *
 * Ca la `product-tags.ts`: scrierea se face cu `fetch`, nu prin SDK, deci
 * prop-ul `data` al widgetului rămâne la valoarea de la încărcarea paginii.
 * De aceea citim mereu de la server înainte de a scrie.
 */

/** Opțiunile sanitizatorului pentru textul scris din admin. */
const SANITIZE = { allowLinks: true } as const

export const sanitizeDescription = (html: string): string =>
  sanitizeWooHtml(html, SANITIZE).html

export class DescriptionConflictError extends Error {
  constructor(readonly serverValue: string) {
    super("Descrierea s-a schimbat pe server între timp")
    this.name = "DescriptionConflictError"
  }
}

export async function fetchProductDescription(productId: string): Promise<string> {
  const res = await fetch(`/admin/products/${productId}`, {
    credentials: "include",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      body?.message || `Nu am putut citi descrierea produsului (${res.status})`
    )
  }
  const body = await res.json()
  return (body?.product?.description ?? "") as string
}

/**
 * Salvează descrierea, întorcând HTML-ul efectiv scris (cel sanitizat).
 *
 * `expectedCurrent` e valoarea de la care a pornit editarea: dacă serverul are
 * altceva, altcineva (sau alt tab) a salvat între timp și aruncăm
 * `DescriptionConflictError` în loc să-i suprascriem munca. Cu `force` se
 * suprascrie intenționat.
 */
export async function saveProductDescription(
  productId: string,
  html: string,
  opts: { expectedCurrent?: string; force?: boolean } = {}
): Promise<string> {
  const description = sanitizeDescription(html)

  if (!opts.force && opts.expectedCurrent !== undefined) {
    const server = await fetchProductDescription(productId)
    if (server !== opts.expectedCurrent) {
      throw new DescriptionConflictError(server)
    }
  }

  const res = await fetch(`/admin/products/${productId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `Eroare la salvare (${res.status})`)
  }

  return description
}
