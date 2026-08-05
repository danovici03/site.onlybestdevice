import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct, DetailWidgetProps } from "@medusajs/types"
import { Suspense, lazy } from "react"

/**
 * Editorul descrierii, pe toată lățimea paginii de produs.
 *
 * `product.details.before` e singura zonă randată în afara grilei cu două
 * coloane — un editor cu poze n-are ce căuta în coloana îngustă din dreapta.
 *
 * Importul e dinamic pentru că modulele de widget sunt importate STATIC în
 * entry-ul generat de admin: fără `lazy`, TipTap ar intra în bundle-ul
 * principal și s-ar descărca pe fiecare pagină de admin, nu doar aici.
 */
const ProductDescriptionEditor = lazy(
  () => import("../components/product-description-editor")
)

const ProductDescriptionWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => (
  <Suspense fallback={null}>
    <ProductDescriptionEditor product={product} />
  </Suspense>
)

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductDescriptionWidget
