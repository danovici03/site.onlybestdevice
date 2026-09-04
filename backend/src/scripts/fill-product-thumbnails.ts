import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Pune miniatura din galerie pe produsele vechi care au rămas fără `thumbnail`.
 *
 * De acum înainte se ocupă subscriberul `product-thumbnail-fallback`, dar el
 * prinde doar produsele salvate după instalarea lui. Scriptul ăsta e pentru
 * catalogul deja existent — un produs fără miniatură se vede normal în listing
 * (cardul cade pe `images[0]`), dar ajunge cu pătrat gol în coș și, definitiv,
 * în comanda salvată, unde `thumbnail`-ul e o copie luată la adăugarea în coș.
 *
 *   npx medusa exec ./src/scripts/fill-product-thumbnails.ts          # scrie
 *   DRY_RUN=true npx medusa exec ./src/scripts/fill-product-thumbnails.ts
 *
 * După rulare, storefront-ul rămâne pe cache-ul vechi: cheamă `/api/revalidate`.
 */

const DRY_RUN = process.env.DRY_RUN === "true"

export default async function fillProductThumbnails({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "thumbnail", "images.url", "images.rank"],
    filters: { thumbnail: null },
  })

  const candidates = (products as any[]).filter(
    (p) => !p.thumbnail && (p.images?.length ?? 0) > 0
  )

  logger.info(
    `Produse fără miniatură: ${products.length}, dintre care cu galerie: ` +
      `${candidates.length}. ` +
      (DRY_RUN ? "DRY_RUN=true (nu se scrie nimic)." : "Rulare pe bune.")
  )

  let updated = 0

  for (const p of candidates) {
    const thumbnail = [...p.images].sort(
      (a: any, b: any) => (a.rank ?? 0) - (b.rank ?? 0)
    )[0]?.url

    if (!thumbnail) continue

    logger.info(`${p.title} → ${thumbnail}`)

    if (!DRY_RUN) {
      await updateProductsWorkflow(container).run({
        input: { selector: { id: p.id }, update: { thumbnail } as any },
      })
    }

    updated++
  }

  logger.info(
    DRY_RUN
      ? `S-ar fi pus miniatură pe ${updated} produse.`
      : `Miniatură pusă pe ${updated} produse.`
  )
}
