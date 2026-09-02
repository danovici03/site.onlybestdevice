import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { CategoryCrumb } from "@lib/data/categories"

export type ProductCrumb = {
  name: string
  href: string
  /**
   * Verigă spre o listare filtrată, nu spre o pagină canonică. Rămâne în
   * navigația vizibilă, dar iese din BreadcrumbList: Google ignoră lanțul
   * întreg dacă un element trimite spre un URL necanonic.
   */
  filtered?: boolean
}

/**
 * Lanțul de navigare de deasupra titlului: categorie → marcă → telefon.
 *
 * Marca e adesea chiar ultima categorie („Telefoane mobile / Samsung"); în
 * cazul ăla nu o mai repetăm, altfel o adăugăm ca filtru pe categorie.
 * Ultimul element e modelul, nu titlul complet al variantei: „Samsung Galaxy
 * S26", nu „Samsung Galaxy S26, 256GB, Sky Blue" — titlul întreg e oricum
 * imediat dedesubt și ar ocupa două rânduri în coloana îngustă.
 */
export const buildProductCrumbs = ({
  path,
  brand,
}: {
  path: CategoryCrumb[]
  brand?: string | null
}): ProductCrumb[] => {
  const crumbs: ProductCrumb[] = path.map((crumb, i) => ({
    name: crumb.name,
    href: `/categories/${path
      .slice(0, i + 1)
      .map((c) => c.slug)
      .join("/")}`,
  }))

  const already = path.some(
    (c) => c.name.toLowerCase() === (brand ?? "").toLowerCase()
  )

  if (brand && !already) {
    const base = crumbs.length ? crumbs[crumbs.length - 1].href : "/store"
    crumbs.push({
      name: brand,
      href: `${base}?brand=${encodeURIComponent(brand)}`,
      filtered: true,
    })
  }

  return crumbs
}

const ProductBreadcrumbs = ({
  crumbs,
  current,
}: {
  crumbs: ProductCrumb[]
  current: string
}) => {
  if (!crumbs.length) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-[0.2em] font-bold text-brand-dark/50"
      data-testid="product-breadcrumbs"
    >
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-2">
          {i > 0 && <span className="text-brand-dark/30">/</span>}
          <LocalizedClientLink
            href={crumb.href}
            className="hover:text-brand-dark transition-colors"
          >
            {crumb.name}
          </LocalizedClientLink>
        </span>
      ))}
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-brand-dark/30">/</span>
        <span className="text-brand-dark/80 truncate">{current}</span>
      </span>
    </nav>
  )
}

export default ProductBreadcrumbs
