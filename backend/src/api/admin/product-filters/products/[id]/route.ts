import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { badRequest, deps, revalidateCatalog } from "../../../../../lib/product-filters/admin"
import { syncProductFilters } from "../../../../../lib/product-filters/autofill"
import { attributesForCategories, loadFilterConfig } from "../../../../../lib/product-filters/config"

/**
 * Filtrele unui produs, pentru cardul din pagina produsului.
 *
 * GET  — filtrele categoriilor lui, cu valorile curente și sursa (auto/manual)
 * POST { attribute_id, value_ids? , value_number?, reset? }
 *      — fixează manual valoarea (completarea automată n-o mai atinge), sau,
 *        cu `reset: true`, o dă înapoi completării automate
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { knex } = deps(req)
  const productId = req.params.id

  const [config, cats, rows] = await Promise.all([
    loadFilterConfig(knex),
    knex("product_category_product").select("product_category_id").where({ product_id: productId }),
    knex("product_filter_value")
      .select("attribute_id", "value_id", "value_number", "source")
      .where({ product_id: productId })
      .whereNull("deleted_at"),
  ])

  const applicable = attributesForCategories(
    config,
    cats.map((c: any) => c.product_category_id)
  )

  const attributes = applicable.map((a) => {
    const mine = rows.filter((r: any) => r.attribute_id === a.id)
    return {
      id: a.id,
      key: a.key,
      label: a.label,
      type: a.type,
      display: a.display,
      unit: a.unit,
      is_multi: a.is_multi,
      is_global: a.is_global,
      source: mine.some((r: any) => r.source === "manual") ? "manual" : mine.length ? "auto" : null,
      value_ids: mine.map((r: any) => r.value_id).filter(Boolean),
      value_number: mine.find((r: any) => r.value_number != null)?.value_number ?? null,
      values: a.values.map((v) => ({ id: v.id, value: v.value, hex: v.hex })),
    }
  })

  res.json({ attributes, has_categories: cats.length > 0 })
}

const SetSchema = z.object({
  attribute_id: z.string().min(1),
  value_ids: z.array(z.string()).optional(),
  value_number: z.number().finite().nullable().optional(),
  reset: z.boolean().optional(),
})

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = SetSchema.safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error)
  const { knex, service } = deps(req)
  const productId = req.params.id
  const { attribute_id, value_ids, value_number, reset } = parsed.data

  const attribute = await service.retrieveFilterAttribute(attribute_id)

  await knex("product_filter_value").where({ product_id: productId, attribute_id }).delete()

  if (reset) {
    await syncProductFilters(req.scope, [productId], { attributeIds: [attribute_id] })
  } else if (attribute.type === "number") {
    // Manual și gol = „produsul nu are valoarea asta", nu „completează tu".
    // Păstrăm un rând fără număr ca marcaj, altfel completarea l-ar reumple.
    await service.createProductFilterValues({
      product_id: productId,
      attribute_id,
      value_number: value_number ?? null,
      source: "manual",
    } as any)
  } else {
    const ids = [...new Set(value_ids ?? [])]
    const valid = ids.length
      ? await knex("filter_value").select("id").whereIn("id", ids).where({ attribute_id }).whereNull("deleted_at")
      : []
    const keep = attribute.is_multi ? valid : valid.slice(0, 1)
    await service.createProductFilterValues(
      (keep.length ? keep : [{ id: null }]).map((v: any) => ({
        product_id: productId,
        attribute_id,
        value_id: v.id,
        source: "manual",
      })) as any
    )
  }

  await revalidateCatalog(req, "product.updated")
  res.json({ ok: true })
}
