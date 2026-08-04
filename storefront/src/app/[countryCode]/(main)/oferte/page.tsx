import { Metadata } from "next"

import { parseSelectedFilters } from "@lib/util/product-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Oferte",
  description:
    "Produsele onlybestdevice aflate acum la ofertă — telefoane, laptopuri și accesorii la preț redus.",
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
 * Lista ofertelor curente.
 *
 * Selecția vine din bifa „La ofertă" de pe produs (tagul `oferta`), nu din
 * prețul tăiat: aproape tot catalogul are `compare_at_price`, deci un criteriu
 * automat ar aduce aici tot magazinul.
 */
export default async function OffersPage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page } = searchParams
  const filters = parseSelectedFilters(searchParams)

  return (
    <StoreTemplate
      sale
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      filters={filters}
    />
  )
}
