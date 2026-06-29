import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import { COMPANY, indirizzoLegale } from "@lib/util/company-info"

export const metadata: Metadata = {
  title: "Retur produse și drept de retragere | onlybestdevice",
  description:
    "14 zile drept de retragere conform OUG 34/2014. Procedură, rambursări, formular de retragere.",
}

export default function ReturPage() {
  return (
    <InfoPageLayout
      eyebrow="Suport"
      title="Retur produse"
      description="Ai la dispoziție 14 zile să te răzgândești, fără să invoci vreun motiv. Iată cum funcționează."
      breadcrumbs={[{ label: "Acasă", href: "/" }, { label: "Retur produse" }]}
    >
      <h2>Dreptul de retragere — 14 zile</h2>
      <p>
        Conform OUG 34/2014 privind drepturile consumatorilor în cadrul
        contractelor încheiate la distanță, ai dreptul să te retragi din
        contract în termen de <strong>14 zile</strong> de la data la care intri
        în posesia fizică a produsului, fără a fi nevoie să justifici decizia.
      </p>

      <h2>Cum exerciți retragerea</h2>
      <p>Este suficient să:</p>
      <ul>
        <li>
          ne anunți decizia printr-o declarație neechivocă — prin formularul de
          contact, email la{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> sau telefon la{" "}
          {COMPANY.telefono}, indicând numărul comenzii;
        </li>
        <li>
          returnezi produsul, complet, cu accesoriile și ambalajul original, în
          maximum 14 zile de la comunicarea retragerii.
        </li>
      </ul>
      <p>
        Vei primi confirmarea cu instrucțiunile și adresa la care trimiți
        produsul. <strong>Returul este gratuit</strong> — costul de returnare
        este suportat de noi. Pentru a-ți proteja drepturile, păstrează dovada
        expedierii.
      </p>

      <h2>Rambursarea</h2>
      <p>
        Îți rambursăm toate sumele primite (inclusiv costul livrării standard)
        în termen de <strong>14 zile</strong> de la data la care am fost
        informați despre retragere, folosind aceeași metodă de plată folosită la
        achiziție, cu excepția cazului în care ai convenit altfel. Putem amâna
        rambursarea până la primirea produsului sau până la dovada expedierii
        lui, în funcție de care eveniment survine primul.
      </p>

      <h2>Starea produsului returnat</h2>
      <p>
        Ești responsabil doar pentru diminuarea valorii produsului rezultată din
        manipularea acestuia diferit de ceea ce este necesar pentru a-i constata
        natura, caracteristicile și funcționarea. Pe scurt: poți verifica
        produsul ca într-un magazin fizic, dar nu îl folosi dincolo de această
        verificare.
      </p>

      <h2>Excepții de la dreptul de retragere</h2>
      <p>
        Conform art. 16 din OUG 34/2014, dreptul de retragere{" "}
        <strong>nu se aplică</strong>, printre altele, în cazul:
      </p>
      <ul>
        <li>
          produselor sigilate care nu pot fi returnate din motive de protecție a
          sănătății sau de igienă și care au fost desigilate după livrare (ex.
          căști in-ear, anumite accesorii);
        </li>
        <li>
          produselor confecționate după specificațiile tale sau personalizate;
        </li>
        <li>
          conținutului digital / software-ului sigilat desigilat după livrare,
          dacă ai fost de acord cu începerea execuției.
        </li>
      </ul>

      <h2>Garanție vs. retur</h2>
      <p>
        Dreptul de retragere este diferit de garanția legală de conformitate.
        Dacă produsul prezintă un defect, consultă pagina{" "}
        <a href="/garantie">Garanție și service</a>.
      </p>

      <hr />
      <p className="text-xs text-brand-dark/50">
        Operator: {COMPANY.ragioneSociale}, {indirizzoLegale()}. TODO: validați
        politica reală de retur (cine suportă transportul, excepții) și textul cu
        un consilier juridic înainte de lansare.
      </p>
    </InfoPageLayout>
  )
}
