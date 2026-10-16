import { model } from "@medusajs/framework/utils"
import FilterAttribute from "./filter-attribute"

/**
 * În ce categorii apare un filtru și pe ce poziție.
 *
 * `category_id` e id-ul din modulul de produse, ținut ca text: filtrarea se
 * face în SQL direct peste `product_category`, deci un module link n-ar aduce
 * nimic în plus. Subcategoriile moștenesc filtrele părinților.
 */
const FilterAttributeCategory = model
  .define("filter_attribute_category", {
    id: model.id({ prefix: "fattrcat" }).primaryKey(),
    category_id: model.text(),
    rank: model.number().default(0),
    attribute: model.belongsTo(() => FilterAttribute, {
      mappedBy: "categories",
    }),
  })
  .indexes([
    {
      on: ["attribute_id", "category_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    { on: ["category_id"], where: "deleted_at IS NULL" },
  ])

export default FilterAttributeCategory
