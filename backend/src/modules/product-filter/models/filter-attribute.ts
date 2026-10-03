import { model } from "@medusajs/framework/utils"
import FilterAttributeCategory from "./filter-attribute-category"
import FilterValue from "./filter-value"
import ProductFilterValue from "./product-filter-value"

/**
 * Un filtru din magazin („Memorie RAM", „Diagonală ecran", „Tip căști").
 *
 * `key` e numele parametrului din URL (`?ram=8-gb`), deci e contract public:
 * schimbat, rupe linkurile deja indexate. Nu poate fi un parametru rezervat al
 * catalogului — lista e în `lib/product-filters/constants.ts`.
 *
 *   type   select  → valori canonice (`filter_value`), bife în magazin
 *          number  → număr pe produs, interval cu slider în magazin
 *   display chips | swatch (pastile de culoare, citesc `filter_value.hex`)
 *
 * Completarea automată citește, în ordine, `extractor` (parsere din cod, ex.
 * marca din titlu) și `sources` (etichete din `metadata.specs`, ex.
 * „Memorie RAM", „RAM"). `is_multi` sparge valoarea din fișă după virgulă —
 * „Wi-Fi, Bluetooth, NFC" devine trei valori.
 *
 * `closed_values` = completarea automată nu creează valori noi: ce nu se
 * potrivește cu o valoare sau un alias existent se ignoră. Pentru liste mici și
 * stabile (culori, „Wi-Fi / Wi-Fi + Cellular"), unde fișele scriu altceva decât
 * valoarea în jumătate din cazuri.
 *
 * `excluded_values` = cheile de potrivire (`matchKey`) ale valorilor șterse
 * din admin. Fără ele, o valoare-gunoi ștearsă reapărea la prima salvare a
 * unui produs a cărui fișă o conține.
 *
 * `is_global` = filtrul apare în orice listă (marca). Altfel apare doar în
 * categoriile legate și în subcategoriile lor.
 */
const FilterAttribute = model
  .define("filter_attribute", {
    id: model.id({ prefix: "fattr" }).primaryKey(),
    key: model.text(),
    label: model.text().searchable(),
    type: model.enum(["select", "number"]).default("select"),
    display: model.enum(["chips", "swatch"]).default("chips"),
    unit: model.text().nullable(),
    is_global: model.boolean().default(false),
    is_multi: model.boolean().default(false),
    closed_values: model.boolean().default(false),
    sources: model.array().default([]),
    excluded_values: model.array().default([]),
    extractor: model.text().nullable(),
    rank: model.number().default(0),
    values: model.hasMany(() => FilterValue, { mappedBy: "attribute" }),
    categories: model.hasMany(() => FilterAttributeCategory, {
      mappedBy: "attribute",
    }),
    product_values: model.hasMany(() => ProductFilterValue, {
      mappedBy: "attribute",
    }),
  })
  .cascades({ delete: ["values", "categories", "product_values"] })
  .indexes([{ on: ["key"], unique: true, where: "deleted_at IS NULL" }])

export default FilterAttribute
