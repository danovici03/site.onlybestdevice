import { model } from "@medusajs/framework/utils"
import FilterAttribute from "./filter-attribute"
import ProductFilterValue from "./product-filter-value"

/**
 * Valoarea canonică a unui filtru select („8 GB", „Negru").
 *
 * `aliases` sunt formele în care apare în fișe și titluri („8GB", „8 GB RAM",
 * „Black", „Midnight"): completarea automată le recunoaște și le leagă aici, în
 * loc să creeze câte o valoare pentru fiecare scriere. Unirea a două valori din
 * admin mută produsele și adaugă numele celei șterse la alias-uri, ca să nu
 * reapară la următoarea completare.
 *
 * `slug` e forma din URL (`?color=negru`).
 */
const FilterValue = model
  .define("filter_value", {
    id: model.id({ prefix: "fval" }).primaryKey(),
    value: model.text().searchable(),
    slug: model.text(),
    hex: model.text().nullable(),
    aliases: model.array().default([]),
    rank: model.number().default(0),
    attribute: model.belongsTo(() => FilterAttribute, { mappedBy: "values" }),
    product_values: model.hasMany(() => ProductFilterValue, {
      mappedBy: "value",
    }),
  })
  .cascades({ delete: ["product_values"] })
  .indexes([
    { on: ["attribute_id", "slug"], unique: true, where: "deleted_at IS NULL" },
  ])

export default FilterValue
