/**
 * Textul curat dintr-o descriere de produs.
 *
 * Descrierile importate din WooCommerce sunt HTML (text + galeriile de imagini
 * copiate odată cu ele — vezi `backend/src/lib/woo-description.ts`). Oriunde
 * descrierea ajunge într-un context fără markup — `<meta name="description">`,
 * Open Graph, JSON-LD — trebuie trecută pe aici, altfel Google primește
 * `<p><strong>…` în loc de text.
 */
export function descriptionText(description?: string | null): string {
  if (!description) return ""
  return description
    .replace(/<\/(p|div|li|br|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#0?38;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}
