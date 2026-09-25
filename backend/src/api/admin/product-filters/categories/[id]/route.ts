import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { badRequest, deps, revalidateCatalog } from "../../../../../lib/product-filters/admin"
import { attributesForCategories, loadFilterConfig } from "../../../../../lib/product-filters/config"

/**
 * Filtrele unei categorii, pentru cardul din pagina categoriei.
 *
 * GET  — ce filtre vede clientul aici, în ordine: globale, moștenite de la
 *        părinți și proprii categoriei; plus restul filtrelor, de adăugat
 * POST { attribute_ids } — lista completă și ordonată a filtrelor PROPRII
 *        categoriei; cele moștenite și globale nu se schimbă de aici
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { knex } = deps(req)
  const categoryId = req.params.id
  const config = await loadFilterConfig(knex)

  const visible = attributesForCategories(config, [categoryId])
  const brief = (a: (typeof config.attributes)[number]) => ({
    id: a.id,
    key: a.key,
    label: a.label,
    type: a.type,
    unit: a.unit,
    values_count: a.values.length,
  })

  const own = visible
    .filter((a) => a.categoryRanks.has(categoryId))
    .sort((x, y) => x.categoryRanks.get(categoryId)! - y.categoryRanks.get(categoryId)!)
  const global = visible.filter((a) => a.is_global)
  const inherited = visible.filter((a) => !a.is_global && !a.categoryRanks.has(categoryId))
  const visibleIds = new Set(visible.map((a) => a.id))
  const available = config.attributes.filter((a) => !visibleIds.has(a.id))

  res.json({
    own: own.map(brief),
    inherited: inherited.map(brief),
    global: global.map(brief),
    available: available.map(brief),
  })
}

const SetSchema = z.object({ attribute_ids: z.array(z.string()) })

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = SetSchema.safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error)
  const { knex, service } = deps(req)
  const categoryId = req.params.id
  const ids = [...new Set(parsed.data.attribute_ids)]

  await knex("filter_attribute_category").where({ category_id: categoryId }).delete()
  if (ids.length) {
    await service.createFilterAttributeCategories(
      ids.map((attribute_id, i) => ({ attribute_id, category_id: categoryId, rank: i * 10 })) as any
    )
  }
  await revalidateCatalog(req, "category.updated")
  res.json({ ok: true })
}
