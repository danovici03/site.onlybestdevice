import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

type Row = {
  product_id: string
  sold: string
}

const EXCLUDED_ORDER_STATUSES = ["canceled", "archived"]

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit ?? "12"), 10) || 12, 1),
    100
  )
  const categoryId = req.query.category_id
    ? String(req.query.category_id)
    : null

  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

  const builder = knex
    .from("order_line_item AS oli")
    .innerJoin("order_item AS oi", "oi.item_id", "oli.id")
    .innerJoin("order AS o", "o.id", "oi.order_id")
    .whereNotNull("oli.product_id")
    .whereNull("oi.deleted_at")
    .whereNull("oli.deleted_at")
    .whereNull("o.deleted_at")
    .whereNotIn("o.status", EXCLUDED_ORDER_STATUSES)
    .groupBy("oli.product_id")
    .orderByRaw("SUM(oi.quantity) DESC, MAX(o.created_at) DESC")
    .limit(limit)
    .select("oli.product_id AS product_id")
    .select(knex.raw("SUM(oi.quantity)::text AS sold"))

  if (categoryId) {
    builder
      .innerJoin(
        "product_category_product AS pcp",
        "pcp.product_id",
        "oli.product_id"
      )
      .where("pcp.product_category_id", categoryId)
  }

  try {
    const rows = (await builder) as Row[]
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    )
    res.json({
      best_sellers: rows.map((r) => ({
        product_id: r.product_id,
        sold: Number(r.sold),
      })),
    })
  } catch (err) {
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(
      `[best-sellers] query failed: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
    res.json({ best_sellers: [] })
  }
}
