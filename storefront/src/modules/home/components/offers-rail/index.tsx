import { buildRailTabs } from "@lib/data/rails"
import ProductRail from "@modules/home/components/product-rail"

/**
 * „Oferte" — produsele bifate „La ofertă" în admin, adică selecția echipei.
 *
 * Nu se deduce din preț: aproape tot catalogul are un `compare_at_price`, deci
 * un criteriu automat ar urca aici tot magazinul. Aceeași sursă ca /oferte, ca
 * secțiunea de pe prima pagină și pagina de oferte să nu se contrazică.
 */
const OffersRail = async ({ countryCode }: { countryCode: string }) => {
  const tabs = await buildRailTabs({ kind: "sale", countryCode })

  if (!tabs.length) return null

  return (
    <ProductRail
      kind="sale"
      countryCode={countryCode}
      title="Oferte"
      subtitle="Alese de echipa noastră: prețuri reduse la produse pe care le recomandăm."
      tabs={tabs}
      ctaHref="/oferte"
      ctaLabel="Vezi toate ofertele"
    />
  )
}

export default OffersRail
