import { MedusaService } from "@medusajs/framework/utils"
import FaqCategory from "./models/faq-category"
import FaqItem from "./models/faq-item"

class FaqModuleService extends MedusaService({
  FaqCategory,
  FaqItem,
}) {}

export default FaqModuleService
