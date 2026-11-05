import { Metadata } from "next"

import { canonical } from "@lib/util/canonical"
import { COMPANY } from "@lib/util/company-info"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import InfoPageLayout from "@modules/suport/components/info-page-layout"

export const metadata: Metadata = {
  title: "Condiții de preluare a telefoanelor",
  description:
    "Cum preluăm telefoanele folosite: oferta online, transportul gratuit, verificarea, plata prin transfer sau voucher și returul.",
  alternates: canonical("/vinde-telefonul/termeni"),
}

const REVISION_DATE = "noiembrie 2026"

/**
 * Condițiile serviciului „Vinde telefonul”. Termenele (verificare, plată) și
 * regulile de retur trebuie să rămână la fel ca în emailurile din
 * `backend/src/modules/resend/templates` și ca în admin.
 */
export default function BuybackTermsPage() {
  return (
    <InfoPageLayout
      eyebrow="Preluare telefoane"
      title="Condiții de preluare"
      description={`Document actualizat în ${REVISION_DATE}. Se aplică versiunea în vigoare la data trimiterii preluării.`}
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Vinde telefonul", href: "/vinde-telefonul" },
        { label: "Condiții" },
      ]}
    >
      <h2>Cine cumpără telefonul</h2>
      <p>
        Telefonul îl cumpără <strong>{COMPANY.ragioneSociale}</strong>, CUI {COMPANY.piva}, nr. Reg. Com.{" "}
        {COMPANY.rea}, cu sediul în {COMPANY.sedeLegale.via}, {COMPANY.sedeLegale.citta}, jud.{" "}
        {COMPANY.sedeLegale.judet}. Ne găsești la <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2>Oferta online</h2>
      <p>
        Oferta se calculează din răspunsurile tale despre model, memorie și starea telefonului și este valabilă 7
        zile. Suma este cea afișată pentru metoda de plată aleasă: transfer bancar sau voucher pe site (cu bonus).
        Oferta pornește de la ce declari; prețul final se confirmă după verificare.
      </p>

      <h2>Predarea telefonului</h2>
      <ul>
        <li>
          <strong>Prin Fan Courier:</strong> îți comanzi singur curierul pe site-ul Fan Courier, cu plata
          transportului la destinatar — transportul către noi îl plătim noi. Pașii și adresa noastră sunt pe pagina
          preluării și în emailul de confirmare; numărul AWB îl treci pe pagina preluării.
        </li>
        <li>
          <strong>În magazin:</strong> la {COMPANY.sedeOperativa.via}, {COMPANY.sedeOperativa.citta}, în
          programul magazinului.
        </li>
      </ul>
      <p>
        Înainte de predare, dezactivează „Găsește-mi iPhone-ul” sau contul Google / Samsung, fă-ți o copie de
        siguranță, resetează telefonul și scoate cartela SIM și cardul de memorie. Nu răspundem pentru datele
        rămase pe telefon; le ștergem oricum la recondiționare.
      </p>

      <h2>Verificarea</h2>
      <p>
        Un tehnician verifică telefonul în cel mult 3 zile lucrătoare de la primire. Dacă starea corespunde
        descrierii, primești suma din ofertă. Dacă diferă, îți trimitem o ofertă revizuită, cu explicația, pe
        care o poți accepta sau refuza din pagina preluării.
      </p>
      <ul>
        <li>Dacă accepți oferta revizuită, plătim suma nouă.</li>
        <li>Dacă o refuzi, îți trimitem telefonul înapoi gratuit, în starea în care l-am primit.</li>
      </ul>

      <h2>Telefoane pe care nu le putem prelua</h2>
      <p>
        Nu preluăm telefoane blocate pe un cont (iCloud, Google, Samsung), raportate ca pierdute sau furate, cu
        IMEI blocat ori altele decât modelul declarat. Le returnăm, iar <strong>costul returului îl plătești
        tu</strong>, la tariful curierului. În cazul telefoanelor raportate ca furate, ne rezervăm dreptul de a
        anunța autoritățile.
      </p>

      <h2>Plata</h2>
      <ul>
        <li>
          <strong>Transfer bancar:</strong> în cel mult 3 zile lucrătoare de la acceptarea prețului final, în
          contul IBAN indicat.
        </li>
        <li>
          <strong>Voucher:</strong> primești pe email un cod valabil 12 luni, pe care îl folosești o singură dată,
          la o comandă pe {COMPANY.baseUrl}. Dacă valoarea comenzii este mai mică decât voucherul, diferența nu
          se păstrează și nu se transformă în bani. Voucherul nu se poate schimba în bani.
        </li>
      </ul>

      <h2>Ce declari când trimiți preluarea</h2>
      <p>
        Confirmi că telefonul îți aparține, că nu provine din furt sau din altă faptă ilegală și că starea
        descrisă este reală. Transferul proprietății are loc la plata prețului final.
      </p>

      <h2>Datele tale</h2>
      <p>
        Pentru borderoul de achiziție (cumpărare de la persoană fizică) îți cerem numele, CNP-ul, seria și numărul
        actului de identitate și adresa de domiciliu — doar după ce oferta finală e acceptată. IBAN-ul îl folosim doar pentru plată. Păstrăm aceste date
        cât ne obligă legislația fiscală și contabilă. Detalii în{" "}
        <LocalizedClientLink href="/confidentialitate">politica de confidențialitate</LocalizedClientLink>.
      </p>
    </InfoPageLayout>
  )
}
