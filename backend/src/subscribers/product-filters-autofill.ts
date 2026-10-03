import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

import { syncProductFilters } from "../lib/product-filters/autofill"
import { revalidateStorefront } from "../lib/storefront-revalidate"

/**
 * Completează filtrele produsului la fiecare salvare: produs nou din ERP,
 * fișă tehnică actualizată, produs mutat în altă categorie.
 *
 * Scrie doar în tabelele modulului `product_filter`, nu în produs — deci nu
 * emite alt `product.updated` și nu intră în buclă. `revalidate-storefront.ts`
 * ascultă același eveniment, dar rulează în paralel și poate goli cache-ul
 * înainte să terminăm aici; de aceea revalidăm și noi, după scriere.
 *
 * Oprire de urgență: `PRODUCT_FILTER_AUTOFILL=0` în `.env`.
 */
export default async function productFiltersAutofill({
  event,
  container,
}: SubscriberArgs<{ id?: string; ids?: string[] }>) {
  if (/^(0|false|no)$/i.test(process.env.PRODUCT_FILTER_AUTOFILL ?? "")) return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const data = event.data as { id?: string; ids?: string[] } | undefined
  let ids = data?.ids?.length ? data.ids : data?.id ? [data.id] : []

  // Produsele adăugate într-o categorie din pagina categoriei nu emit
  // `product.updated` — evenimentul e al categoriei. Recalculăm produsele ei;
  // cele scoase rămân cu rânduri pe care catalogul oricum nu le mai citește
  // acolo și se curăță la următoarea lor salvare.
  if (event.name.startsWith("product-category.") && ids.length) {
    const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const rows = await knex("product_category_product")
      .distinct("product_id")
      .whereIn("product_category_id", ids)
    ids = rows.map((r: any) => r.product_id)
  }
  if (!ids.length) return

  try {
    const r = await syncProductFilters(container, ids)
    if (r.rowsCreated || r.rowsDeleted) {
      await revalidateStorefront(logger, `product-filters.${event.name}`, ["products"])
      logger.info(
        `[product-filters] ${event.name}: ${r.rowsCreated} valori scrise, ${r.rowsDeleted} scoase` +
          (r.valuesCreated ? `, ${r.valuesCreated} valori noi` : "")
      )
    }
  } catch (e) {
    logger.warn(`[product-filters] ${event.name} eșuat: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = {
  event: ["product.created", "product.updated", "product-category.updated"],
}
