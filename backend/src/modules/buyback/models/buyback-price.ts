import { model } from "@medusajs/framework/utils"

import BuybackDevice from "./buyback-device"

/**
 * Prețul de bază pentru un model + stocare: telefon perfect, deblocat, plată
 * prin transfer. Din el scad regulile. `base_price` null = stocarea apare în
 * listă, dar nu facem ofertă pentru ea (încă n-ai pus preț).
 *
 * Stocarea se scrie ca în catalog: „128GB”, „1TB”.
 */
const BuybackPrice = model
  .define("buyback_price", {
    id: model.id({ prefix: "bbprc" }).primaryKey(),
    storage: model.text(),
    base_price: model.number().nullable(),
    device: model.belongsTo(() => BuybackDevice, { mappedBy: "prices" }),
  })
  .indexes([
    { on: ["device_id", "storage"], unique: true, where: "deleted_at IS NULL" },
  ])

export default BuybackPrice
