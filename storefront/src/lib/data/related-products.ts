import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { isInStock } from "@lib/util/stock"
import { WARRANTY_TAG } from "@lib/util/warranty"
import { HttpTypes } from "@medusajs/types"

/** Câte carduri arată raftul „S-ar putea să-ți placă și”. */
const SHELF_SIZE = 4

export const listRelatedProducts = async (
  product: HttpTypes.StoreProduct,
  countryCode: string
): Promise<HttpTypes.StoreProduct[]> => {
  const region = await getRegion(countryCode)

  if (!region) {
    return []
  }

  const queryParams: HttpTypes.StoreProductListParams = {
    region_id: region.id,
    is_giftcard: false,
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
  // Atenție: o listă goală nu ajunge la Medusa, SDK-ul elimină array-urile goale
  // din query. Fără etichete editoriale raftul primește primele produse din
  // catalog, deci aceleași pe aproape toate paginile.
  if (product.tags) {
    queryParams.tag_id = product.tags
      .filter((t) => (t.value ?? "").toLowerCase() !== WARRANTY_TAG)
      .map((t) => t.id)
      .filter(Boolean) as string[]
  }

  const { response } = await listProducts({
    queryParams,
    countryCode,
    noStore: true,
  })

  // Cele în stoc în față (sortarea e stabilă, restul ordinii rămâne): raftul
  // arată doar primele, care nu trebuie să fie epuizate.
  return response.products
    .filter((related) => related.id !== product.id)
    .sort((a, b) => Number(isInStock(b)) - Number(isInStock(a)))
    .slice(0, SHELF_SIZE)
}
