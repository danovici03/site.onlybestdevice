import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/types"
import { ReceiptPercent } from "@medusajs/icons"
import { Text } from "@medusajs/ui"

import ProductTagToggle from "../components/product-tag-toggle"

/**
 * Bifa „La ofertă".
 *
 * Aproape tot catalogul are un preț tăiat (`compare_at_price`), deci „are
 * reducere" nu poate fi criteriul de listare — pagina /oferte ar deveni tot
 * catalogul. Oferta e o selecție redacțională: intră doar produsele bifate aici.
 */
const ProductSaleWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => (
  <ProductTagToggle
    product={product}
    tag="oferta"
    icon={<ReceiptPercent />}
    title="Ofertă"
    onLabel="La ofertă"
    offLabel="Preț normal"
    onMessage="Produs adăugat la Oferte"
    offMessage="Produs scos din Oferte"
    description={
      <>
        <Text>
          Bifează dacă produsul face parte din <strong>ofertele curente</strong>.
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Doar produsele bifate apar pe pagina <code>/oferte</code> și primesc
          badge-ul „Ofertă" în listări. Prețul tăiat singur nu e suficient —
          aproape toate produsele au unul, așa că selecția o faci de aici.
        </Text>
      </>
    }
  />
)

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductSaleWidget
