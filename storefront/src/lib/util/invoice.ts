import { HttpTypes } from "@medusajs/types"

/**
 * Cheia din `order.metadata` unde se atașează factura fiscală reală (link
 * către PDF-ul emis de noi), după ce comanda e plată. Nu generăm facturi în
 * site: cât timp cheia lipsește, butonul „Descarcă factura” nu apare.
 */
export const INVOICE_URL_META_KEY = "invoice_url"

export const invoiceUrlFor = (
  order: Pick<HttpTypes.StoreOrder, "metadata">,
): string | null => {
  const url = order.metadata?.[INVOICE_URL_META_KEY]
  return typeof url === "string" && /^https?:\/\//.test(url) ? url : null
}
