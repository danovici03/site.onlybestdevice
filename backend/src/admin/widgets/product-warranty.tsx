import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/types"
import { ShieldCheck } from "@medusajs/icons"
import { Text } from "@medusajs/ui"

import ProductTagToggle from "../components/product-tag-toggle"

/**
 * Bifa „Garanție extinsă".
 *
 * Spre deosebire de Ofertă sau Recomandat, aici lipsa bifei nu e o valoare
 * implicită rezonabilă, ci decizia: cardul cu +1 an / +2 ani apare pe pagina
 * produsului și în coș DOAR pentru produsele bifate. Un telefon o merită, o
 * husă de 30 lei nu — iar o garanție de 99 lei vândută pe un accesoriu e o
 * greșeală care ajunge la client.
 *
 * Tagul scris trebuie să rămână aliniat cu `WARRANTY_TAG` din storefront
 * (`lib/util/warranty.ts`) și din `scripts/seed-warranty-tag.ts`.
 */
/** Produsul de serviciu însuși — el n-are cum să primească garanție pe el. */
const WARRANTY_HANDLE = "garantie-extinsa"
/** Aliniat cu `WARRANTY_TAG` din storefront și din `seed-warranty-tag.ts`. */
const WARRANTY_TAG = "garantie-extinsa"

const ProductWarrantyWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) =>
  // Fără garda asta, bifa apare și pe „Garanție extinsă", identică cu cea de pe
  // produsele reale. Bifat, produsul și-ar oferi singur garanție pe pagina lui
  // (încă accesibilă după handle, deși e ascuns din catalog).
  product.handle === WARRANTY_HANDLE ? null : (
    <ProductTagToggle
      product={product}
      tag={WARRANTY_TAG}
      icon={<ShieldCheck />}
      title="Garanție extinsă"
      onLabel="Se poate cumpăra"
      offLabel="Nu se oferă"
      onMessage="Produsul poate primi garanție extinsă"
      offMessage="Produsul nu mai primește garanție extinsă"
      description={
        <>
          <Text>
            Bifează dacă la acest produs se poate cumpăra{" "}
            <strong>garanție extinsă</strong>.
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Nebifat, cardul cu +1 an / +2 ani nu apare nici pe pagina
            produsului, nici în coș. Produsele sub pragul de preț nu-l arată
            oricum. Prețurile se editează în produsul „Garanție extinsă".
          </Text>
        </>
      }
    />
  )

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductWarrantyWidget
