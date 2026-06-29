import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import { COMPANY, indirizzoLegale } from "@lib/util/company-info"

export const metadata: Metadata = {
  title: "Termeni și condiții | onlybestdevice",
  description:
    "Termenii și condițiile de vânzare conform legislației din România (OUG 34/2014, Legea 449/2003).",
}

const REVISION_DATE = "iunie 2026"

export default function TermeniPage() {
  return (
    <InfoPageLayout
      eyebrow="Documente"
      title="Termeni și condiții"
      description={`Document actualizat în ${REVISION_DATE}. În caz de modificări, se aplică versiunea în vigoare la momentul comenzii.`}
      breadcrumbs={[{ label: "Acasă", href: "/" }, { label: "Termeni" }]}
    >
      <h2>1. Informații despre vânzător</h2>
      <p>
        Acest site este administrat de <strong>{COMPANY.ragioneSociale}</strong>{" "}
        (în continuare „Vânzătorul" sau „noi"), cu sediul în {indirizzoLegale()},
        CUI {COMPANY.piva}, înregistrată la Registrul Comerțului sub nr.{" "}
        {COMPANY.rea}, email{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>, telefon{" "}
        {COMPANY.telefono}.
      </p>

      <h2>2. Domeniu de aplicare</h2>
      <p>
        Prezentele condiții generale de vânzare („Condiții") reglementează
        oferirea și vânzarea produselor publicate pe site-ul {COMPANY.baseUrl}{" "}
        („Site-ul"). Condițiile se aplică achizițiilor efectuate de consumatori
        — persoane fizice care acționează în scopuri din afara activității lor
        comerciale sau profesionale, conform OUG 34/2014 și OG 21/1992 — precum
        și, în lipsa unor derogări exprese, achizițiilor efectuate de
        profesioniști.
      </p>
      <p>
        Plasarea unei comenzi implică citirea și acceptarea integrală a
        prezentelor Condiții, în versiunea în vigoare la momentul comenzii.
      </p>

      <h2>3. Procedura de comandă și încheierea contractului</h2>
      <p>
        Pentru a cumpăra este suficient să adaugi produsele în coș și să urmezi
        pașii de finalizare a comenzii. Înainte de trimiterea comenzii ți se
        afișează un rezumat care conține: descrierea produselor, prețul total cu
        TVA inclus, costurile de livrare, termenele de livrare, metodele de
        plată, condițiile de retragere și garanția legală.
      </p>
      <p>
        Contractul se încheie în momentul în care primești prin email
        confirmarea comenzii. Ne rezervăm dreptul de a nu accepta comenzi
        incomplete sau plasate de clienți cu care există litigii nesoluționate.
      </p>

      <h2>4. Prețuri și plăți</h2>
      <p>
        Toate prețurile sunt exprimate în lei (RON) și includ TVA. Eventualele
        costuri de livrare sunt indicate separat în coș, înainte de plată. Sunt
        acceptate metodele de plată afișate la finalizarea comenzii (card
        bancar, plata în rate prin partenerii noștri, plata la livrare/ramburs).
        Plățile cu cardul sunt procesate de furnizori autorizați, cu
        autentificare securizată conform normelor în vigoare.
      </p>

      <h2>5. Livrare</h2>
      <p>
        Modalitățile, termenele și costurile de livrare sunt descrise pe pagina{" "}
        <a href="/livrare">Livrarea comenzilor</a> și sunt comunicate înainte de
        încheierea contractului. Eventualele întârzieri cauzate de forță majoră
        (greve ale curierilor, evenimente naturale, restricții administrative)
        nu constituie neexecutare.
      </p>

      <h2>6. Dreptul de retragere</h2>
      <p>
        Ai dreptul să te retragi din contract în termen de{" "}
        <strong>14 zile</strong> de la primirea produsului, fără a invoca vreun
        motiv, conform OUG 34/2014. Procedura, termenele de rambursare,
        excepțiile (în special produsele personalizate sau sigilate desigilate
        din motive de igienă) și formularul de retragere sunt descrise pe pagina{" "}
        <a href="/retur">Retur produse</a>, parte integrantă a prezentelor
        Condiții.
      </p>

      <h2>7. Garanția legală de conformitate</h2>
      <p>
        Toate produsele vândute consumatorilor beneficiază de garanția legală de
        conformitate de <strong>24 de luni</strong> de la livrare, conform Legii
        449/2003 și OUG 140/2021 (care transpune Directiva (UE) 2019/771).
        Modalitățile de activare și remediile disponibile sunt descrise pe
        pagina <a href="/garantie">Garanție și service</a>.
      </p>

      <h2>8. Răspundere</h2>
      <p>
        Depunem maximă diligență în descrierea și prezentarea produselor.
        Specificațiile și imaginile sunt furnizate de producători și pot suferi
        mici variații. În limitele permise de lege, răspunderea noastră față de
        consumator este limitată la prețul produsului, rămânând neatinse
        drepturile imperative ale consumatorului prevăzute de lege.
      </p>

      <h2>9. Soluționarea litigiilor</h2>
      <p>
        Pentru orice litigiu te invităm să ne contactezi întâi, pentru o
        soluționare amiabilă. Conform OG 38/2015, te poți adresa în mod voluntar
        unei entități de soluționare alternativă a litigiilor (SAL). Autoritatea
        competentă este{" "}
        <a href="https://anpc.ro/" target="_blank" rel="noreferrer">
          ANPC
        </a>{" "}
        (Autoritatea Națională pentru Protecția Consumatorilor), iar platforma
        europeană de soluționare online a litigiilor (SOL) este disponibilă la{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">
          ec.europa.eu/consumers/odr
        </a>
        .
      </p>

      <h2>10. Legea aplicabilă</h2>
      <p>
        Prezentele Condiții și contractele încheiate prin Site sunt guvernate de
        legea română. Pentru litigiile derivate din contract sunt competente
        instanțele de la domiciliul consumatorului, conform legii.
      </p>

      <h2>11. Modificări</h2>
      <p>
        Ne rezervăm dreptul de a modifica prezentele Condiții oricând;
        modificările intră în vigoare la momentul publicării pe Site și se
        aplică comenzilor ulterioare. Versiunea aplicabilă comenzii tale este
        cea în vigoare la momentul confirmării comenzii.
      </p>

      <hr />
      <p className="text-xs text-brand-dark/50">
        Document actualizat în {REVISION_DATE}. TODO: completați datele firmei în
        <code>company-info.ts</code> (CUI, Reg. Com., adresă) și validați textul
        cu un consilier juridic înainte de lansare.
      </p>
    </InfoPageLayout>
  )
}
