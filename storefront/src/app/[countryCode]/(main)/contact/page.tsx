import { Metadata } from "next"
import {
  Envelope,
  Phone,
  WhatsappLogo,
  MapPin,
  Clock,
} from "@phosphor-icons/react/dist/ssr"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import ContattiForm from "@modules/suport/components/contact-form"
import { COMPANY, indirizzoOperativo, indirizzoLegale } from "@lib/util/company-info"

export const metadata: Metadata = {
  title: "Contact | onlybestdevice",
  description:
    "Scrie-ne prin formular, email, telefon sau WhatsApp. Răspuns în 24–48 de ore lucrătoare.",
}

const CHANNELS = [
  {
    icon: <Envelope size={22} weight="duotone" />,
    label: "Email",
    value: COMPANY.email,
    href: `mailto:${COMPANY.email}`,
  },
  {
    icon: <Phone size={22} weight="duotone" />,
    label: "Telefon",
    value: COMPANY.telefono,
    href: `tel:${COMPANY.telefono.replace(/\s+/g, "")}`,
  },
  {
    icon: <WhatsappLogo size={22} weight="duotone" />,
    label: "WhatsApp",
    value: COMPANY.whatsapp,
    href: `https://wa.me/${COMPANY.whatsapp.replace(/[^\d]/g, "")}`,
  },
]

export default function ContactPage() {
  return (
    <InfoPageLayout
      eyebrow="Suport clienți"
      title="Contactează-ne"
      description="Alege canalul preferat. Răspundem în 24–48 de ore lucrătoare (luni–vineri)."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Suport", href: "/suport" },
        { label: "Contact" },
      ]}
      wide
    >
      <div className="not-prose grid grid-cols-1 lg:grid-cols-5 gap-12">
        <div className="lg:col-span-3">
          <h2 className="text-2xl font-bold text-brand-dark mb-2">
            Scrie-ne un mesaj
          </h2>
          <p className="text-brand-dark/60 mb-8">
            Completează formularul și te contactăm cât mai curând.
          </p>
          <ContattiForm />
        </div>

        <aside className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-brand-dark/[0.03] p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">
              Alte canale
            </h3>
            <ul className="space-y-4">
              {CHANNELS.map((c) => (
                <li key={c.label} className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white text-brand-dark flex items-center justify-center shrink-0">
                    {c.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-dark/50">
                      {c.label}
                    </p>
                    <a
                      href={c.href}
                      className="text-brand-dark hover:text-brand-accent font-medium break-all"
                    >
                      {c.value}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-brand-dark/[0.03] p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">Program</h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-brand-dark flex items-center justify-center shrink-0">
                <Clock size={22} weight="duotone" />
              </div>
              <div>
                <p className="text-brand-dark font-medium">{COMPANY.orari}</p>
                <p className="text-sm text-brand-dark/60 mt-1">
                  {COMPANY.slaRisposta}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-brand-dark/[0.03] p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">
              Punct de lucru
            </h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-brand-dark flex items-center justify-center shrink-0">
                <MapPin size={22} weight="duotone" />
              </div>
              <div>
                <p className="font-semibold text-brand-dark">
                  {COMPANY.marchio}
                </p>
                <p className="text-sm text-brand-dark/70 mt-1">
                  {indirizzoOperativo()}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-brand-dark/[0.03] p-6">
            <h3 className="text-lg font-bold text-brand-dark mb-4">
              Date firmă
            </h3>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-brand-dark flex items-center justify-center shrink-0">
                <MapPin size={22} weight="duotone" />
              </div>
              <div>
                <p className="font-semibold text-brand-dark">
                  {COMPANY.ragioneSociale}
                </p>
                <p className="text-sm text-brand-dark/70 mt-1">
                  Sediu social: {indirizzoLegale()}
                </p>
                <p className="text-xs text-brand-dark/50 mt-2">
                  CUI {COMPANY.piva} — Reg. Com. {COMPANY.rea}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </InfoPageLayout>
  )
}
