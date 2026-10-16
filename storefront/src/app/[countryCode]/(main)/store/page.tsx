import { Metadata } from "next"
import { canonical } from "@lib/util/canonical"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"
import { parseSelectedFilters } from "@lib/util/product-filters"

export const metadata: Metadata = {
  title: "Magazin",
  description:
    "Toate produsele Onlybestdevice: telefoane, laptopuri, tablete, smartwatch-uri și accesorii noi, cu garanție 24 de luni, plată cu cardul sau în rate.",
  alternates: canonical("/store"),
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

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page } = searchParams
  const filters = parseSelectedFilters(searchParams)

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      filters={filters}
    />
  )
}
