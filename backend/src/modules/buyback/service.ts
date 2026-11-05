import { MedusaService } from "@medusajs/framework/utils"

import BuybackDevice from "./models/buyback-device"
import BuybackOrder from "./models/buyback-order"
import BuybackPrice from "./models/buyback-price"
import BuybackRule from "./models/buyback-rule"

class BuybackModuleService extends MedusaService({
  BuybackDevice,
  BuybackOrder,
  BuybackPrice,
  BuybackRule,
}) {}

export default BuybackModuleService
