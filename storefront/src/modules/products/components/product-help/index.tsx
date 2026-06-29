import {
  WhatsappLogo,
  Phone,
  Clock,
  ArrowUpRight,
} from "@phosphor-icons/react/dist/ssr"
import { COMPANY } from "@lib/util/company-info"

const WA_NUMBER = COMPANY.whatsapp.replace(/[^\d]/g, "")

type ProductHelpProps = {
  productTitle: string
}

export default function ProductHelp({ productTitle }: ProductHelpProps) {
  const waMessage = encodeURIComponent(
    `Ciao! Vorrei informazioni sul prodotto "${productTitle}". Potete aiutarmi?`
  )
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${waMessage}`
  const telUrl = `tel:${COMPANY.telefono.replace(/\s/g, "")}`

  return (
    <section className="content-container my-16 lg:my-24">
      <div className="bg-brand-light rounded-[2.5rem] p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7">
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
              Asistență produs
            </span>
            <h2 className="font-serif text-3xl lg:text-4xl text-brand-dark mt-3">
              Ai întrebări despre acest produs?
            </h2>
            <p className="text-brand-dark/70 text-base leading-relaxed max-w-lg mt-3">
              Echipa noastră îți stă la dispoziție pentru orice întrebare. Te ajutăm gratuit și fără obligații.
            </p>
            <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full bg-white text-sm text-brand-dark/70">
              <Clock size={16} weight="bold" />
              <span>{COMPANY.orari}</span>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl bg-[#25D366] text-white p-5 hover:bg-[#20bd5a] transition-colors"
            >
              <WhatsappLogo size={28} weight="fill" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="block font-bold">Scrivici su WhatsApp</span>
                <span className="block text-sm text-white/80">
                  Risposta rapida
                </span>
              </div>
              <ArrowUpRight
                size={20}
                weight="bold"
                className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
              />
            </a>

            <a
              href={telUrl}
              className="group flex items-center gap-4 rounded-2xl border border-brand-dark/10 bg-white p-5 hover:border-brand-dark/30 transition-colors"
            >
              <Phone size={24} className="shrink-0 text-brand-dark" />
              <div className="flex-1 min-w-0">
                <span className="block font-bold text-brand-dark">
                  Chiamaci
                </span>
                <span className="block text-sm text-brand-dark/60">
                  {COMPANY.telefono}
                </span>
              </div>
              <ArrowUpRight
                size={20}
                weight="bold"
                className="shrink-0 text-brand-dark/30 group-hover:text-brand-dark/60 transition-colors"
              />
            </a>

            <p className="text-sm text-brand-dark/50 mt-1 text-center lg:text-left">
              Oppure scrivici a{" "}
              <a
                href={`mailto:${COMPANY.email}`}
                className="underline hover:text-brand-accent transition-colors"
              >
                {COMPANY.email}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
