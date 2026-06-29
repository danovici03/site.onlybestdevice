import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion, listRegions } from "@lib/data/regions"
import { listProductReviews } from "@lib/data/reviews"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ review_sort?: string; review_page?: string }>
}

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    if (!countryCodes) {
      return []
    }

    const promises = countryCodes.map(async (country) => {
      const { response } = await listProducts({
        countryCode: country,
        queryParams: { limit: 100, fields: "handle" },
      })

      return {
        country,
        products: response.products,
      }
    })

    const countryProducts = await Promise.all(promises)

    return countryProducts
      .flatMap((countryData) =>
        countryData.products.map((product) => ({
          countryCode: countryData.country,
          handle: product.handle,
        }))
      )
      .filter((param) => param.handle)
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { handle } = params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  const desc =
    (product.description?.replace(/\s+/g, " ").trim().slice(0, 160)) ||
    `${product.title} — disponibil pe onlybestdevice, cu garanție și livrare rapidă.`

  return {
    title: product.title,
    description: desc,
    openGraph: {
      title: `${product.title} | onlybestdevice`,
      description: desc,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const searchParams = await props.searchParams
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const pricedProduct = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: params.handle },
  }).then(({ response }) => response.products[0])

  if (!pricedProduct) {
    notFound()
  }

  const upgradeHandles = (() => {
    const raw = (pricedProduct.metadata ?? {}) as Record<string, unknown>
    const list = Array.isArray(raw.upgrades) ? raw.upgrades : []
    return list.filter((h): h is string => typeof h === "string" && h.length > 0)
  })()

  const [upgrades, reviewStats] = await Promise.all([
    upgradeHandles.length
      ? listProducts({
          countryCode: params.countryCode,
          queryParams: {
            handle: upgradeHandles,
            limit: upgradeHandles.length,
          },
        }).then(({ response }) =>
          upgradeHandles
            .map((h) => response.products.find((p) => p.handle === h))
            .filter((p): p is HttpTypes.StoreProduct => !!p)
        )
      : Promise.resolve([] as HttpTypes.StoreProduct[]),
    listProductReviews(pricedProduct.id, { limit: 1 }).then((d) => d.stats),
  ])

  // Date structurate Product (schema.org) pentru rezultate îmbogățite în Google.
  const variantPrices = (pricedProduct.variants ?? [])
    .map((v) => (v as any).calculated_price?.calculated_amount)
    .filter((n): n is number => typeof n === "number" && n > 0)
  const lowPrice = variantPrices.length ? Math.min(...variantPrices) : undefined
  const currency =
    (pricedProduct.variants?.[0] as any)?.calculated_price?.currency_code ||
    region.currency_code ||
    "ron"
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")
  const productUrl = `${baseUrl}/${params.countryCode}/products/${pricedProduct.handle}`
  const rating = (reviewStats as any)?.average_rating
  const ratingCount = (reviewStats as any)?.count

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: pricedProduct.title,
    image: (pricedProduct.images ?? [])
      .map((i) => i.url)
      .filter(Boolean)
      .slice(0, 6),
    description: pricedProduct.description ?? pricedProduct.title,
    sku: pricedProduct.variants?.[0]?.sku || undefined,
    brand: { "@type": "Brand", name: "onlybestdevice" },
    ...(lowPrice
      ? {
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: currency.toUpperCase(),
            price: lowPrice,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
    ...(typeof rating === "number" && ratingCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating,
            reviewCount: ratingCount,
          },
        }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductTemplate
        product={pricedProduct}
        region={region}
        countryCode={params.countryCode}
        upgrades={upgrades}
        reviewStats={reviewStats}
        reviewSort={searchParams.review_sort}
        reviewPage={searchParams.review_page}
      />
    </>
  )
}
