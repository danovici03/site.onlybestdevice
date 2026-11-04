import { Metadata } from "next"
import { canonical } from "@lib/util/canonical"

import InfoPageLayout from "@modules/suport/components/info-page-layout"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ReturnForm from "@modules/suport/components/return-form"

export const metadata: Metadata = {
  title: "Cerere de retur",
  description:
    "Trimite online cererea de retur pentru o comandă Onlybestdevice, cu sau fără cont: numărul comenzii, emailul și produsele pe care le returnezi.",
  alternates: canonical("/retur/cerere"),
}

export default function CerereReturPage() {
  return (
    <InfoPageLayout
      eyebrow="Suport"
      title="Cerere de retur"
      description="Introdu numărul comenzii și emailul cu care ai comandat, apoi alege produsele pe care vrei să le returnezi."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Retur produse", href: "/retur" },
        { label: "Cerere de retur" },
      ]}
    >
      <div className="not-prose">
        <ReturnForm />
      </div>

      <h2>Înainte să trimiți</h2>
      <p>
        Ai 14 zile de la livrare să returnezi produsele, fără să invoci vreun
        motiv. Verifică{" "}
        <LocalizedClientLink href="/retur">condițiile de retur</LocalizedClientLink>{" "}
        — unele categorii (produse Apple activate, căști, consumabile) au reguli
        proprii.
      </p>
    </InfoPageLayout>
  )
}
