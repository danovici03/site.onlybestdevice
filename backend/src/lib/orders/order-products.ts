import { SH_SERVICES_HANDLE } from "../second-hand"
import { WARRANTY_HANDLE } from "../warranty-prices"

type OrderLine = {
  title?: string | null
  product_title?: string | null
  product_handle?: string | null
  quantity?: unknown
}

const lineLabel = (line: OrderLine): string => {
  const title = line.product_title || line.title || "Produs fără nume"
  const quantity = Number(line.quantity)
  return quantity > 1 ? `${quantity} × ${title}` : title
}

/**
 * Ce s-a vândut într-o comandă, pentru coloana „Produs vândut” din admin.
 *
 * Garanția extinsă e o linie separată în comandă, dar pentru cine se uită în
 * listă e o opțiune a produsului, nu un produs. Apare doar dacă e singura
 * linie, ca lista să nu pară o comandă goală.
 */
export const listOrderProducts = (
  items: (OrderLine | null)[] | null | undefined
): string[] => {
  const lines = (items ?? []).filter((item): item is OrderLine => !!item)
  const products = lines.filter(
    (line) =>
      line.product_handle !== WARRANTY_HANDLE &&
      line.product_handle !== SH_SERVICES_HANDLE
  )
  return (products.length ? products : lines).map(lineLabel)
}
