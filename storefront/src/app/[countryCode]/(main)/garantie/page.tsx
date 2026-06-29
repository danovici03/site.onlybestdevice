import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import { COMPANY } from "@lib/util/company-info"

export const metadata: Metadata = {
  title: "Garanție și service | onlybestdevice",
  description:
    "Garanția legală de conformitate de 24 de luni conform Legii 449/2003 și OUG 140/2021. Cum o activezi și ce acoperă.",
}

export default function GarantiePage() {
  return (
    <InfoPageLayout
      eyebrow="Suport"
      title="Garanție și service"
      description="Toate produsele beneficiază de garanția legală de conformitate de 24 de luni."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Garanție și service" },
      ]}
    >
      <h2>Garanția legală de conformitate — 24 de luni</h2>
      <p>
        Conform Legii 449/2003 și OUG 140/2021 (care transpune Directiva (UE)
        2019/771), toate produsele noi vândute consumatorilor sunt acoperite de
        garanția legală de conformitate pe o durată de{" "}
        <strong>24 de luni</strong> de la livrare. Aceasta este obligatorie prin
        lege: nu poți renunța la ea și nicio clauză contractuală nu o poate
        limita în defavoarea ta.
      </p>

      <h2>Ce înseamnă „lipsă de conformitate"</h2>
      <p>Un produs este conform contractului atunci când, în special:</p>
      <ul>
        <li>
          corespunde descrierii, tipului, cantității și calității prevăzute în
          contract;
        </li>
        <li>
          este adecvat utilizării căreia îi sunt destinate produsele de același
          tip;
        </li>
        <li>
          este furnizat împreună cu toate accesoriile, instrucțiunile și
          actualizările prevăzute.
        </li>
      </ul>

      <h2>Remediile la care ai dreptul</h2>
      <p>În prezența unei lipse de conformitate ai dreptul, la alegere:</p>
      <ul>
        <li>la aducerea în conformitate prin reparare sau înlocuire, gratuit;</li>
        <li>
          la o reducere proporțională a prețului sau la încetarea contractului
          (rambursare), în cazurile prevăzute de lege (de exemplu, când
          remediul solicitat este imposibil sau disproporționat, nu este adus la
          îndeplinire într-un termen rezonabil, ori defectul este suficient de
          grav).
        </li>
      </ul>

      <h2>Cum activezi garanția</h2>
      <p>Pentru a activa garanția legală este suficient să:</p>
      <ul>
        <li>
          ne contactezi prin formularul de{" "}
          <a href="/contact">contact</a>, email la{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> sau telefon la{" "}
          {COMPANY.telefono};
        </li>
        <li>
          indici numărul comenzii și descrii defectul, atașând, dacă e posibil,
          fotografii.
        </li>
      </ul>
      <p>
        Îți răspundem în 24–48 de ore lucrătoare cu indicațiile privind remediul:
        ridicare pentru reparație/înlocuire, trimiterea de piese de schimb sau,
        unde e cazul, rambursare parțială ori totală.
      </p>

      <h2>Ce nu este acoperit</h2>
      <p>
        Nu sunt acoperite de garanție defectele cauzate de uzura normală,
        utilizarea necorespunzătoare sau contrară instrucțiunilor, intervențiile
        de reparație efectuate de terți neautorizați, ori deteriorările
        accidentale (lovituri, lichide). Acestea nu constituie lipsă de
        conformitate.
      </p>

      <h2>Garanția comercială</h2>
      <p>
        Pe lângă garanția legală, anumite produse pot beneficia de o garanție
        comercială suplimentară oferită de producător, cu condițiile și durata
        din certificatul aferent. Garanția comercială, când există, nu
        înlocuiește garanția legală de conformitate.
      </p>

      <hr />
      <p className="text-xs text-brand-dark/50">
        Vânzător: {COMPANY.ragioneSociale}. TODO: validați procedura reală de
        service și textul cu un consilier juridic înainte de lansare.
      </p>
    </InfoPageLayout>
  )
}
