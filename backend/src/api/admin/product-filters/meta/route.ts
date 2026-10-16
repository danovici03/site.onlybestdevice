import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { deps } from "../../../../lib/product-filters/admin"
import { EXTRACTORS } from "../../../../lib/product-filters/extractors"

/**
 * GET /admin/product-filters/meta
 *
 * Ce îi trebuie paginii „Filtre" ca să configureze un filtru fără să ghicească:
 *   - extractors — parserele din cod, pentru dropdown
 *   - categories — arborele de categorii, cu numărul de produse
 *   - spec_labels — etichetele din fișele tehnice (`metadata.specs`), cu câte
 *     produse le au: din ele se aleg sursele unui filtru
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { knex } = deps(req)

  const [categories, specLabels] = await Promise.all([
    knex.raw(`
      SELECT c.id, c.name, c.handle, c.parent_category_id, c.rank,
             COUNT(pcp.product_id)::int AS product_count
      FROM product_category c
      LEFT JOIN product_category_product pcp ON pcp.product_category_id = c.id
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.parent_category_id NULLS FIRST, c.rank, c.name`),
    knex.raw(`
      SELECT k.key AS label, COUNT(*)::int AS product_count,
             (ARRAY_AGG(DISTINCT p.metadata->'specs'->>k.key))[1:5] AS samples
      FROM product p, jsonb_object_keys(p.metadata->'specs') k(key)
      WHERE p.deleted_at IS NULL AND jsonb_typeof(p.metadata->'specs') = 'object'
      GROUP BY k.key
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC
      LIMIT 300`),
  ])

  res.json({
    extractors: Object.entries(EXTRACTORS).map(([id, e]) => ({ id, label: e.label, type: e.type })),
    categories: categories.rows,
    spec_labels: specLabels.rows,
  })
}
