import { Metadata } from "next"
import { canonical } from "@lib/util/canonical"

import { parseSelectedFilters } from "@lib/util/product-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Telefoane second hand verificate, cu garanție",
  description:
    "Telefoane și device-uri second hand verificate și testate de Onlybestdevice: grad de aspect, sănătatea bateriei și garanție afișate la fiecare produs. Opțional, baterie nouă sau folie montată.",
  alternates: canonical("/second-hand"),
}

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
    brand?: string
    storage?: string
    ram?: string
    color?: string
    price?: string
  }>
  params: Promise<{
    countryCode: string
  }>
}

/**
 * Lista produselor Second Hand — selecția vine din bifa „Second Hand” din
 * admin (tagul `second-hand`), la fel ca /oferte din bifa „Ofertă”.
 */
export default async function SecondHandPage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page } = searchParams
  const filters = parseSelectedFilters(searchParams)

  return (
    <StoreTemplate
      secondHand
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      filters={filters}
    />
  )
}
