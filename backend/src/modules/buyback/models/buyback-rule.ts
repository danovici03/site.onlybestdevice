import { model } from "@medusajs/framework/utils"

import { RULE_KINDS, RULE_SCOPES } from "../../../lib/buyback/catalog"

/**
 * O regulă de preț care diferă de valoarea implicită din
 * `lib/buyback/catalog.ts`. Lipsa rândului = se folosește valoarea implicită.
 *
 * `scope_value` e "" la global (nu null: indexul unic nu prinde null-urile în
 * Postgres și am putea avea două reguli globale pentru aceeași cheie).
 */
const BuybackRule = model
  .define("buyback_rule", {
    id: model.id({ prefix: "bbrule" }).primaryKey(),
    key: model.text(),
    scope: model.enum([...RULE_SCOPES]).default("global"),
    scope_value: model.text().default(""),
    kind: model.enum([...RULE_KINDS]),
    value: model.float().default(0),
    note: model.text().nullable(),
  })
  .indexes([
    { on: ["key", "scope", "scope_value"], unique: true, where: "deleted_at IS NULL" },
  ])

export default BuybackRule
