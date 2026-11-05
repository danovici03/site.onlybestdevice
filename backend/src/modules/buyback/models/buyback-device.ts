import { model } from "@medusajs/framework/utils"

import BuybackPrice from "./buyback-price"

/**
 * Un model de telefon pe care îl preluăm („iPhone 16 Pro”). Prețurile stau pe
 * stocări, în `buyback_price`; culoarea nu schimbă prețul, e doar informație
 * pentru client și pentru verificarea la primire.
 *
 * `phone_group` leagă modelul de produsele noastre (aceeași cheie ca în
 * `lib/phone-group.ts`), ca adminul să arate prețul nostru de vânzare lângă
 * prețul de preluare. `competitor_*` = prețul maxim public de pe flip.ro
 * (stare perfectă, cea mai mare stocare), doar ca reper.
 */
const BuybackDevice = model
  .define("buyback_device", {
    id: model.id({ prefix: "bbdev" }).primaryKey(),
    brand: model.text().searchable(),
    model: model.text().searchable(),
    handle: model.text().unique(),
    phone_group: model.text().nullable(),
    image_url: model.text().nullable(),
    colors: model.json().nullable(),
    is_active: model.boolean().default(true),
    rank: model.number().default(0),
    competitor_price: model.number().nullable(),
    competitor_ref: model.text().nullable(),
    competitor_checked_at: model.dateTime().nullable(),
    prices: model.hasMany(() => BuybackPrice, { mappedBy: "device" }),
  })
  .cascades({ delete: ["prices"] })
  .indexes([{ on: ["brand"], where: "deleted_at IS NULL" }])

export default BuybackDevice
