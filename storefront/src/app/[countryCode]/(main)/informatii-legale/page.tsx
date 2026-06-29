import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import { COMPANY, indirizzoLegale, indirizzoOperativo } from "@lib/util/company-info"

export const metadata: Metadata = {
  title: "Informații legale | onlybestdevice",
  description:
    "Date de identificare obligatorii conform Legii 365/2002 privind comerțul electronic.",
}

export default function InformatiiLegalePage() {
  return (
    <InfoPageLayout
      eyebrow="Documente"
      title="Informații legale"
      description="Date obligatorii conform Legii 365/2002 privind comerțul electronic."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Informații legale" },
      ]}
    >
      <h2>Titularul site-ului</h2>
      <p>
        Site-ul <strong>{COMPANY.baseUrl}</strong> este deținut și administrat
        de:
      </p>

      <div className="not-prose rounded-3xl bg-brand-dark/[0.03] p-6 my-6">
        <p className="font-bold text-brand-dark text-lg mb-2">
          {COMPANY.ragioneSociale}
        </p>
        <p className="text-brand-dark/80 mb-1">
          <strong>Sediu social:</strong> {indirizzoLegale()}
        </p>
        <p className="text-brand-dark/80 mb-1">
          <strong>Punct de lucru:</strong> {indirizzoOperativo()}
        </p>
        <ul className="text-sm text-brand-dark/70 space-y-1 mt-3">
          <li>
            <strong>Formă juridică</strong>: {COMPANY.formaGiuridica}
          </li>
          <li>
            <strong>CUI</strong>: {COMPANY.piva}
          </li>
          <li>
            <strong>Nr. Reg. Comerțului</strong>: {COMPANY.rea}
          </li>
          <li>
            <strong>Capital social</strong>: {COMPANY.capitaleSociale}
          </li>
          <li>
            <strong>Administrator</strong>: {COMPANY.amministratoreUnico}
          </li>
          <li>
            <strong>Email</strong>:{" "}
            <a href={`mailto:${COMPANY.email}`} className="text-brand-accent hover:underline">
              {COMPANY.email}
            </a>
          </li>
          <li>
            <strong>Telefon</strong>: {COMPANY.telefono}
          </li>
        </ul>
      </div>

      <h2>Protecția consumatorilor</h2>
      <p>
        Pentru reclamații te poți adresa{" "}
        <a href="https://anpc.ro/" target="_blank" rel="noreferrer">
          ANPC
        </a>{" "}
        (Autoritatea Națională pentru Protecția Consumatorilor) sau unei entități
        de soluționare alternativă a litigiilor (
        <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noreferrer">
          SAL
        </a>
        ). Platforma europeană de soluționare online a litigiilor (SOL) este
        disponibilă la{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
          ec.europa.eu/consumers/odr
        </a>
        .
      </p>

      <h2>Proprietate intelectuală</h2>
      <p>
        Toate conținuturile publicate pe site (texte, imagini, fotografii,
        grafică, logo, mărci, cod) aparțin {COMPANY.ragioneSociale} sau
        titularilor de drepturi respectivi și sunt protejate de legislația
        privind dreptul de autor (Legea 8/1996) și drepturile de proprietate
        intelectuală. Reproducerea, modificarea, distribuirea sau utilizarea
        comercială a conținutului fără autorizare scrisă este interzisă.
      </p>

      <h2>Limitarea răspunderii</h2>
      <p>
        Deși depunem eforturi pentru exactitatea și actualizarea informațiilor
        publicate, nu ne putem asuma răspunderea pentru eventuale erori sau
        omisiuni, rămânând neatinse drepturile consumatorului prevăzute de lege.
      </p>

      <h2>Documente conexe</h2>
      <ul>
        <li>
          <a href="/termeni">Termeni și condiții</a>
        </li>
        <li>
          <a href="/confidentialitate">Politica de confidențialitate</a>
        </li>
        <li>
          <a href="/cookie">Politica de cookie-uri</a>
        </li>
      </ul>

      <hr />
      <p className="text-xs text-brand-dark/50">
        TODO: completați datele firmei în <code>company-info.ts</code> (CUI, Reg.
        Com., adresă, administrator, capital social).
      </p>
    </InfoPageLayout>
  )
}
