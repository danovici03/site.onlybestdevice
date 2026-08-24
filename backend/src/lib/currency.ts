import { Modules } from "@medusajs/framework/utils"

/**
 * Moneda implicită a magazinului.
 *
 * Sursele care scriu prețuri (importul din ERP, cardul de preț din admin) au
 * doar numărul, nu și moneda. Dacă am hardcoda „ron", un magazin configurat pe
 * altă monedă ar primi tăcut prețuri în moneda greșită — de aceea o citim din
 * store, cu `ERP_CURRENCY` ca portiță pentru importuri într-o altă monedă.
 */
export const resolveCurrencyCode = async (container: any): Promise<string> => {
  const forced = process.env.ERP_CURRENCY
  if (forced) return forced.toLowerCase()

  try {
    const storeService = container.resolve(Modules.STORE)
    const stores = await storeService.listStores()
    const currencies = stores?.[0]?.supported_currencies ?? []
    const preferred =
      currencies.find((c: any) => c.is_default) ?? currencies[0]

    if (preferred?.currency_code) return String(preferred.currency_code).toLowerCase()
  } catch {
    // cade pe implicit
  }

  return "ron"
}
