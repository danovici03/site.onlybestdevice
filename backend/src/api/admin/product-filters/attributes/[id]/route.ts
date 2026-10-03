import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { badRequest, deps, revalidateCatalog } from "../../../../../lib/product-filters/admin"
import { AttributeSchema } from "../route"

/**
 * POST   /admin/product-filters/attributes/:id — modificare (câmpuri parțiale)
 * DELETE /admin/product-filters/attributes/:id — șterge filtrul cu valorile lui
 *
 * `category_ids`, dacă e trimis, e lista completă: categoriile lipsă se scot,
 * cele noi se adaugă la coada categoriei respective, iar cele existente își
 * păstrează poziția (aleasă din pagina categoriei).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = AttributeSchema.partial().safeParse(req.body)
  if (!parsed.success) return badRequest(res, parsed.error)
  const { service, knex } = deps(req)
  const id = req.params.id
  const { category_ids, ...data } = parsed.data

  if (data.key) {
    const clash = await knex("filter_attribute")
      .where({ key: data.key })
      .whereNot({ id })
      .whereNull("deleted_at")
      .first()
    if (clash) return res.status(400).json({ message: `Există deja un filtru cu cheia „${data.key}".` })
  }

  const attribute = Object.keys(data).length
    ? await service.updateFilterAttributes({ id, ...data } as any)
    : await service.retrieveFilterAttribute(id)

  if (category_ids) {
    const links = await service.listFilterAttributeCategories({ attribute_id: id } as any)
    const wanted = new Set(category_ids)
    const stale = links.filter((l: any) => !wanted.has(l.category_id)).map((l: any) => l.id)
    if (stale.length) await service.deleteFilterAttributeCategories(stale)
    const have = new Set(links.map((l: any) => l.category_id))
    const fresh = category_ids.filter((c) => !have.has(c))
    if (fresh.length) {
      // La coadă în fiecare categorie: poziția maximă existentă acolo + 10.
      const maxRanks = await knex("filter_attribute_category")
        .select("category_id")
        .max("rank as max")
        .whereIn("category_id", fresh)
        .whereNull("deleted_at")
        .groupBy("category_id")
      const maxOf = new Map<string, number>(maxRanks.map((r: any) => [r.category_id, Number(r.max)]))
      await service.createFilterAttributeCategories(
        fresh.map((category_id) => ({
          attribute_id: id,
          category_id,
          rank: (maxOf.get(category_id) ?? -10) + 10,
        })) as any
      )
    }
  }

  await revalidateCatalog(req, "attribute.updated")
  res.json({ attribute })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { service, knex } = deps(req)
  const id = req.params.id
  // Rândurile de pe produse și legăturile cu categoriile se șterg de tot:
  // cheile unice (atribut, slug) / (atribut, categorie) nu trebuie să rămână
  // blocate de rânduri soft-deleted dacă filtrul e recreat.
  await knex("product_filter_value").where({ attribute_id: id }).delete()
  await knex("filter_attribute_category").where({ attribute_id: id }).delete()
  await knex("filter_value").where({ attribute_id: id }).delete()
  await service.deleteFilterAttributes(id)
  await revalidateCatalog(req, "attribute.deleted")
  res.json({ id, deleted: true })
}
