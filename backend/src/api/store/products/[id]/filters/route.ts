import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export type StoreProductFilter = {
  key: string
  label: string
  type: "select" | "number"
  value: string | null
  slug: string | null
  value_number: number | null
  unit: string | null
}

/**
 * Valorile de filtru ale unui produs (marcă, stocare, culoare…), aceleași pe
 * care le folosește catalogul. Pagina produsului ia de aici marca pentru
 * breadcrumb, cu slug-ul din URL-ul listării filtrate (`?brand=apple`).
 *
 * Un atribut `is_multi` poate avea mai multe rânduri; le întoarcem pe toate,
 * în ordinea valorilor din admin.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const knex: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const rows = await knex("product_filter_value as pfv")
    .join("filter_attribute as a", "a.id", "pfv.attribute_id")
    .leftJoin("filter_value as v", function (this: any) {
      this.on("v.id", "=", "pfv.value_id").andOnNull("v.deleted_at")
    })
    .where("pfv.product_id", req.params.id)
    .whereNull("pfv.deleted_at")
    .whereNull("a.deleted_at")
    .select(
      "a.key",
      "a.label",
      "a.type",
      "a.unit",
      "a.rank as attr_rank",
      "v.value",
      "v.slug",
      "v.rank as value_rank",
      "pfv.value_number"
    )
    .orderBy([
      { column: "attr_rank", order: "asc" },
      { column: "a.key", order: "asc" },
      { column: "value_rank", order: "asc" },
    ])

  const filters: StoreProductFilter[] = rows
    // Rând select a cărui valoare a fost ștearsă între timp: nu are ce afișa.
    .filter((r: any) => (r.type === "number" ? r.value_number != null : r.value))
    .map((r: any) => ({
      key: r.key,
      label: r.label,
      type: r.type,
      value: r.value ?? null,
      slug: r.slug ?? null,
      value_number: r.value_number ?? null,
      unit: r.unit ?? null,
    }))

  res.json({ filters })
}
