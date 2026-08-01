import Medusa from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL
}

// ATENȚIE: nu adăuga aici un wrapper peste `sdk.client.fetch` care citește
// cookie-uri (ex. localea vizitatorului). A existat unul și a fost cauza pentru
// care NICIO pagină nu se prerandă: fiecare apel SDK trecea prin `cookies()`,
// iar Next marchează ruta dinamică chiar dacă excepția e prinsă în try/catch.
// Localea per-vizitator nu are ce căuta pe paginile cache-uite partajat; unde
// contează per-utilizator (coșul), ea e setată pe cart la `updateLocale`.
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})
