import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct, DetailWidgetProps } from "@medusajs/types"
import { Suspense, lazy } from "react"

/**
 * Importul de pe link, deasupra editorului de descriere.
 *
 * Aceeași zonă ca widgetul „Descriere" (`product.details.before`, singura
 * randată pe toată lățimea): panoul are un tabel de specificații și o grilă de
 * poze, care în coloana îngustă din dreapta ar fi ilizibile.
 *
 * Import dinamic din același motiv ca acolo — modulele de widget sunt importate
 * static în entry-ul generat de admin, deci fără `lazy` panoul ar călători cu
 * fiecare pagină de dashboard, nu doar cu pagina de produs.
 */
const ProductImportPanel = lazy(() => import("../components/product-import-panel"))

const ProductImportWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => (
  <Suspense fallback={null}>
    <ProductImportPanel product={product} />
  </Suspense>
)

export const config = defineWidgetConfig({
  zone: "product.details.before",
})

export default ProductImportWidget
