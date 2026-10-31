import { Metadata, Viewport } from "next"
import { Archivo } from "next/font/google"

import { listCatalog } from "@lib/data/products"
import { BLACK_FRIDAY, getBlackFridayPhase } from "@lib/util/black-friday"
import { canonical } from "@lib/util/canonical"
import { emptySelectedFilters } from "@lib/util/product-filters"
import DealCard from "@modules/black-friday/components/deal-card"
import BlackFridayHero from "@modules/black-friday/components/hero"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import "@modules/black-friday/styles.css"

const display = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-bf-display",
  display: "swap",
})

const PAGE_SIZE = 24

export const metadata: Metadata = {
  title: "Black Friday: oferte la telefoane, laptopuri și accesorii",
  description:
    "Black Friday la Onlybestdevice: telefoane, laptopuri, tablete și accesorii la preț redus, cu garanție 24 de luni și plată cu cardul sau în rate.",
  alternates: canonical("/black-friday"),
}

export const viewport: Viewport = { themeColor: "#000000" }

const buildHref = (category?: string, page?: number) => {
  const query = new URLSearchParams()
  if (category) query.set("category", category)
  if (page && page > 1) query.set("page", String(page))
  const qs = query.toString()
  return `/black-friday${qs ? `?${qs}` : ""}#oferte`
}

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<{ category?: string; page?: string }>
}

/**
 * Selecția e cea de pe /oferte, bifa „La ofertă" din admin, plus produsele din
 * price list-ul campaniei cât timp acesta e în desfășurare. Totul e restrâns la
 * produsele în stoc: într-o campanie, un card „Stoc epuizat" doar ocupă loc.
 */
export default async function BlackFridayPage(props: Props) {
  const { countryCode } = await props.params
  const { category, page: pageParam } = await props.searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1") || 1)
  const now = Date.now()
  const phase = getBlackFridayPhase(now)

  const [{ products, count }, all] = await Promise.all([
    listCatalog({
      countryCode,
      sale: true,
      livePriceList: BLACK_FRIDAY.priceList,
      selected: {
        ...emptySelectedFilters(),
        stock: true,
        category: category ? [category] : [],
      },
      page,
      limit: PAGE_SIZE,
    }),
    // Fără filtrul de categorie: lista de butoane trebuie să rămână completă
    // și după ce clientul a ales una.
    listCatalog({
      countryCode,
      sale: true,
      livePriceList: BLACK_FRIDAY.priceList,
      selected: { ...emptySelectedFilters(), stock: true },
      limit: 1,
    }),
  ])

  const categories = all.facets.category
  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <main className={`bf-page ${display.variable}`}>
      <BlackFridayHero now={now} />

      <section id="oferte" className="bf-deals">
        <h2 className="bf-display bf-deals-title">
          {phase === "live" ? "Ofertele de Black Friday" : "Ofertele de acum"}
        </h2>
        <p className="bf-deals-note">
          Garanție 24 de luni, plată cu cardul sau în rate, retur gratuit în 14
          zile.
        </p>

        {categories.length > 1 && (
          <nav className="bf-filters" aria-label="Filtrează după categorie">
            <LocalizedClientLink
              href={buildHref()}
              className="bf-filter"
              aria-current={!category}
            >
              Toate
            </LocalizedClientLink>
            {categories.map(({ value }) => (
              <LocalizedClientLink
                key={value}
                href={buildHref(value)}
                className="bf-filter"
                aria-current={value === category}
              >
                {value}
              </LocalizedClientLink>
            ))}
          </nav>
        )}

        {products.length === 0 ? (
          <p className="bf-empty">
            Nicio ofertă în stoc în această categorie.{" "}
            <LocalizedClientLink href={buildHref()}>
              Vezi toate ofertele
            </LocalizedClientLink>
          </p>
        ) : (
          <ul className="bf-grid" data-testid="products-list">
            {products.map((product, index) => (
              <li key={product.id}>
                <DealCard product={product} priority={index < 4} />
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="bf-pages" aria-label="Paginare">
            {page > 1 && (
              <LocalizedClientLink href={buildHref(category, page - 1)}>
                Pagina anterioară
              </LocalizedClientLink>
            )}
            <span>
              Pagina {page} din {totalPages}
            </span>
            {page < totalPages && (
              <LocalizedClientLink href={buildHref(category, page + 1)}>
                Pagina următoare
              </LocalizedClientLink>
            )}
          </nav>
        )}
      </section>
    </main>
  )
}
