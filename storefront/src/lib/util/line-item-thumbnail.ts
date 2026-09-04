import { HttpTypes } from "@medusajs/types"

/**
 * Poza unei linii din coș.
 *
 * `line_item.thumbnail` e o copie luată la adăugarea în coș din
 * `product.thumbnail`. Produsele la care miniatura n-a fost bifată în Admin au
 * câmpul gol, deși au galerie — în listing nu se vede (cardul cade singur pe
 * `images[0]`), dar în coș, în sertar și în rezumatul de la finalizare rămânea
 * un pătrat gol. Aici căderea e aceeași ca în listing.
 *
 * Cere `*items.product.images` în `fields`-ul coșului, altfel galeria nu vine.
 */
export const lineItemThumbnail = (
  item: HttpTypes.StoreCartLineItem
): string | null => {
  if (item.thumbnail) return item.thumbnail

  const images = item.product?.images ?? item.variant?.product?.images
  if (!images?.length) return null

  // Ordinea din API nu e garantată; miniatura e prima poză după rank, ca în card.
  const first = [...images].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))[0]
  return first?.url ?? null
}
