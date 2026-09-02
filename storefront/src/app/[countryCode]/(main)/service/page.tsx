import { Metadata } from "next"
import { ArrowUpRight, MapPin, Truck } from "@phosphor-icons/react/dist/ssr"

import InfoPageLayout from "@modules/suport/components/info-page-layout"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Callout from "@modules/suport/components/callout"
import ServiceForm from "@modules/suport/components/service-form"
import { COMPANY } from "@lib/util/company-info"
import { COURIER_NAME, COURIER_PICKUP_URL } from "@lib/util/shipping-tariff"

export const metadata: Metadata = {
  title: "Formular de service | onlybestdevice",
  description:
    "Completează cererea de service pentru un produs defect. După confirmare, chemi curierul să ridice produsul de la tine.",
}

export default function ServicePage() {
  return (
    <InfoPageLayout
      eyebrow="Suport"
      title="Formular de service"
      description="Spune-ne ce produs trimiți și care e problema. Îți răspundem în 24–48 de ore lucrătoare, apoi chemi curierul."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Garanție și service", href: "/garantie" },
        { label: "Formular de service" },
      ]}
    >
      <div className="not-prose">
        <ServiceForm />
      </div>

      <h2>După ce trimiți formularul</h2>
      <p>
        Îți confirmăm preluarea pe email, apoi chemi curierul {COURIER_NAME} să
        ridice produsul de la tine, cu plata taxei de transport la destinatar,
        fără costuri suplimentare pentru tine. Pune în colet o copie a facturii
        de achiziție, datele de contact și descrierea problemei, împreună cu
        toate accesoriile originale.
      </p>

      <Callout icon={<MapPin size={20} />} title="Adresa de expediție">
        <p>
          Pachetul trebuie adresat către {COMPANY.dominio}:
          <br />
          {COMPANY.adresaRetur.via}, {COMPANY.adresaRetur.spatiu}
          <br />
          {COMPANY.adresaRetur.cap} {COMPANY.adresaRetur.citta}, jud.{" "}
          {COMPANY.adresaRetur.judet}
          <br />
          Telefon:{" "}
          <a
            href={`tel:${COMPANY.telefono.replace(/\s+/g, "")}`}
            className="text-brand-accent hover:underline"
          >
            {COMPANY.telefono}
          </a>
        </p>
      </Callout>

      <Callout icon={<Truck size={20} />} title="Cheamă curierul">
        <p>
          Ridicarea se comandă de pe site-ul curierului:{" "}
          <a
            href={COURIER_PICKUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-accent hover:underline inline-flex items-center gap-1"
          >
            cheamă un curier <ArrowUpRight size={14} weight="bold" />
          </a>
          . Condițiile complete de trimitere în service le găsești pe pagina{" "}
          <LocalizedClientLink
            href="/garantie"
            className="text-brand-accent hover:underline"
          >
            Garanție și service
          </LocalizedClientLink>
          .
        </p>
      </Callout>
    </InfoPageLayout>
  )
}
