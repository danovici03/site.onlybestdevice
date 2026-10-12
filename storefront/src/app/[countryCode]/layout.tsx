import { listRegions } from "@lib/data/regions"
import { failStaticParams } from "@lib/util/static-params"

/**
 * Țările pentru care se prerandează paginile de sub `[countryCode]`.
 *
 * Fără lista asta, `[countryCode]` era un segment dinamic fără căi cunoscute,
 * deci Next randa la FIECARE cerere homepage-ul și paginile de text (cookie,
 * FAQ, livrare, retur...) — `private, no-store`, câte o funcție Vercel pe
 * vizită, facturată ca CPU + Observability. Doar paginile de produs, categorie
 * și colecție scăpau, fiindcă își declară singure căile.
 *
 * Cu ea, paginile fără API-uri dinamice devin statice (ISR, pe tagurile și
 * TTL-ul fetch-urilor lor). Cele care citesc cookie-uri sau `searchParams`
 * (cont, coș, checkout, căutare, magazin, oferte) rămân dinamice, ca înainte:
 * Next le detectează la build.
 */
export async function generateStaticParams() {
  try {
    const regions = await listRegions()
    const countryCodes = (regions ?? [])
      .flatMap((r) => r.countries?.map((c) => c.iso_2) ?? [])
      .filter((c): c is string => !!c)

    return [...new Set(countryCodes)].map((countryCode) => ({ countryCode }))
  } catch (error) {
    failStaticParams("țări", error)
  }
}

export default function CountryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
