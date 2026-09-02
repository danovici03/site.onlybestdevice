import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import { COMPANY } from "@lib/util/company-info"
import {
  COURIER_NAME,
  COURIER_SURCHARGE_PRIORITY,
  COURIER_TARIFF_PRIORITY_BREAKDOWN,
  COURIER_TARIFF_STANDARD,
} from "@lib/util/shipping-tariff"

export const metadata: Metadata = {
  title: "Livrarea comenzilor | onlybestdevice",
  description:
    "Termene, costuri și modalități de livrare prin curier. Ce faci în cazul unui colet deteriorat.",
}

export default function LivrarePage() {
  return (
    <InfoPageLayout
      eyebrow="Suport"
      title="Livrarea comenzilor"
      description="Tot ce trebuie să știi despre termenele, costurile și modalitățile de livrare."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Livrarea comenzilor" },
      ]}
    >
      <h2>Termene de livrare</h2>
      <p>
        Comenzile plasate în zilele lucrătoare sunt expediate, de regulă, în
        24–48 de ore. Livrarea prin curier în România se face de obicei în{" "}
        <strong>1–3 zile lucrătoare</strong>. Data estimată este afișată în coș
        înainte de finalizarea comenzii.
      </p>

      <h2>Modalități și costuri</h2>
      <ul>
        <li>
          <strong>Livrare prin {COURIER_NAME}</strong> —{" "}
          {COURIER_TARIFF_STANDARD}, 1–3 zile lucrătoare;
        </li>
        <li>
          <strong>Livrare prioritară prin {COURIER_NAME}</strong> —{" "}
          {COURIER_TARIFF_PRIORITY_BREAKDOWN} (tariful standard plus{" "}
          {COURIER_SURCHARGE_PRIORITY} pentru prioritate), comanda este
          procesată și expediată înaintea celorlalte;
        </li>
        <li>
          <strong>Ridicare personală de la locația magazinului</strong> —
          gratuit, termen de procesare 1–2 zile lucrătoare; te anunțăm pe email
          când comanda este disponibilă în magazin.
        </li>
      </ul>

      <h2>Cum se plătește transportul</h2>
      <p>
        <strong>
          Taxa de transport nu este încasată de noi și nu este inclusă în totalul
          comenzii.
        </strong>{" "}
        O achiți direct curierului {COURIER_NAME}, la primirea coletului, odată
        cu semnarea de primire. Tariful este afișat în coș și în pagina de
        finalizare a comenzii, înainte să plasezi comanda, iar suma pe care o
        plătești online (sau prin rate) acoperă doar produsele.
      </p>
      <p>
        Dacă alegi <strong>plata la livrare (ramburs)</strong>, curierul
        încasează într-o singură tranzacție atât contravaloarea produselor, cât
        și taxa de transport.
      </p>
      <p>
        Pentru transport, documentul fiscal îl emite {COURIER_NAME}; factura
        noastră cuprinde doar produsele comandate.
      </p>

      <h2>Verificarea coletului la livrare</h2>
      <p>
        Înainte de a semna de primire, verifică integritatea coletului. Ai
        dreptul să <strong>deschizi și să verifici produsul în prezența
        curierului</strong> înainte de a plăti (la comenzile cu plata la
        livrare).
      </p>

      <h2>Colet deteriorat sau livrare greșită</h2>
      <p>
        Dacă observi deteriorări evidente ale ambalajului, poți refuza coletul
        sau îl poți accepta cu mențiunea „accept cu rezerva de verificare pentru
        daune externe” pe documentul curierului. Contactează-ne imediat la{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> sau{" "}
        {COMPANY.telefono}, atașând fotografii și numărul comenzii, iar noi
        rezolvăm situația (înlocuire sau rambursare).
      </p>

      <h2>Întârzieri</h2>
      <p>
        Dacă livrarea întârzie semnificativ față de data estimată, scrie-ne și
        verificăm statusul expedierii cu curierul. Răspunderea pentru
        deteriorarea în timpul transportului ne revine până la momentul predării
        către tine.
      </p>

      <hr />
      <p className="text-xs text-brand-dark/50">
        TODO: confirmați zonele deservite și eventualele suprataxe {COURIER_NAME}{" "}
        (localități izolate, colete voluminoase) înainte de lansare.
      </p>
    </InfoPageLayout>
  )
}
