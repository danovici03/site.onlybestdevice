import { Metadata } from "next"
import {
  ArrowUpRight,
  ClipboardText,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
  Warning,
} from "@phosphor-icons/react/dist/ssr"

import InfoPageLayout from "@modules/suport/components/info-page-layout"
import StepCard, { stepCtaClass } from "@modules/suport/components/step-card"
import Callout from "@modules/suport/components/callout"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { COMPANY } from "@lib/util/company-info"
import {
  COURIER_CONTACT_URL,
  COURIER_COVERAGE_URL,
  COURIER_NAME,
  COURIER_PICKUP_URL,
} from "@lib/util/shipping-tariff"

export const metadata: Metadata = {
  title: "Garanție și service | onlybestdevice",
  description:
    "Garanția legală de conformitate 2 ani pentru consumatori și 12 luni pentru persoane juridice, conform OUG 140/2021. Cum trimiți un produs în service.",
}

export default function GarantiePage() {
  return (
    <InfoPageLayout
      wide
      eyebrow="Suport"
      title="Garanție și service"
      description="Garanție legală de conformitate la toate produsele. Trimiterea în service se rezolvă în doi pași."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Garanție și service" },
      ]}
      asideTop={
        <div className="not-prose grid gap-6 md:grid-cols-2 mb-16">
          <StepCard
            step="Pasul 1"
            title="Anunță-ne defectul și completează formularul de service."
            cta={
              <LocalizedClientLink href="/service" className={stepCtaClass}>
                <ClipboardText size={18} weight="bold" />
                Formular de service
              </LocalizedClientLink>
            }
          >
            Scrie-ne numărul comenzii și descrierea problemei, atașând, dacă e
            posibil, fotografii. Îți răspundem în 24–48 de ore lucrătoare cu
            confirmarea și pașii următori.
          </StepCard>

          <StepCard
            step="Pasul 2"
            title="Cheamă un curier, direct la tine acasă."
            cta={
              <a
                href={COURIER_PICKUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={stepCtaClass}
              >
                <Truck size={18} weight="bold" />
                Cheamă un curier acum
                <ArrowUpRight size={16} weight="bold" />
              </a>
            }
          >
            Dacă ai completat formularul de service, te rugăm să contactezi
            curierul pentru a programa preluarea produsului defect.
          </StepCard>
        </div>
      }
    >
      <h2>Cum pregătesc produsul pentru service?</h2>
      <p>
        Înainte de a trimite produsul în service, te rugăm să iei în considerare
        următoarele aspecte, pentru a facilita procesul. Produsul trebuie
        însoțit de o copie a facturii de achiziție și de un document care să
        conțină următoarele informații:
      </p>
      <ul>
        <li>descrierea problemei produsului;</li>
        <li>
          numele și adresa la care dorești să primești aparatul reparat;
        </li>
        <li>numărul de telefon;</li>
        <li>adresa de email;</li>
        <li>toate accesoriile originale ale produsului.</li>
      </ul>
      <p>
        Te rugăm să te asiguri că aparatul este resetat, fără conturi active,
        modele sau coduri de deblocare, cum ar fi funcția „find my
        phone/iPhone" etc. Dacă resetarea sau dezactivarea acestor servicii nu
        este posibilă, te rugăm să ne transmiți datele sau codul de acces.
      </p>

      <h2>Unde trimit produsul?</h2>
      <p>
        Este important de reținut că trebuie să chemi curierul pentru a ridica
        produsul pe care dorești să îl trimiți în service, cu plata taxei de
        transport la destinatar, fără costuri suplimentare pentru tine — valabil
        pentru localitățile din aria de acoperire {COURIER_NAME} (
        <a href={COURIER_COVERAGE_URL} target="_blank" rel="noopener noreferrer">
          vezi lista cu aria de acoperire
        </a>
        ). Pentru a chema un curier, accesează pagina{" "}
        <a href={COURIER_PICKUP_URL} target="_blank" rel="noopener noreferrer">
          cheamă un curier
        </a>{" "}
        sau comandă un curier telefonic — detalii găsești pe{" "}
        <a href={COURIER_CONTACT_URL} target="_blank" rel="noopener noreferrer">
          pagina de contact {COURIER_NAME}
        </a>
        .
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

      <Callout icon={<Package size={20} />} title="Cum împachetezi aparatul">
        <p>
          Aparatul trebuie împachetat corespunzător, ambalat cu folie cu bule
          sau alte elemente de protecție, într-o cutie, pentru a evita
          deteriorarea în timpul transportului. Te rugăm să folosești cutia
          originală sau un alt ambalaj rezistent.
        </p>
      </Callout>

      <Callout
        tone="warning"
        icon={<Warning size={20} />}
        title="Atenție la respectarea procedurii"
      >
        <p>
          Nerespectarea acestei proceduri va duce la returnarea aparatului fără
          a fi adus la conformitate, iar plata transportului retur va fi
          suportată de către client.
        </p>
      </Callout>

      <p>
        Dacă în schimb vrei să returnezi produsul, nu să îl repari, folosește{" "}
        <a href="/retur">formularul de retur</a>.
      </p>

      <h2>Garanția legală de conformitate</h2>
      <p>
        Se referă la protecția juridică a consumatorului rezultată prin efectul
        legii în raport cu lipsa de conformitate, reprezentând obligația legală
        a vânzătorului față de consumator ca, fără solicitarea unor costuri
        suplimentare, să aducă produsul la conformitate — incluzând restituirea
        prețului plătit de consumator, repararea sau înlocuirea produsului —
        dacă acesta nu corespunde cu specificațiile pe care s-a angajat că le
        vinde sau cu publicitatea aferentă.
      </p>
      <p>
        Răspunderea vânzătorului privind garanția legală de conformitate,
        potrivit prevederilor art. 9 alin. 1 din OUG 140/2021, este angajată
        dacă lipsa de conformitate apare într-un termen de <strong>2 ani</strong>
        , calculat de la livrarea produsului. Pentru produsele a căror durată
        medie de utilizare este mai mică de 2 ani, acest termen se reduce la
        durata medie de utilizare.
      </p>
      <p>
        În primul an de la livrarea bunului, consumatorul nu trebuie să
        dovedească neconformitatea, deoarece se consideră că a existat la data
        cumpărării, până la proba contrară sau cu excepția cazurilor când
        această prezumție este incompatibilă cu natura bunului ori a
        neconformității. Pentru perioada cuprinsă între 12 și 24 de luni de la
        livrare, lipsa conformității va trebui să fie dovedită de către
        consumator.
      </p>
      <p>
        Garanția de conformitate și durata medie de utilizare este de{" "}
        <strong>12 luni</strong> pentru persoanele juridice și pentru alți
        profesioniști (persoane fizice autorizate, liber-profesioniști etc.).
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
        Așa cum este definită la art. 2 alin. 12 din OUG 140/2021, garanția
        comercială este „orice angajament din partea garantului față de
        consumator, prevăzut în certificatul de garanție sau în publicitatea
        disponibilă în momentul sau înaintea încheierii contractului, în plus
        față de obligațiile legale care îi revin vânzătorului referitoare la
        garanția de conformitate, de a rambursa prețul plătit ori de a înlocui,
        a repara sau a întreține bunurile în orice mod, în cazul în care acestea
        nu corespund specificațiilor sau oricărei alte cerințe care nu este
        legată de conformitate".
      </p>
      <p>
        Se adresează consumatorilor și poate fi diferită pentru diverse loturi
        de produse, în funcție de existența sau nu a unor promoții. Este oferită
        de producător, distribuitor sau vânzător, în condițiile specificate în
        declarațiile referitoare la garanție și în publicitatea aferentă
        fiecărui produs.
      </p>
      <p>
        În cazul extinderilor de garanție condiționate de înscrierea pe site
        într-o perioadă de timp limitată, sarcina probei revine cumpărătorului.
        De asemenea, pentru a beneficia de garanția comercială, consumatorul are
        în sarcină să dețină documentele (factură, bon și certificat de garanție)
        din care să reiasă clar datele de identificare ale produsului și durata
        garanției comerciale oferite; în caz contrar se pierde dreptul la
        această garanție.
      </p>

      <h2>Garanția legală (tehnică)</h2>
      <p>
        Certificatul de garanție emis pe baza garanției comerciale trebuie să
        precizeze elementele de identificare a produsului, termenul de garanție,
        durata medie de utilizare, modalitățile de asigurare a garanției —
        întreținere, reparare, înlocuire — și termenul de realizare a acestora,
        precum și denumirea și adresa vânzătorului sau ale unității specializate
        de service.
      </p>
      <p>
        În cazul certificatelor de garanție emise de producător sau importator,
        în care unitățile de service sunt precizate explicit, produsele defecte
        pot fi trimise sau predate de client la centrul de service indicat în
        certificat, pentru acordarea garanției.
      </p>

      <Callout
        icon={<ShieldCheck size={20} />}
        title="Ai nevoie de ajutor cu garanția?"
      >
        <p>
          Scrie-ne la{" "}
          <a
            href={`mailto:${COMPANY.email}`}
            className="text-brand-accent hover:underline"
          >
            {COMPANY.email}
          </a>{" "}
          sau sună la{" "}
          <a
            href={`tel:${COMPANY.telefono.replace(/\s+/g, "")}`}
            className="text-brand-accent hover:underline"
          >
            {COMPANY.telefono}
          </a>
          . {COMPANY.orari} — {COMPANY.slaRisposta}
        </p>
      </Callout>
    </InfoPageLayout>
  )
}
