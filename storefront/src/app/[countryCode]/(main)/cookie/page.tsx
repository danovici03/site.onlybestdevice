import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import ManagePreferencesLink from "@modules/layout/components/cookie-consent/manage-preferences-link"

export const metadata: Metadata = {
  title: "Politica de cookie-uri | onlybestdevice",
  description:
    "Informații despre utilizarea cookie-urilor și a altor instrumente de urmărire, conform Legii 506/2004 și GDPR.",
}

const REVISION_DATE = "iunie 2026"

export default function CookiePage() {
  return (
    <InfoPageLayout
      eyebrow="Documente"
      title="Politica de cookie-uri"
      description="Cum folosim cookie-urile și cum îți poți gestiona preferințele."
      breadcrumbs={[{ label: "Acasă", href: "/" }, { label: "Cookie" }]}
    >
      <h2>1. Ce sunt cookie-urile</h2>
      <p>
        Cookie-urile sunt fișiere text mici pe care site-urile vizitate le trimit
        în terminalul tău, unde sunt stocate și retransmise la vizita următoare.
        Instrumente similare (pixeli, local storage) sunt tratate ca atare când
        îndeplinesc funcții asemănătoare. Folosirea lor este reglementată de
        Legea 506/2004 și de GDPR.
      </p>

      <h2>2. Cookie-uri esențiale (tehnice)</h2>
      <p>
        Indispensabile pentru funcționarea site-ului: coș, autentificare,
        preferințe de regiune și securitate. Nu necesită consimțământ și nu pot
        fi dezactivate. Dezactivarea lor poate compromite funcționarea
        site-ului.
      </p>

      <h2>3. Cookie-uri analitice</h2>
      <p>
        Colectează informații agregate despre utilizarea site-ului, ca să
        îmbunătățim experiența. Nicio informație nu este folosită pentru a te
        identifica. Se instalează doar după consimțământul tău explicit prin
        banner.
      </p>

      <h2>4. Cookie-uri de marketing</h2>
      <p>
        Permit afișarea de reclame relevante pe alte site-uri, în funcție de
        interesele tale. Se instalează doar după consimțământul tău explicit.
      </p>

      <h2>5. Gestionarea preferințelor</h2>
      <p>
        Îți poți gestiona preferințele oricând, redeschizând panoul dedicat:{" "}
        <ManagePreferencesLink className="text-brand-accent hover:underline" />.
        Același buton este disponibil în subsolul fiecărei pagini. În plus, poți
        configura browserul să accepte, să refuze sau să șteargă cookie-urile.
      </p>

      <h2>6. Actualizări</h2>
      <p>Ultima revizuire: {REVISION_DATE}.</p>
    </InfoPageLayout>
  )
}
