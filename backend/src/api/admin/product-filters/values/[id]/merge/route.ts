import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

import { badRequest, deps, revalidateCatalog } from "../../../../../../lib/product-filters/admin"

/**
 * POST /admin/product-filters/values/:id/merge  { into_id }
 *
 * Unește valoarea `:id` în `into_id`: produsele trec pe valoarea păstrată,
 * numele și alias-urile celei șterse devin alias-uri ale ei — completarea
 * automată nu mai recreează dublura („Black" rămâne o scriere a lui „Negru").
 */
const MergeSchema = z.object({ into_id: z.string().min(1) })

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = MergeSchema.safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error)
  const { knex } = deps(req)
  const fromId = req.params.id
  const intoId = parsed.data.into_id
  if (fromId === intoId) return res.status(400).json({ message: "O valoare nu se poate uni cu ea însăși." })

  const [from, into] = await Promise.all([
    knex("filter_value").where({ id: fromId }).whereNull("deleted_at").first(),
    knex("filter_value").where({ id: intoId }).whereNull("deleted_at").first(),
  ])
  if (!from || !into) return res.status(404).json({ message: "Valoarea nu există." })
  if (from.attribute_id !== into.attribute_id) {
    return res.status(400).json({ message: "Se pot uni doar valori ale aceluiași filtru." })
  }

  await knex.transaction(async (trx: any) => {
    // Produsele care au deja ambele valori păstrează un singur rând.
    await trx("product_filter_value")
      .where({ value_id: fromId })
      .whereIn(
        "product_id",
        trx("product_filter_value").select("product_id").where({ value_id: intoId }).whereNull("deleted_at")
      )
      .delete()
    await trx("product_filter_value").where({ value_id: fromId }).update({ value_id: intoId, updated_at: new Date() })
    const aliases = [...new Set([...(into.aliases ?? []), from.value, from.slug, ...(from.aliases ?? [])])]
    await trx("filter_value").where({ id: intoId }).update({ aliases, updated_at: new Date() })
    await trx("filter_value").where({ id: fromId }).delete()
  })

  await revalidateCatalog(req, "value.merged")
  res.json({ id: intoId, merged: fromId })
}
