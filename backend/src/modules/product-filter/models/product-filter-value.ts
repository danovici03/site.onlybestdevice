import { model } from "@medusajs/framework/utils"
import FilterAttribute from "./filter-attribute"
import FilterValue from "./filter-value"

/**
 * Valoarea unui filtru pe un produs.
 *
 * Tabel propriu, nu `product.metadata`: catalogul filtrează și numără în SQL,
 * iar peste JSON nu se pot pune indexuri utile. Un atribut select poate avea
 * mai multe rânduri pe produs (`is_multi`); unul numeric are exact unul, cu
 * `value_number`.
 *
 * `source`:
 *   auto   — scris de completarea automată; se rescrie la fiecare salvare
 *   manual — ales în admin; completarea automată nu-l mai atinge
 */
const ProductFilterValue = model
  .define("product_filter_value", {
    id: model.id({ prefix: "pfv" }).primaryKey(),
    product_id: model.text(),
    value_number: model.float().nullable(),
    source: model.enum(["auto", "manual"]).default("auto"),
    attribute: model.belongsTo(() => FilterAttribute, {
      mappedBy: "product_values",
    }),
    value: model
      .belongsTo(() => FilterValue, { mappedBy: "product_values" })
      .nullable(),
  })
  .indexes([
    { on: ["product_id"], where: "deleted_at IS NULL" },
    { on: ["attribute_id", "value_id"], where: "deleted_at IS NULL" },
    { on: ["attribute_id", "value_number"], where: "deleted_at IS NULL" },
  ])

export default ProductFilterValue
