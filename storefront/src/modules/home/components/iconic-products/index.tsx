import { buildRailTabs } from "@lib/data/rails"

import IconicProductsGrid from "./iconic-products-grid"

/** Câte produse arată un tab: două rânduri de patru pe desktop. */
const PER_TAB = 8

/**
 * „Produse recomandate" — vitrina de sus a primei pagini.
 *
 * Selecția o face tagul `iconic` de pe produs; ce nu e marcat completează
 * tabul cu produse recente din aceeași categorie, ca secțiunea să nu rămână
 * goală câtă vreme nimeni n-a marcat nimic.
 */
const IconicProducts = async ({ countryCode }: { countryCode: string }) => {
  const tabs = await buildRailTabs({
    kind: "featured",
    countryCode,
    limit: PER_TAB,
  })

  if (!tabs.length) return null

  return <IconicProductsGrid tabs={tabs} />
}

export default IconicProducts
