import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/types"
import { Tag } from "@medusajs/icons"
import { Text } from "@medusajs/ui"

import ProductTagToggle from "../components/product-tag-toggle"

const ProductOutletWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => (
  <ProductTagToggle
    product={product}
    tag="outlet"
    icon={<Tag />}
    title="Outlet / produs expus"
    onLabel="Produs Outlet"
    offLabel="Produs standard"
    onMessage="Produs marcat ca Outlet"
    offMessage="Produs scos din Outlet"
    description={
      <>
        <Text>
          Marchează produsul ca <strong>Outlet</strong> dacă a fost expus în
          magazin sau folosit în scop demonstrativ.
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Tehnic, aplică sau scoate tagul <code>outlet</code> de pe produs.
          Atenție: deocamdată site-ul nu afișează nimic pe baza acestui tag —
          rămâne o etichetă internă până adăugăm badge-ul și regulile de
          garanție pentru produsele expuse.
        </Text>
      </>
    }
  />
)

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductOutletWidget
