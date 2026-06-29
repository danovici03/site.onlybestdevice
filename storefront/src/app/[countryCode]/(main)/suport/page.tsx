import { Metadata } from "next"
import {
  Question,
  Envelope,
  Truck,
  ArrowsClockwise,
  ShieldCheck,
  Scroll,
  Lock,
  Cookie,
  Buildings,
} from "@phosphor-icons/react/dist/ssr"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import InfoCard from "@modules/suport/components/info-card"

export const metadata: Metadata = {
  title: "Suport clienți | onlybestdevice",
  description:
    "FAQ, contact, livrare, retururi, garanție și documente legale. Echipa noastră de suport e aici să te ajute.",
}

const CARDS = [
  {
    href: "/faq",
    icon: <Question size={22} />,
    title: "Întrebări frecvente",
    description:
      "Răspunsuri rapide despre comenzi, livrare, plăți, retururi și garanție.",
  },
  {
    href: "/contact",
    icon: <Envelope size={22} />,
    title: "Contactează-ne",
    description:
      "Formular, email, telefon și WhatsApp. Răspuns în 24–48 de ore lucrătoare.",
  },
  {
    href: "/livrare",
    icon: <Truck size={22} />,
    title: "Livrarea comenzilor",
    description: "Termene, costuri, zone deservite, curier și ridicare personală.",
  },
  {
    href: "/retur",
    icon: <ArrowsClockwise size={22} />,
    title: "Retur și drept de retragere",
    description:
      "14 zile să te răzgândești, rambursare în 14 zile de la primire.",
  },
  {
    href: "/garantie",
    icon: <ShieldCheck size={22} />,
    title: "Garanție",
    description:
      "Garanție legală de conformitate de 24 de luni la toate produsele.",
  },
  {
    href: "/termeni",
    icon: <Scroll size={22} />,
    title: "Termeni și condiții",
    description: "Condițiile de vânzare aplicabile achizițiilor tale.",
  },
  {
    href: "/confidentialitate",
    icon: <Lock size={22} />,
    title: "Confidențialitate",
    description: "Cum prelucrăm datele tale cu caracter personal conform GDPR.",
  },
  {
    href: "/cookie",
    icon: <Cookie size={22} />,
    title: "Cookie",
    description: "Cookie-urile folosite pe site și cum îți gestionezi preferințele.",
  },
  {
    href: "/informatii-legale",
    icon: <Buildings size={22} />,
    title: "Informații legale",
    description: "Datele firmei conform Legii 365/2002 privind comerțul electronic.",
  },
]

export default function SuportPage() {
  return (
    <InfoPageLayout
      eyebrow="Suport clienți"
      title="Suntem aici să te ajutăm"
      description="Găsești rapid răspunsul la întrebările frecvente sau ne scrii direct. Echipa noastră răspunde în 24–48 de ore lucrătoare."
      breadcrumbs={[{ label: "Acasă", href: "/" }, { label: "Suport" }]}
    >
      <div className="not-prose grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {CARDS.map((c) => (
          <InfoCard key={c.href} {...c} />
        ))}
      </div>
    </InfoPageLayout>
  )
}
