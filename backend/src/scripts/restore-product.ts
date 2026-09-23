/**
 * Readuce din linia de comandă un produs șters din Admin, cu aceleași ID-uri.
 *
 * Pentru un produs sau două e mai simplu din Admin: Produse → Produse șterse →
 * Restaurează. Scriptul rămâne pentru cazurile în masă sau când Adminul nu e la
 * îndemână. Logica e aceeași, în `lib/products/restore.ts` — acolo e explicat ce
 * se restaurează și de ce.
 *
 * Rulare:  cd backend && SKU=IP18492 yarn medusa exec ./src/scripts/restore-product.ts
 *   SKU=IP18492,IP18493     după SKU-ul variantei șterse
 *   PRODUCT_ID=prod_01…     sau direct după id-ul produsului
 *   APPLY=1                 scrie; fără el doar raport
 *
 * După restaurare:
 *   - stocul s-a oprit la momentul ștergerii; push-urile ERP de atunci încoace au
 *     picat. Retrimite-l din gestiune: `php artisan medusa:sync-stock` (sau o
 *     salvare a produsului).
 *   - `medusa exec` NU revalidează storefront-ul (vezi seed-warranty-tag.ts);
 *     dacă produsul e publicat, cheamă manual /api/revalidate cu tagurile
 *     products, categories, carts, best-sellers. Din Admin revalidarea se face
 *     singură.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { restoreDeletedProduct } from "../lib/products/restore"

const list = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

export default async function restoreProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productModule = container.resolve(Modules.PRODUCT)

  const apply = process.env.APPLY === "1"
  const skus = list(process.env.SKU)
  const productIds = new Set(list(process.env.PRODUCT_ID))

  if (!skus.length && !productIds.size) {
    throw new Error("Dă SKU=… sau PRODUCT_ID=… (listă separată prin virgulă).")
  }

  if (skus.length) {
    const variants = await productModule.listProductVariants(
      { sku: skus },
      { withDeleted: true, select: ["id", "sku", "product_id", "deleted_at"] },
    )

    for (const sku of skus) {
      const matches = variants.filter((v) => v.sku === sku)
      const deleted = matches.filter((v) => v.deleted_at)

      if (!matches.length) {
        logger.warn(`[restore] SKU ${sku}: nu există în Medusa, nici șters.`)
      } else if (!deleted.length) {
        logger.info(`[restore] SKU ${sku}: e activ, nu e nimic de restaurat.`)
      }

      for (const v of deleted) productIds.add(v.product_id!)
    }
  }

  let restored = 0

  for (const id of productIds) {
    try {
      const r = await restoreDeletedProduct(container, id, { dryRun: !apply })
      const label = `${r.title} (${r.id})`

      if (r.conflicts.length) {
        logger.error(`[restore] ${label}: sar peste — ${r.conflicts.join("; ")}.`)
      } else if (!r.restored) {
        logger.info(
          `[restore] ${label}: se poate restaura, ${r.variants} variante` +
            (r.exact ? "." : " (fără fotografia de dinainte de ștergere — verifică apoi promoția)."),
        )
      } else {
        restored++
        logger.info(
          `[restore] ${label}: restaurat — ${r.variants} variante, ${r.images} poze, ` +
            `${r.categories} categorii, ${r.sales_channels} sales channel, ` +
            `profil livrare ${r.shipping_profile ? "da" : "NU"}, ` +
            `prețuri ${JSON.stringify(r.prices)}, stoc ${JSON.stringify(r.stock)}.`,
        )
        for (const w of r.warnings) logger.warn(`[restore] ${label}: ${w}`)
      }
    } catch (e) {
      logger.error(`[restore] ${id}: ${(e as Error).message}`)
    }
  }

  logger.info(
    apply
      ? `[restore] gata: ${restored} produse restaurate.`
      : "[restore] DRY RUN — nimic scris. Rulează din nou cu APPLY=1.",
  )
}
