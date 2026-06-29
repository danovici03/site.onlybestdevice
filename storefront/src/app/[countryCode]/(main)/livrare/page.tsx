import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import { COMPANY } from "@lib/util/company-info"

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
          <strong>Livrare prin curier (Cargus / Sameday / DPD)</strong> — 20 lei,
          1–3 zile lucrătoare;
        </li>
        <li>
          <strong>Livrare express</strong> — 35 lei, în 24 de ore în orașele
          mari;
        </li>
        <li>
          <strong>Ridicare personală</strong> — gratuit, după confirmarea
          comenzii;
        </li>
        <li>
          <strong>Transport gratuit</strong> pentru comenzile de peste{" "}
          <strong>1.000 lei</strong>.
        </li>
      </ul>
      <p>
        Costurile sunt afișate întotdeauna transparent în coș, înainte de plată.
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
        daune externe" pe documentul curierului. Contactează-ne imediat la{" "}
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
        TODO: confirmați curierii, tarifele și zonele deservite reale înainte de
        lansare.
      </p>
    </InfoPageLayout>
  )
}
