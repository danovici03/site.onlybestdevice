import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  FacebookLogo,
  InstagramLogo,
  TiktokLogo,
} from "@phosphor-icons/react/dist/ssr"

import { COMPANY } from "@lib/util/company-info"
import ManagePreferencesLink from "@modules/layout/components/cookie-consent/manage-preferences-link"

const SHOP_LINKS = [
  { label: "Toate produsele", href: "/store" },
  { label: "Oferte", href: "/categories/oferte" },
  { label: "Telefoane mobile", href: "/categories/telefoane-mobile" },
  { label: "Laptopuri", href: "/categories/laptop" },
]

const SUPPORT_LINKS = [
  { label: "Contact", href: "/contact" },
  { label: "Întrebări frecvente", href: "/faq" },
  { label: "Livrarea comenzilor", href: "/livrare" },
  { label: "Retur produse", href: "/retur" },
  { label: "Garanție și service", href: "/garantie" },
  { label: "Suport clienți", href: "/suport" },
]

const LEGAL_LINKS = [
  { label: "Termeni și condiții", href: "/termeni" },
  { label: "Politica de confidențialitate", href: "/confidentialitate" },
  { label: "Cookie", href: "/cookie" },
  { label: "Informații legale", href: "/informatii-legale" },
]

// Linkuri externe obligatorii pentru comerțul electronic din România.
const ANPC_LINKS = [
  { label: "ANPC", href: "https://anpc.ro/" },
  { label: "ANPC – SAL", href: "https://anpc.ro/ce-este-sal/" },
  { label: "SOL (litigii online)", href: "https://ec.europa.eu/consumers/odr" },
]

export default function Footer() {
  return (
    <footer className="bg-brand-dark text-white pt-24 pb-8 rounded-t-[3rem] mt-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-20">
          <div className="lg:col-span-4">
            <LocalizedClientLink
              href="/"
              className="inline-flex mb-8"
              aria-label="onlybestdevice — Acasă"
            >
              <span className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-white select-none">
                onlybest<span className="text-brand-accent">device</span>
              </span>
            </LocalizedClientLink>
            <p className="text-white/60 font-medium max-w-sm mb-8">
              Cele mai noi device-uri, cu garanție 24 de luni, plata cu cardul
              sau în rate și retur gratuit în 14 zile.
            </p>

            <div className="flex gap-4">
              <a
                href={COMPANY.social.facebook}
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook"
                className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-brand-dark transition-colors"
              >
                <FacebookLogo size={22} />
              </a>
              <a
                href={COMPANY.social.instagram}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-brand-dark transition-colors"
              >
                <InstagramLogo size={22} />
              </a>
              <a
                href={COMPANY.social.tiktok}
                target="_blank"
                rel="noreferrer"
                aria-label="TikTok"
                className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-brand-dark transition-colors"
              >
                <TiktokLogo size={22} />
              </a>
            </div>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-bold mb-6 text-white/50 uppercase tracking-widest text-xs">
              Magazin
            </h4>
            <ul className="space-y-4 font-bold text-sm">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <LocalizedClientLink
                    href={link.href}
                    className="hover:text-brand-accent transition-colors"
                  >
                    {link.label}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="font-bold mb-6 text-white/50 uppercase tracking-widest text-xs">
              Suport clienți
            </h4>
            <ul className="space-y-4 font-bold text-sm">
              {SUPPORT_LINKS.map((link) => (
                <li key={link.href}>
                  <LocalizedClientLink
                    href={link.href}
                    className="hover:text-brand-accent transition-colors"
                  >
                    {link.label}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h4 className="font-bold mb-6 text-white/50 uppercase tracking-widest text-xs">
              Rămâi la curent
            </h4>
            <form className="relative bg-white/10 rounded-full p-1.5 flex">
              <input
                type="email"
                placeholder="Adresa ta de email"
                className="bg-transparent border-none px-4 py-2 text-sm text-white w-full focus:outline-none placeholder:text-white/40"
              />
              <button
                type="submit"
                className="bg-white text-brand-dark px-6 py-2 rounded-full text-sm font-bold hover:bg-brand-accent hover:text-white transition-colors"
              >
                Abonează-te
              </button>
            </form>
            <p className="text-xs text-white/40 mt-3 leading-relaxed">
              Prin abonare accepți{" "}
              <LocalizedClientLink
                href="/confidentialitate"
                className="underline hover:text-white"
              >
                politica de confidențialitate
              </LocalizedClientLink>
              .
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col gap-6 text-xs font-medium text-white/40">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p>
              &copy; {new Date().getFullYear()} {COMPANY.ragioneSociale} — CUI{" "}
              {COMPANY.piva} — Reg. Com. {COMPANY.rea}. Toate drepturile rezervate.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <LocalizedClientLink
                  key={link.href}
                  href={link.href}
                  className="hover:text-white transition-colors"
                >
                  {link.label}
                </LocalizedClientLink>
              ))}
              {ANPC_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <ManagePreferencesLink className="hover:text-white transition-colors text-left" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
