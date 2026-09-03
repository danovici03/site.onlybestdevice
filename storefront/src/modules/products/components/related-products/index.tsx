import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { WARRANTY_TAG } from "@lib/util/warranty"
import { HttpTypes } from "@medusajs/types"
import { ArrowRight } from "@phosphor-icons/react/dist/ssr"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductCard from "../product-card"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  countryCode: string
}

export default async function RelatedProducts({
  product,
  countryCode,
}: RelatedProductsProps) {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  const queryParams: HttpTypes.StoreProductListParams = {}
  if (region?.id) {
    queryParams.region_id = region.id
  }
  if (product.collection_id) {
    queryParams.collection_id = [product.collection_id]
  }
  // Doar tagurile editoriale („la ofertă", „recomandat") spun ceva despre ce
  // seamănă cu ce. `garantie-extinsa` e o bifă de configurare, pusă pe sute de
  // produse fără nicio legătură între ele — lăsată aici, ar dilua raftul până
  // la o selecție aleatorie, fiindcă filtrul Medusa pe `tag_id` e un OR și
  // niciun produs din catalog n-are `collection_id` care să restrângă altfel.
  //
  // Lista rămasă se trimite chiar dacă e goală: `tag_id[]=` gol întoarce zero
  // produse, iar raftul dispare — exact ce se întâmpla înainte pentru produsele
  // fără taguri. Sărind peste `tag_id` am fi cerut în schimb tot catalogul.
  if (product.tags) {
    queryParams.tag_id = product.tags
      .filter((t) => (t.value ?? "").toLowerCase() !== WARRANTY_TAG)
      .map((t) => t.id)
      .filter(Boolean) as string[]
  }
  queryParams.is_giftcard = false

  const products = await listProducts({
    queryParams,
    countryCode,
  }).then(({ response }) => {
    return response.products.filter(
      (responseProduct) => responseProduct.id !== product.id
    )
  })

  if (!products.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-brand-dark">
            S-ar putea să-ți placă și
          </h2>
          <p className="text-sm text-brand-dark/55 max-w-xl">
            Produse din aceeași familie, alese după categorie și etichete.
          </p>
        </div>
        <LocalizedClientLink
          href="/store"
          className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-brand-dark hover:text-brand-accent transition-colors shrink-0"
        >
          Vezi tot catalogul
          <ArrowRight size={16} weight="bold" />
        </LocalizedClientLink>
      </div>

      {/* Aceeași grilă ca în catalog și aceleași carduri: raftul de sub produs
          nu trebuie să arate ca alt magazin. */}
      <ul
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 w-full"
        data-testid="related-products-list"
      >
        {products.slice(0, 4).map((p) => (
          <li key={p.id} className="h-full">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>

      <LocalizedClientLink
        href="/store"
        className="sm:hidden inline-flex items-center justify-center gap-2 bg-white text-brand-dark px-6 py-3.5 rounded-full font-bold text-sm border border-brand-dark/[0.07]"
      >
        Vezi tot catalogul
        <ArrowRight size={16} weight="bold" />
      </LocalizedClientLink>
    </div>
  )
}
