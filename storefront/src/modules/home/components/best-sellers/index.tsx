import { buildRailTabs } from "@lib/data/rails"
import ProductRail from "@modules/home/components/product-rail"

/**
 * „Cele mai vândute" — clasamentul din comenzi, pe aceleași taburi de categorie
 * și cu același card ca restul primei pagini.
 *
 * Când o categorie n-are încă istoric de vânzări, tabul se completează cu
 * produsele ei recente (vezi `fetchRailPage`): un tab cu două carduri arată ca
 * o secțiune stricată, nu ca un clasament sincer.
 */
const BestSellers = async ({ countryCode }: { countryCode: string }) => {
  const tabs = await buildRailTabs({ kind: "bestsellers", countryCode })

  if (!tabs.length) return null

  return (
    <ProductRail
      kind="bestsellers"
      countryCode={countryCode}
      title="Cele mai vândute"
      subtitle="Ce aleg cel mai des clienții noștri, pe categorii."
      tabs={tabs}
      ctaHref="/store"
      ctaLabel="Vezi tot catalogul"
    />
  )
}

export default BestSellers
