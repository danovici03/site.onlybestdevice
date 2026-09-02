import { Metadata } from "next"
import {
  AppleLogo,
  ArrowUpRight,
  ClipboardText,
  Clock,
  Headphones,
  Lightning,
  MapPin,
  MusicNotes,
  Package,
  Prohibit,
  Truck,
} from "@phosphor-icons/react/dist/ssr"

import InfoPageLayout from "@modules/suport/components/info-page-layout"
import StepCard, { stepCtaClass } from "@modules/suport/components/step-card"
import Callout from "@modules/suport/components/callout"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { COMPANY } from "@lib/util/company-info"
import { COURIER_PICKUP_URL } from "@lib/util/shipping-tariff"

export const metadata: Metadata = {
  title: "Retur produse și drept de retragere | onlybestdevice",
  description:
    "14 zile drept de retragere conform OUG 34/2014. Cerere de retur în doi pași, condiții, adresa de retur și termenul de rambursare.",
}

/** Categoriile cu reguli proprii de retur. */
const CONDITII_SPECIALE = [
  {
    icon: <AppleLogo size={20} />,
    title: "Produse Apple",
    text: "Nu se pot returna dacă sunt activate, cu excepția cazului în care prezintă defecte.",
  },
  {
    icon: <MusicNotes size={20} />,
    title: "Muzică și filme, birotică și papetărie, licențe software, jocuri PC și console",
    text: "Se returnează doar cu ambalajul original nedesfăcut sau dacă prezintă un defect de funcționare.",
  },
  {
    icon: <Lightning size={20} />,
    title: "Becuri, lanterne, prelungitoare, prize, baterii, acumulatori și încărcătoare",
    text: "Se returnează doar cu ambalajul original nedesfăcut sau dacă prezintă un defect de funcționare.",
  },
  {
    icon: <Headphones size={20} />,
    title: "Căști audio, in-ear și over-ear",
    text: "Se returnează doar cu ambalajul original nedesfăcut sau dacă prezintă un defect de funcționare.",
  },
]

