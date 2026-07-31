/**
 * Repară urmele lăsate de un import WooCommerce parțial:
 *
 *  1. produsele ajunse în „Fără categorie" (categoria implicită din WooCommerce)
 *     sunt mutate în categoriile cerute prin FIX_MAP;
 *  2. categoria „fara-categorie", dacă a fost reînviată de import (era ștearsă
 *     la curățarea categoriilor), e ștearsă la loc.
 *
 * Idempotent: la a doua rulare nu mai are ce muta și raportează „nimic de făcut".
 *
 * Rulare:
 *   yarn medusa exec ./src/scripts/fix-imported-categories.ts
 *   DRY_RUN=1 yarn medusa exec ./src/scripts/fix-imported-categories.ts
 *   FIX_MAP='{"handle-produs":["telefoane-mobile","xiaomi"]}' yarn medusa exec ...
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  deleteProductCategoriesWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const DRY_RUN = !!process.env.DRY_RUN
const ORPHAN_CATEGORY = process.env.ORPHAN_CATEGORY || "fara-categorie"

/** handle produs → handle-uri de categorii în care trebuie să ajungă. */
const DEFAULT_MAP: Record<string, string[]> = {
  "telefon-mobil-xiaomi-17-dual-sim-12gb-ram-512gb-5g-green": ["telefoane-mobile", "xiaomi"],
}

export default async function fixImportedCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const map: Record<string, string[]> = process.env.FIX_MAP
    ? JSON.parse(process.env.FIX_MAP)
    : DEFAULT_MAP

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "name"],
  })
  const catByHandle = new Map(categories.map((c: any) => [c.handle, c]))

  const handles = Object.keys(map)
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "categories.id", "categories.handle"],
    filters: { handle: handles },
  } as any)

  const updates: Array<{ id: string; category_ids: string[]; handle: string; from: string[]; to: string[] }> = []
  for (const p of products as any[]) {
    const wanted = map[p.handle] ?? []
    const wantedIds = wanted
      .map((h) => catByHandle.get(h)?.id)
      .filter((id): id is string => !!id)
    const missingCats = wanted.filter((h) => !catByHandle.has(h))
    if (missingCats.length) {
      logger.warn(`Categorii inexistente pentru ${p.handle}: ${missingCats.join(", ")}`)
    }
    const current = (p.categories ?? []).map((c: any) => c.handle)
    // Păstrăm categoriile existente, mai puțin cea implicită, și adăugăm cele cerute.
    const keptIds = (p.categories ?? [])
      .filter((c: any) => c.handle !== ORPHAN_CATEGORY)
      .map((c: any) => c.id)
    const finalIds = [...new Set([...keptIds, ...wantedIds])]
    const finalHandles = finalIds
      .map((id) => (categories as any[]).find((c) => c.id === id)?.handle)
      .filter(Boolean)
    const same =
      finalIds.length === (p.categories ?? []).length &&
      finalIds.every((id) => (p.categories ?? []).some((c: any) => c.id === id))
    if (same) continue
    updates.push({ id: p.id, category_ids: finalIds, handle: p.handle, from: current, to: finalHandles })
  }

  for (const u of updates) {
    logger.info(`${u.handle}: [${u.from.join(", ") || "—"}] → [${u.to.join(", ")}]`)
  }
  const missingProducts = handles.filter((h) => !(products as any[]).some((p) => p.handle === h))
  if (missingProducts.length) logger.warn(`Produse negăsite: ${missingProducts.join(", ")}`)

  // Categoria implicită reînviată de import: o ștergem doar dacă a rămas goală.
  const orphan = catByHandle.get(ORPHAN_CATEGORY)
  let deleteOrphan = false
  if (orphan) {
    const { data: stillInside } = await query.graph({
      entity: "product",
      fields: ["id", "handle"],
      filters: { categories: { handle: ORPHAN_CATEGORY } },
    } as any)
    const remaining = (stillInside as any[]).filter(
      (p) => !updates.some((u) => u.id === p.id)
    )
    if (remaining.length) {
      logger.warn(
        `„${ORPHAN_CATEGORY}" mai conține ${remaining.length} produse — o las pe loc: ` +
          remaining.slice(0, 5).map((p: any) => p.handle).join(", ")
      )
    } else {
      deleteOrphan = true
      logger.info(`„${ORPHAN_CATEGORY}" rămâne goală → o șterg.`)
    }
  }

  if (!updates.length && !deleteOrphan) {
    logger.info("Nimic de făcut.")
    return
  }
  if (DRY_RUN) {
    logger.info("DRY RUN — nimic scris.")
    return
  }

  if (updates.length) {
    await updateProductsWorkflow(container).run({
      input: {
        products: updates.map((u) => ({ id: u.id, category_ids: u.category_ids })),
      } as any,
    })
    logger.info(`✓ ${updates.length} produse recategorisite.`)
  }
  if (deleteOrphan && orphan) {
    await deleteProductCategoriesWorkflow(container).run({ input: [(orphan as any).id] })
    logger.info(`✓ Categoria „${ORPHAN_CATEGORY}" ștearsă.`)
  }
}
