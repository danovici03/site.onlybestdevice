import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { badRequest, deps, revalidateCatalog } from "../../../../../lib/product-filters/admin"
import { matchKey, slugify } from "../../../../../lib/product-filters/normalize"
import { ValueSchema } from "../../attributes/[id]/values/route"

/**
 * POST   /admin/product-filters/values/:id — redenumire, culoare, alias-uri, poziție
 * DELETE /admin/product-filters/values/:id — scoate valoarea de pe toate produsele
 *
 * Redenumirea schimbă și slug-ul (URL-ul filtrului); numele vechi intră la
 * alias-uri, ca fișele care îl mai conțin să nimerească tot aici.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = ValueSchema.partial().safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error)
  const { service, knex } = deps(req)
  const current = await service.retrieveFilterValue(req.params.id)
  const update: Record<string, unknown> = { id: current.id, ...parsed.data }

  if (parsed.data.value && parsed.data.value !== current.value) {
    const slug = slugify(parsed.data.value)
    if (!slug) return res.status(400).json({ message: "Valoarea trebuie să conțină litere sau cifre." })
    const clash = await knex("filter_value")
      .where({ attribute_id: (current as any).attribute_id, slug })
      .whereNot({ id: current.id })
      .whereNull("deleted_at")
      .first()
    if (clash) {
      return res.status(400).json({
        message: `Valoarea „${clash.value}" există deja — folosește „Unește" ca să le combini.`,
      })
    }
    update.slug = slug
    const aliases = new Set([...(parsed.data.aliases ?? (current as any).aliases ?? []), current.value])
    update.aliases = [...aliases]
  }

  const value = await service.updateFilterValues(update as any)
  await revalidateCatalog(req, "value.updated")
  res.json({ value })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { knex } = deps(req)
  const value = await knex("filter_value").where({ id: req.params.id }).whereNull("deleted_at").first()
  if (!value) return res.status(404).json({ message: "Valoarea nu există." })

  // Numele, slug-ul și alias-urile intră în lista de excluse a filtrului: altfel
  // completarea automată ar recrea valoarea la prima salvare a unui produs a
  // cărui fișă o conține. Adăugată din nou manual, iese din listă.
  const keys = [value.value, value.slug, ...(value.aliases ?? [])].map(matchKey).filter(Boolean)
  await knex.transaction(async (trx: any) => {
    await trx("product_filter_value").where({ value_id: value.id }).delete()
    await trx("filter_value").where({ id: value.id }).delete()
    const attr = await trx("filter_attribute").select("excluded_values").where({ id: value.attribute_id }).first()
    const excluded = [...new Set([...(attr?.excluded_values ?? []), ...keys])]
    await trx("filter_attribute").where({ id: value.attribute_id }).update({ excluded_values: excluded, updated_at: new Date() })
  })
  await revalidateCatalog(req, "value.deleted")
  res.json({ id: req.params.id, deleted: true })
}
