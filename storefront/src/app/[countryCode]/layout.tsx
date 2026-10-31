import { listRegions } from "@lib/data/regions"
import { failStaticParams } from "@lib/util/static-params"
import { notFound } from "next/navigation"

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

/**
 * Middleware-ul lasă să treacă orice cale cu punct (o ia drept fișier static),
 * așa că `/page-sitemap.xml` — sitemap-urile vechi de pe WordPress, încă
 * trimise în Search Console — ajungea aici cu `countryCode = "page-sitemap.xml"`
 * și primea homepage-ul cu 200. Google raporta „Sitemap is HTML" și, pe
 * deasupra, vedea home-ul duplicat la oricâte adrese. Un segment care nu e cod
 * de țară e 404.
 */
export default async function CountryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  if (!/^[a-z]{2}$/i.test(countryCode)) notFound()

  return children
}
