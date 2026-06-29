import { MedusaService } from "@medusajs/framework/utils"
import HeroSlide from "./models/hero-slide"

class HeroModuleService extends MedusaService({
  HeroSlide,
}) {}

export default HeroModuleService
