import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/types"
import { Star } from "@medusajs/icons"
import { Text } from "@medusajs/ui"

import ProductTagToggle from "../components/product-tag-toggle"

/**
 * Bifa „Recomandat".
 *
 * Secțiunea „Produse recomandate" de pe prima pagină e o selecție redacțională,
 * la fel ca Ofertele: produsele bifate aici urcă în fața tabului lor. Cât timp
 * nu e nimic bifat, secțiunea arată produsele recente din fiecare categorie —
 * deci bifa adaugă control, nu golește pagina dacă e uitată.
 *
 * Tagul scris trebuie să rămână aliniat cu `FEATURED_TAG` din storefront
 * (`lib/data/rails.ts`).
 */
const ProductFeaturedWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => (
  <ProductTagToggle
    product={product}
    tag="recomandat"
    icon={<Star />}
    title="Recomandat"
    onLabel="Recomandat"
    offLabel="Produs obișnuit"
    onMessage="Produs adăugat la Produse recomandate"
    offMessage="Produs scos din Produse recomandate"
    description={
      <>
        <Text>
          Bifează dacă produsul intră în{" "}
          <strong>Produse recomandate</strong>, pe prima pagină.
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Produsele bifate apar primele în tabul categoriei lor. Fără nicio
          bifă, secțiunea arată cele mai noi produse din fiecare categorie.
        </Text>
      </>
    }
  />
)

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductFeaturedWidget
