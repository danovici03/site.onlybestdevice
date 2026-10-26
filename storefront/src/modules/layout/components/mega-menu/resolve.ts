import { listCategories } from "@lib/data/categories"
import { listCatalog } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { categorySlug } from "@lib/util/category-slug"
import { getProductPrice } from "@lib/util/get-product-price"
import { emptySelectedFilters } from "@lib/util/product-filters"
import { HttpTypes } from "@medusajs/types"

import {
  MEGA_MENU,
  MegaMenuData,
  MegaMenuItemData,
  MegaMenuProduct,
} from "./data"

// Centrul panoului arată 3 carduri. „Oferte" aduce unul în plus, pentru
// bannerul din dreapta (vezi mai jos).
const PRODUCTS_PER_CATEGORY = 3
const PRODUCTS_FOR_SALE = 4

const toMenuProducts = (
  products: HttpTypes.StoreProduct[]
): MegaMenuProduct[] =>
  products.map((p) => {
    const { cheapestPrice } = getProductPrice({ product: p })
    return {
      title: p.title ?? "",
      handle: p.handle ?? "",
      thumbnail: p.thumbnail ?? null,
      price: cheapestPrice?.calculated_price ?? null,
    }
  })

/**
 * Produsele reale ale fiecărei intrări din mega-meniu, potrivite după handle.
 *
 * Rulează doar în `/api/mega-menu/[countryCode]`, nu în layout: înainte,
 * rezultatul stătea în payload-ul fiecărei pagini (~10 KB la 7 categorii) și
 * se rescria la fiecare regenerare ISR a fiecărei pagini. Acum e un singur
 * fișier static pe CDN, cerut de browser doar când se deschide meniul.
 *
 * Orice eroare de backend aruncă, intenționat. Rezultatul e un singur JSON
 * pentru tot site-ul: un răspuns gol prins într-o fereastră de restart ar
 * rămâne în CDN 12 ore. Când ruta aruncă, ISR păstrează versiunea bună de
 * dinainte (iar la build, build-ul se oprește).
 */
export async function resolveMegaMenuData(
  countryCode: string
): Promise<MegaMenuData> {
  // `getRegion` înghite erorile și întoarce null — fără verificarea asta,
  // backendul căzut ar ieși drept „zero produse" peste tot.
  if (!(await getRegion(countryCode))) {
    throw new Error(`mega-menu: regiunea pentru „${countryCode}" n-a putut fi citită`)
  }

  const categories = await listCategories({ fields: "id,handle", limit: 200 })
  const handleToId = new Map(
    categories.map((c) => [c.handle as string, c.id as string])
  )
  // Rezerva după slug: „pentru-casă" are diacritice în Medusa, dar linkul din
  // meniu e `/categories/pentru-casa`. Handle-ul exact are prioritate, iar la
  // slug-uri identice câștigă prima categorie, nu ultima.
  const slugToId = new Map<string, string>()
  for (const c of categories) {
    const slug = categorySlug(c.handle as string)
    if (!slugToId.has(slug)) slugToId.set(slug, c.id as string)
  }

  const entries = await Promise.all(
    MEGA_MENU.map(async (root) => {
      const items = await Promise.all(
        root.items.map(async (item): Promise<[string, MegaMenuItemData]> => {
          // „Oferte" nu e o categorie: se rezolvă din aceeași sursă ca pagina
          // /oferte (bifa „La ofertă"), altfel meniul ar arăta produse care nu
          // se regăsesc acolo.
          if (item.sale) {
            const { products, count } = await listCatalog({
              countryCode,
              selected: emptySelectedFilters(),
              sale: true,
              limit: PRODUCTS_FOR_SALE,
              listTag: false,
            })
            return [item.href, { count, products: toMenuProducts(products) }]
          }

          const handle = item.href.replace(/^\/categories\//, "")
          const categoryId = handleToId.get(handle) ?? slugToId.get(handle)

          // Categorie ștearsă sau redenumită: intrarea rămâne, cu cardul ei.
          if (!categoryId) {
            return [item.href, { count: 0, products: [] }]
          }

          // Prin catalog, nu prin /store/products: acolo produsele în stoc
          // vin primele, deci meniul nu deschide cu trei „Stoc epuizat".
          const { products, count } = await listCatalog({
            countryCode,
            categoryIds: [categoryId],
            selected: emptySelectedFilters(),
            limit: PRODUCTS_PER_CATEGORY,
            // Fără `product-lists`: orice produs epuizat ar regenera meniul
            // (vezi `cache-tags.ts`). Se reîmprospătează pe `products` și pe
            // TTL.
            listTag: false,
          })

          return [item.href, { count, products: toMenuProducts(products) }]
        })
      )

      // Poza bannerului din dreapta: un produs real din lista de oferte deja
      // adusă mai sus. Fără o cerere în plus și fără poză de stoc — bannerul
      // arată exact un produs pe care clientul îl găsește după click.
      //
      // Centrul afișează primele 3, deci pornim de la al patrulea: altfel, cu
      // „Oferte" selectat în stânga, bannerul ar repeta cardul de lângă el.
      const saleHref = root.items.find((i) => i.sale)?.href
      const saleProducts =
        items.find(([href]) => href === saleHref)?.[1].products ?? []
      const withImage = (p: MegaMenuProduct) => !!p.thumbnail
      const feature =
        saleProducts.slice(3).find(withImage) ??
        saleProducts.find(withImage) ??
        null

      return [root.key, { items: Object.fromEntries(items), feature }] as const
    })
  )

  return Object.fromEntries(entries)
}
