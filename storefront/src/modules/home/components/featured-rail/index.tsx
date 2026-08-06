import { buildRailTabs } from "@lib/data/rails"
import ProductRail from "@modules/home/components/product-rail"

/**
 * „Produse recomandate" — vitrina de sus a primei pagini.
 *
 * Selecția o face bifa „Recomandat" din admin: produsele bifate stau primele
 * în tabul categoriei lor, restul e catalogul recent, ca secțiunea să nu
 * rămână goală cât timp nimeni n-a bifat nimic.
 */
const FeaturedRail = async ({ countryCode }: { countryCode: string }) => {
  const tabs = await buildRailTabs({ kind: "featured", countryCode })

  if (!tabs.length) return null

  return (
    <ProductRail
      kind="featured"
      countryCode={countryCode}
      title="Produse recomandate"
      subtitle="Alegerile echipei, pe categorii."
      tabs={tabs}
      ctaHref="/store"
      ctaLabel="Vezi tot catalogul"
    />
  )
}

export default FeaturedRail
