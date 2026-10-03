import { MedusaService } from "@medusajs/framework/utils"
import FilterAttribute from "./models/filter-attribute"
import FilterAttributeCategory from "./models/filter-attribute-category"
import FilterValue from "./models/filter-value"
import ProductFilterValue from "./models/product-filter-value"

class ProductFilterModuleService extends MedusaService({
  FilterAttribute,
  FilterValue,
  FilterAttributeCategory,
  ProductFilterValue,
}) {}

export default ProductFilterModuleService
