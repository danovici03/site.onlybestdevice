import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { PRODUCT_FILTER_MODULE } from "../../modules/product-filter"
import type ProductFilterModuleService from "../../modules/product-filter/service"
import { revalidateStorefront } from "../storefront-revalidate"

/** Dependențele comune rutelor `/admin/product-filters/*`. */
export const deps = (req: MedusaRequest) => ({
  knex: req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any,
  logger: req.scope.resolve(ContainerRegistrationKeys.LOGGER),
  service: req.scope.resolve(PRODUCT_FILTER_MODULE) as ProductFilterModuleService,
})

/** Orice schimbare de filtre schimbă listările: catalogul e în cache sub `products`. */
export const revalidateCatalog = (req: MedusaRequest, what: string) =>
  revalidateStorefront(
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    `product-filters.${what}`,
    ["products"]
  )

/** Eroare de validare zod → 400 cu primul mesaj, în forma pe care o citește adminul. */
export const badRequest = (res: MedusaResponse, error: any) =>
  res.status(400).json({
    message: error?.issues?.[0]
      ? `${error.issues[0].path.join(".") || "body"}: ${error.issues[0].message}`
      : String(error?.message ?? error),
  })

/** Numărul de produse per valoare și per atribut (rânduri vii). */
export async function usageCounts(knex: any) {
  const [byValue, byAttr] = await Promise.all([
    knex("product_filter_value")
      .select("value_id")
      .count("* as n")
      .whereNull("deleted_at")
      .whereNotNull("value_id")
      .groupBy("value_id"),
    knex("product_filter_value")
      .select("attribute_id")
      .countDistinct("product_id as n")
      .whereNull("deleted_at")
      .groupBy("attribute_id"),
  ])
  return {
    byValue: new Map<string, number>(byValue.map((r: any) => [r.value_id, Number(r.n)])),
    byAttr: new Map<string, number>(byAttr.map((r: any) => [r.attribute_id, Number(r.n)])),
  }
}
