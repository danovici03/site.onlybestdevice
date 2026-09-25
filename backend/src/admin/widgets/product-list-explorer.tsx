import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useRef } from "react"

import ProductExplorer from "../components/product-explorer"

/**
 * Pagina „Produse": lista noastră, cu filtrele din magazin, în locul celei native.
 *
 * Medusa nu are zonă care să ÎNLOCUIASCĂ lista, doar zone în care poți adăuga
 * (`product.list.before` / `after`), iar meniul ei „Adaugă filtru" nu primește
 * filtre noi. Așa că ne randăm deasupra și scoatem lista nativă din pagină.
 *
 * Hack-ul depinde de markup-ul dashboard-ului: `SingleColumnPage` pune
 * widgeturile `before`, apoi lista (un `Container` cu `h1`), ca frați într-un
 * `div.flex-col`. Ascundem primul frate de după noi care are `h1` — adică
 * lista. Dacă Medusa schimbă markup-ul, NU se rupe nimic: lista nativă rămâne
 * vizibilă dedesubt și primim un `console.warn`.
 *
 * Rutele-copil (Creează, Import, Export, Editare) se deschid ca modale peste
 * pagină, prin portal — nu sunt printre frații ascunși.
 */
const GIVE_UP_AFTER_MS = 3_000

const ProductListExplorer = () => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const self = ref.current
    const parent = self?.parentElement
    if (!self || !parent) return

    let hidden: HTMLElement | null = null
    const apply = () => {
      if (hidden?.isConnected) {
        hidden.style.display = "none"
        return
      }
      let el = self.nextElementSibling as HTMLElement | null
      while (el && !el.querySelector("h1")) el = el.nextElementSibling as HTMLElement | null
      if (!el) return
      el.style.display = "none"
      hidden = el
    }
    apply()

    // Lista se poate remonta (erori, schimbarea tabelului configurabil) — un nod
    // nou n-ar mai avea stilul, deci urmărim frații.
    const observer = new MutationObserver(apply)
    observer.observe(parent, { childList: true })

    const timer = window.setTimeout(() => {
      if (!hidden) {
        console.warn(
          "[admin] Nu am găsit lista nativă de produse ca s-o ascund — " +
            "probabil s-a schimbat markup-ul dashboard-ului. Rămâne vizibilă."
        )
      }
    }, GIVE_UP_AFTER_MS)

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
      hidden?.style.removeProperty("display")
    }
  }, [])

  return (
    <div ref={ref}>
      <ProductExplorer />
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "product.list.before",
})

export default ProductListExplorer
