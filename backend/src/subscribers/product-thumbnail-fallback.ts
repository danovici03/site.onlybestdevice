import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

/**
 * Pune miniatura pe produsele care au galerie, dar n-au `thumbnail`.
 *
 * În Admin, „Miniatura" e o bifă separată de galerie: se pot încărca zece poze
 * și produsul să rămână cu `thumbnail: null`. În listing nu se vede (cardul
 * cade singur pe `images[0]`), dar `thumbnail` e câmpul copiat în linia de coș
 * la adăugare și de acolo mai departe în comandă — deci un produs fără el
 * ajungea cu pătrat gol în coș, în sertar, în rezumatul de la finalizare și,
 * definitiv, în comanda salvată, unde nu mai există galerie pe care să cazi.
 *
 * Fără buclă: `product.updated`-ul provocat de scrierea de aici găsește la a
 * doua trecere miniatura pusă și iese imediat.
 */

const idsOf = (data: unknown): string[] => {
  const list = Array.isArray(data) ? data : [data]
  return list
    .map((d) => (d as { id?: string })?.id)
    .filter((id): id is string => typeof id === "string")
}

export default async function fillProductThumbnail({
  event,
  container,
}: SubscriberArgs<{ id: string } | { id: string }[]>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)

  for (const id of idsOf(event.data)) {
    let thumbnail: string | null
    let images: { url: string; rank?: number }[]

    try {
      const product = await productModule.retrieveProduct(id, {
        select: ["id", "thumbnail"],
        relations: ["images"],
      })
      thumbnail = product?.thumbnail ?? null
      images = (product?.images ?? []) as { url: string; rank?: number }[]
    } catch (e) {
      // Produsul poate fi șters între emiterea evenimentului și procesarea lui.
      logger.debug(
        `Miniatură produs: nu am putut citi produsul ${id}: ${(e as Error).message}`
      )
      continue
    }

    if (thumbnail || !images.length) continue

    // Aceeași ordine ca în storefront: prima poză după rank.
    const next = [...images].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))[0]?.url
    if (!next) continue

    await updateProductsWorkflow(container).run({
      input: { selector: { id }, update: { thumbnail: next } as any },
    })

    logger.info(`Miniatură pusă din galerie pentru ${id}: ${next}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated"],
}