export default function ReturPage() {
  return (
    <InfoPageLayout
      wide
      eyebrow="Suport"
      title="Retur produse"
      description="Ai la dispoziție 14 zile să te răzgândești, fără să invoci vreun motiv. Se rezolvă în doi pași."
      breadcrumbs={[{ label: "Acasă", href: "/" }, { label: "Retur produse" }]}
      asideTop={
        <div className="not-prose grid gap-6 md:grid-cols-2 mb-16">
          <StepCard
            step="Pasul 1"
            title="Completează declarația online de retur și adaugă formularul în colet."
            cta={
              <LocalizedClientLink href="/account/orders" className={stepCtaClass}>
                <ClipboardText size={18} weight="bold" />
                Cerere de retur
              </LocalizedClientLink>
            }
          >
            Ai la dispoziție 14 zile de la data achiziționării să returnezi un
            produs. Înainte de a completa declarația de returnare, te rugăm să
            consulți condițiile de retur de mai jos.
          </StepCard>

          <StepCard
            step="Pasul 2"
            title="Cheamă un curier FAN, direct la tine acasă."
            cta={
              <a
                href={COURIER_PICKUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={stepCtaClass}
              >
                <Truck size={18} weight="bold" />
                Cheamă un curier
                <ArrowUpRight size={16} weight="bold" />
              </a>
            }
          >
            Este important de reținut că este necesar să chemi curierul să ridice
            produsul pe care vrei să îl returnezi, cu plata taxei de transport la
            destinatar, fără costuri suplimentare.
          </StepCard>
        </div>
      }
    >
      <h2>Ce trebuie să știi</h2>
      <ul>
        <li>
          Ca să returnezi produsele vândute de {COMPANY.dominio}, te rugăm să
          accesezi și să completezi <strong>cererea de retur</strong>.
        </li>
        <li>
          Este necesar să chemi curierul să ridice produsul pe care vrei să îl
          returnezi, cu plata taxei de transport la destinatar, fără ca tu să ai
          alte costuri suplimentare — o poți face din pagina{" "}
          <a href={COURIER_PICKUP_URL} target="_blank" rel="noopener noreferrer">
            cheamă un curier
          </a>
          .
        </li>
        <li>
          Asigură-te că produsul pe care vrei să îl returnezi îndeplinește
          condițiile de retur de mai jos.
        </li>
        <li>
          Dacă vrei să returnezi mai multe bucăți din același produs este
          suficient să completezi o singură cerere de retur. Dacă vrei să
          returnezi mai multe produse diferite, completează câte o cerere pentru
          fiecare dintre acestea.
        </li>
        <li>
          Pentru returnarea contravalorii produselor în întregime, produsele
          returnate trebuie să fie în aceeași stare în care au fost livrate (în
          ambalajul original nedeteriorat, cu toate accesoriile și documentele
          care le-au însoțit, fără modificări fizice, lovituri sau zgârieturi).
        </li>
      </ul>

      <h2>Durata de rambursare</h2>
      <p>
        Rambursarea sumei aferente returului se face în termen de{" "}
        <strong>14 zile</strong> de la data la care {COMPANY.dominio} intră în
        posesia returului, iar cererea de retur a fost aprobată.
      </p>
      <p>
        Ziua în care consumatorul își exercită dreptul de retragere din contract
        nu se ia în calcul la stabilirea termenului, iar dacă ultima zi a
        termenului este o zi nelucrătoare, termenul se prelungește până în prima
        zi lucrătoare. Dacă rambursarea nu poate fi făcută în acest termen,
        cumpărătorul va fi informat și, cu acordul acestuia, se va stabili o nouă
        dată de rambursare a sumei aferente returului.
      </p>

      <h2>Procedură de retur produse</h2>
      <p>
        În conformitate cu legislația în vigoare privind protecția
        consumatorilor, după înregistrarea cererii de retur, consumatorul are
        obligația de a expedia produsul respectând următoarele condiții:
      </p>

      <h3>Condiții de returnare</h3>
      <ul>
        <li>
          produsul trebuie returnat în starea în care a fost livrat, fără
          deteriorări, împreună cu toate accesoriile și ambalajul original;
        </li>
        <li>
          produsul trebuie ambalat corespunzător pentru a preveni deteriorările
          în timpul transportului;
        </li>
        <li>
          societatea își rezervă dreptul de a refuza recepția coletelor ambalate
          necorespunzător.
        </li>
      </ul>

      <h3>Cost transport retur</h3>
      <p>
        În cele 14 zile de retur, <strong>transportul este gratuit pentru tine</strong>:
        chemi curierul Fan la tine acasă și expediezi coletul cu plata taxei de
        transport la destinatar, fără costuri suplimentare. Costul îl suportăm
        noi.
      </p>

      <Callout icon={<MapPin size={20} />} title="Adresa de retur">
        <p>
          {COMPANY.ragioneSociale}
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

      <Callout
        icon={<Prohibit size={20} />}
        title="Nu se acceptă livrarea coletelor în lockere"
      >
        <p>
          Coletele de retur nu pot fi livrate în lockere (Fanbox / Easybox) — te
          rugăm să folosești livrarea la adresa de mai sus.
        </p>
      </Callout>

      <Callout
        icon={<Package size={20} />}
        title="Informații obligatorii în colet"
      >
        <ul className="list-disc pl-5 space-y-1">
          <li>nume complet și date de contact;</li>
          <li>număr comandă;</li>
          <li>motivul returului.</li>
        </ul>
      </Callout>

      <h2>Condiții speciale de retur</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2 my-8">
        {CONDITII_SPECIALE.map((c) => (
          <div
            key={c.title}
            className="rounded-3xl border border-brand-dark/10 p-6"
          >
            <div className="w-10 h-10 rounded-2xl bg-brand-dark/5 text-brand-dark flex items-center justify-center mb-4">
              {c.icon}
            </div>
            <h3 className="font-bold text-brand-dark mb-2 leading-snug">
              {c.title}
            </h3>
            <p className="text-sm text-brand-dark/60 leading-relaxed">
              {c.text}
            </p>
          </div>
        ))}
      </div>

      <h2>Produse neconforme, defecte sau livrate greșit</h2>

      <h3>Produsul nu este conform</h3>
      <p>
        Dacă produsul primit nu corespunde descrierii din oferta noastră, poți
        solicita returnarea acestuia pentru rambursarea integrală a
        contravalorii. Costurile de retur și de transport pentru produsul
        returnat, dacă este cazul, sunt suportate de {COMPANY.dominio}.
      </p>

      <h3>Produs nefuncțional sau cu deteriorări în primele 24 de ore</h3>
      <p>
        Dacă produsul primit este nefuncțional în primele 24 de ore de la
        recepția efectivă — ridicarea de la sediul nostru sau recepția la
        domiciliu prin curier — poți reclama acest lucru și solicita returnarea
        produsului în acest termen. Pentru produsele ale căror colete prezintă
        deteriorări vizibile la primirea prin curier, îți recomandăm să refuzi
        primirea lor.
      </p>

      <h3>Produse livrate greșit</h3>
      <p>
        Dacă ți s-a livrat alt produs decât cel comandat, te rugăm să ne
        semnalezi cât mai curând acest lucru pentru a returna produsul.
      </p>

      <h3>Produse defecte în perioada de garanție</h3>
      <p>
        Produsele care prezintă defecte în perioada de garanție vor fi
        prezentate într-un centru de service al producătorului, dacă a fost emis
        pentru ele un Certificat de Garanție din partea producătorului. Detalii
        pe pagina <LocalizedClientLink href="/garantie">Garanție și service</LocalizedClientLink>.
      </p>

      <h2>Mențiuni legale</h2>
      <p>
        Returul produselor se realizează conform OUG nr. 34/2014. Se poate aplica
        diminuarea valorii produsului în cazul deteriorării sau al utilizării
        excesive. Pentru produsele Apple, se poate aplica diminuarea valorii
        dacă:
      </p>
      <ul>
        <li>există cicluri suplimentare de încărcare;</li>
        <li>produsul prezintă zgârieturi sau lovituri;</li>
        <li>ambalajul este deteriorat sau incomplet.</li>
      </ul>
      <p>
        <strong>Persoanele juridice</strong> nu beneficiază de drept de retur,
        exceptând produsele defecte sau neconforme.
      </p>

      <Callout icon={<Clock size={20} />} title="Rambursarea contravalorii">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            se realizează în maximum 14 zile calendaristice de la recepționarea
            produsului;
          </li>
          <li>
            se face prin transfer bancar, în contul comunicat de tine, dacă nu
            convenim împreună altă modalitate;
          </li>
          <li>se efectuează după verificarea produsului;</li>
          <li>
            nu răspundem pentru datele bancare greșite comunicate de tine.
          </li>
        </ul>
      </Callout>
    </InfoPageLayout>
  )
}
