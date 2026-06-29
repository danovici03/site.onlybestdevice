import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import { COMPANY, indirizzoLegale } from "@lib/util/company-info"

export const metadata: Metadata = {
  title: "Politica de confidențialitate | onlybestdevice",
  description:
    "Informații privind prelucrarea datelor cu caracter personal conform Regulamentului (UE) 2016/679 (GDPR).",
}

const REVISION_DATE = "iunie 2026"

export default function ConfidentialitatePage() {
  return (
    <InfoPageLayout
      eyebrow="Documente"
      title="Politica de confidențialitate"
      description="Cum prelucrăm datele tale cu caracter personal, conform GDPR."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Confidențialitate" },
      ]}
    >
      <h2>1. Operatorul de date</h2>
      <p>
        Operatorul datelor este <strong>{COMPANY.ragioneSociale}</strong>, cu
        sediul în {indirizzoLegale()}, CUI {COMPANY.piva}, email{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>, telefon{" "}
        {COMPANY.telefono}.
      </p>

      <h2>2. Ce date prelucrăm</h2>
      <ul>
        <li>
          <strong>Date de identificare și contact:</strong> nume, prenume,
          email, telefon, adrese de livrare și facturare.
        </li>
        <li>
          <strong>Date de facturare:</strong> denumire, CUI/CNP, după caz,
          pentru emiterea facturii.
        </li>
        <li>
          <strong>Date de plată:</strong> gestionate direct de procesatorii de
          plată; nu stocăm numerele complete ale cardurilor.
        </li>
        <li>
          <strong>Date de navigare:</strong> jurnale, adresă IP, dispozitiv,
          pagini vizitate (prin cookie-uri tehnice și, cu acordul tău,
          analitice — vezi <a href="/cookie">Politica de cookie-uri</a>).
        </li>
        <li>
          <strong>Conținutul mesajelor</strong> pe care ni le trimiți prin
          formular, email sau telefon.
        </li>
      </ul>

      <h2>3. Scopuri și temeiuri juridice</h2>
      <ul>
        <li>
          executarea contractului — procesarea comenzilor, livrare, asistență
          (art. 6 alin. 1 lit. b GDPR);
        </li>
        <li>
          îndeplinirea obligațiilor legale — facturare, contabilitate, garanție
          (art. 6 alin. 1 lit. c GDPR);
        </li>
        <li>
          interesul legitim — securitatea site-ului, prevenirea fraudei (art. 6
          alin. 1 lit. f GDPR);
        </li>
        <li>
          consimțământul — marketing, cookie-uri analitice/de marketing (art. 6
          alin. 1 lit. a GDPR), revocabil oricând.
        </li>
      </ul>

      <h2>4. Destinatarii datelor</h2>
      <p>
        Datele pot fi comunicate, în calitate de persoane împuternicite (art. 28
        GDPR): furnizorii de hosting și infrastructură, furnizorul de email
        tranzacțional, curierii pentru livrare și procesatorii de plată.
        Anumiți furnizori pot fi stabiliți în afara SEE; transferul este
        garantat prin decizii de adecvare ale Comisiei Europene și/sau clauze
        contractuale standard (Decizia 2021/914/UE).
      </p>

      <h2>5. Perioada de stocare</h2>
      <p>
        Păstrăm datele pe durata relației contractuale și ulterior pe durata
        impusă de obligațiile legale (de exemplu, documentele financiar-contabile
        conform legislației fiscale). Datele prelucrate pe bază de consimțământ
        sunt păstrate până la retragerea acestuia.
      </p>

      <h2>6. Drepturile tale</h2>
      <p>Conform GDPR ai dreptul de:</p>
      <ul>
        <li>acces la date (art. 15);</li>
        <li>rectificare (art. 16);</li>
        <li>ștergere (art. 17);</li>
        <li>restricționare a prelucrării (art. 18);</li>
        <li>portabilitate (art. 20);</li>
        <li>
          opoziție la prelucrarea bazată pe interes legitim sau în scop de
          marketing (art. 21);
        </li>
        <li>
          retragere a consimțământului oricând (fără a afecta legalitatea
          prelucrării anterioare).
        </li>
      </ul>
      <p>
        Îți poți exercita drepturile scriindu-ne la{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. De asemenea, ai
        dreptul de a depune o plângere la{" "}
        <a href="https://www.dataprotection.ro/" target="_blank" rel="noreferrer">
          ANSPDCP
        </a>{" "}
        (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter
        Personal).
      </p>

      <h2>7. Responsabil cu protecția datelor (DPO)</h2>
      <p>
        Operatorul nu a desemnat un DPO, nefiind întrunite condițiile art. 37
        GDPR. Pentru exercitarea drepturilor contactează direct operatorul la
        adresele de mai sus.
      </p>

      <h2>8. Actualizări</h2>
      <p>
        Prezenta informare poate fi actualizată oricând. Ultima revizuire:{" "}
        {REVISION_DATE}.
      </p>

      <hr />
      <p className="text-xs text-brand-dark/50">
        TODO: completați datele operatorului în <code>company-info.ts</code> și
        validați textul cu un consilier juridic / DPO înainte de lansare.
      </p>
    </InfoPageLayout>
  )
}
