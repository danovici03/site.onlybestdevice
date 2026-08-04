import { Metadata } from "next"

import { parseSelectedFilters } from "@lib/util/product-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type Params = {
  searchParams: Promise<{
    q?: string
    sortBy?: SortOptions
    page?: string
    brand?: string
    storage?: string
    ram?: string
    color?: string
    price?: string
  }>
  params: Promise<{ countryCode: string }>
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { q } = await props.searchParams
  const term = q?.trim()

  return {
    title: term ? `Căutare: ${term}` : "Căutare",
    description: term
      ? `Produse onlybestdevice pentru „${term}”.`
      : "Caută în catalogul onlybestdevice.",
    // Paginile de căutare n-au ce căuta în index: conținutul lor e o felie din
    // catalog, iar variantele de termeni sunt nelimitate.
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { q, sortBy, page } = searchParams
  const filters = parseSelectedFilters(searchParams)

  return (
    <StoreTemplate
      q={q}
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      filters={filters}
    />
  )
}
