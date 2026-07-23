import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import {
  FINANCING_PRODUCTS,
  UCFIN_GDPR_URL,
  UCFIN_GUIDE_URL,
} from "@lib/util/installments"

// Conținutul acestei pagini reproduce documentul „Informatii Credit
// UCFin_ONLY BEST DEVICE SRL_23.07.26" primit de la departamentul juridic
// UniCredit Consumer Financing. NU modifica cifrele/formularea fără o revizie
// nouă de la UCFin.

export const metadata: Metadata = {
  title: "Credit Online UniCredit Consumer Financing | onlybestdevice",
  description:
    "Cumpără în rate prin Creditul Online de la UniCredit Consumer Financing IFN S.A. — 100% online, cu răspuns în maximum 15 minute. Condiții, produse financiare și DAE.",
}

export default function CreditOnlinePage() {
  return (
    <InfoPageLayout
      eyebrow="Plata în rate"
      title="Credit Online de la UniCredit Consumer Financing"
      description="Finanțare 100% online, cu identificare video, semnătură electronică și răspuns în maximum 15 minute."
      breadcrumbs={[{ label: "Acasă", href: "/" }, { label: "Credit Online" }]}
    >
      <h2>Cum funcționează</h2>
      <ol>
        <li>Intri pe pagina noastră online și adaugi produsele dorite în coș.</li>
        <li>
          Alegi ca metodă de plată Creditul Online de la UniCredit Consumer
          Financing și numărul de rate.
        </li>
        <li>
          Parcurgi pașii de creditare la distanță și primești răspunsul în
          maximum 15 minute.
        </li>
        <li>
          În cazul aprobării, plata se face de UniCredit Consumer Financing
          către noi, iar tu primești produsele în exact același timp ca la
          orice altă metodă de plată.
        </li>
        <li>
          Plata ratelor o faci începând cu data scadentă, conform graficului de
          rambursare primit.
        </li>
      </ol>

      <h2>De ce ai nevoie?</h2>
      <ul>
        <li>
          Un telefon mobil — identificarea la distanță se face prin mijloace
          video; ulterior aprobării primești documentația semnată electronic
          prin link în SMS.
        </li>
        <li>Carte de identitate, în original, valabilă.</li>
        <li>
          Adresă de email, unde primești statusul actualizat privind decizia de
          creditare.
        </li>
      </ul>

      <h2>Condiții de eligibilitate</h2>
      <p>
        Poți solicita un credit online acordat de UniCredit Consumer Financing
        dacă:
      </p>
      <ul>
        <li>ești cetățean român, născut și rezident în România;</li>
        <li>
          te identifici cu o carte de identitate emisă de autoritățile române,
          aflată în termen de valabilitate (nu se acceptă cărțile de identitate
          provizorii);
        </li>
        <li>
          ai vârsta cuprinsă între 18 și 75 de ani (vârsta până la care
          creditul trebuie rambursat în întregime);
        </li>
        <li>
          ai venituri înregistrate în baza de date a Agenției Naționale de
          Administrare Fiscală („ANAF") și ești de acord cu interogarea bazei
          de date a ANAF;
        </li>
        <li>
          ai venit minim lunar de 2.363 lei dacă ești salariat, respectiv 1.281
          lei dacă ești pensionar;
        </li>
        <li>
          numărul de telefon utilizat în relația contractuală cu UniCredit
          Consumer Financing este din România;
        </li>
        <li>
          ești de acord cu identificarea prin mijloace video, de către un
          prestator de servicii de încredere calificat, prestator contractual
          al UCFin, conform Normelor nr. 564/2021 emise de Agenția pentru
          Digitalizarea României și Legii nr. 129/2019, în scopul emiterii
          certificatului digital calificat pentru semnătură electronică și al
          semnării electronice, la distanță, a documentației de credit, precum
          și al identificării tale, pentru scopurile de mai sus, ale UCFin și,
          respectiv, ale prestatorului de servicii de încredere calificat.
        </li>
      </ul>

      <h2>Produsele financiare</h2>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Produs financiar</th>
              <th>Valoare</th>
              <th>Dobândă anuală (fixă)</th>
              <th>Comision de analiză dosar credit*</th>
              <th>Comision lunar de administrare credit</th>
              <th>Perioada de creditare</th>
              <th>DAE**</th>
            </tr>
          </thead>
          <tbody>
            {FINANCING_PRODUCTS.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>
                  {p.minAmount.toLocaleString("ro-RO")} →{" "}
                  {p.maxAmountLabel.toLocaleString("ro-RO")} lei
                </td>
                <td>{Math.round(p.annualRate * 100)}%</td>
                <td>{p.fileAnalysisFee} lei</td>
                <td>{p.monthlyAdminFee} lei</td>
                <td>
                  {p.minMonths} → {p.maxMonths} luni
                </td>
                <td>{p.dae.toLocaleString("ro-RO")}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <small>
          * perceput numai în cazul acordării creditului
          <br />
          ** calculată pentru suma maximă și perioada maximă
        </small>
      </p>
      <p>
        <em>Exemplu reprezentativ de calcul, produs fără asigurare de viață
        atașat:</em>{" "}
        în cazul Creditului Low DAE 36M / Low DAE 48M / Low DAE 60M (ca urmare
        a îndeplinirii criteriilor de eligibilitate), pentru o valoare totală a
        creditului de 1.500 / 2.500 / 7.500 lei pe 36 / 48 / 60 de luni, rata
        dobânzii fixă/an este de 25% / 22% / 11%, comision de analiză dosar 0
        lei, comision lunar de administrare credit 10 lei, valoarea ratei
        lunare (pentru rate egale) 70,82 / 90,14 / 174,50 lei, valoarea totală
        plătibilă 2.549,34 / 4.326,43 / 10.470,00 lei, DAE 46,01% / 34,60% /
        14,93%.
      </p>
      <p>
        Fără comision de analiză dosar. Ai răspuns pe loc***, dacă sunt
        îndeplinite condițiile de eligibilitate potrivit normelor interne UCFin
        și documentația de credit este completă.
      </p>
      <p>
        <small>
          *** Fac excepție situațiile în care decizia de creditare nu poate fi
          luată pe loc din motive independente de voința UniCredit Consumer
          Financing IFN S.A. sau situațiile în care este necesară o analiză
          suplimentară a cererii. Creditorul are dreptul de a analiza și de a
          aproba sau respinge solicitarea de acordare a creditului de consum,
          în conformitate cu normele interne și reglementările legale.
        </small>
      </p>

      <h2>Unde și cum plătești ratele?</h2>
      <p>
        Achiți ratele aferente creditului în orice sucursală UniCredit Bank
        S.A., online prin Online Banking sau Mobile Banking (dacă ai
        contractate aceste servicii de la UniCredit Bank S.A.), precum și în
        locațiile semnalizate cu sigla SelfPay.
      </p>

      <h2>Dreptul de retragere din contractul de credit încheiat la distanță</h2>
      <p>
        Ulterior aprobării și încheierii contractului de credit, ai dreptul de
        a te retrage din contract în termen de 14 (paisprezece) zile
        calendaristice de la data încheierii contractului de credit, precum și
        în situațiile prevăzute la articolele 63–65 din Ordonanța de Urgență
        nr. 50/2010 privind contractele de credit pentru consumatori. Mai multe
        detalii în{" "}
        <a href={UCFIN_GUIDE_URL} target="_blank" rel="noopener noreferrer">
          Ghidul semnării la distanță
        </a>
        .
      </p>

      <h2>Contact UniCredit Consumer Financing</h2>
      <ul>
        <li>
          E-mail:{" "}
          <a href="mailto:support-online@unicredit.ro">
            support-online@unicredit.ro
          </a>
        </li>
        <li>
          Telefon: 021.200.97.11 (apel tarif normal în rețeaua fixă Orange
          Romania Communications)
        </li>
        <li>Program: luni–vineri, 09:00–21:00</li>
      </ul>
      <p>
        UniCredit Consumer Financing IFN S.A. prelucrează date cu caracter
        personal conform prevederilor legale aplicabile, iar informații
        detaliate privind prelucrarea și modalitatea de exercitare a
        drepturilor persoanei vizate sunt disponibile în{" "}
        <a href={UCFIN_GDPR_URL} target="_blank" rel="noopener noreferrer">
          nota de informare privind prelucrarea datelor cu caracter personal
        </a>
        .
      </p>
      <p>
        <small>
          UNICREDIT CONSUMER FINANCING IFN S.A., instituție financiară
          nebancară și instituție de plată, societate administrată în sistem
          dualist, înregistrată la Registrul Comerțului sub nr.
          J40/13865/14.08.2008, CUI 24332910, înscrisă în Registrul General al
          Băncii Naționale a României sub numărul RG-PJR-41-110247/24.10.2008,
          Registrul Special sub numărul RS-PJR-41-110065/09.02.2010 și în
          Registrul Instituțiilor de Plată sub numărul IP-RO-0009/02.03.2015,
          cu sediul în București, sector 1, Bulevardul Expoziției nr. 1F, etaj
          6, capital social subscris și vărsat: 103.269.200 lei, tel. +40 21
          200 2020. Date de identificare complete, obiect de activitate și
          autorizații pot fi regăsite la{" "}
          <a
            href="https://www.ucfin.ro/despre-noi"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.ucfin.ro/despre-noi
          </a>
          .
        </small>
      </p>
    </InfoPageLayout>
  )
}
