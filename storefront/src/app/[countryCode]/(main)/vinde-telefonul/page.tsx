import { Bank, Gift, MagnifyingGlass, Package, ShieldCheck } from "@phosphor-icons/react/dist/ssr"
import { Metadata } from "next"

import { listBuybackBrands } from "@lib/data/buyback"
import { canonical } from "@lib/util/canonical"
import DevicePicker from "@modules/buyback/components/device-picker"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "Vinde-ți telefonul",
  description:
    "Află în 2 minute cât primești pe telefonul vechi. Preluăm iPhone, Samsung, Xiaomi și Huawei: bani prin transfer sau voucher cu bonus pe Onlybestdevice.",
  alternates: canonical("/vinde-telefonul"),
}

const STEPS = [
  { icon: MagnifyingGlass, title: "Evaluezi online", text: "Răspunzi la câteva întrebări despre starea telefonului și primești oferta pe loc." },
  { icon: Package, title: "Ni-l trimiți", text: "Comanzi singur curierul Fan Courier, transportul îl plătim noi. Sau îl aduci în magazin." },
  { icon: ShieldCheck, title: "Îl verificăm", text: "Un tehnician confirmă starea. Dacă diferă, primești o ofertă nouă." },
  { icon: Bank, title: "Primești banii", text: "Prin transfer bancar sau ca voucher cu bonus pe site." },
]

export default async function VindeTelefonulPage() {
  const brands = await listBuybackBrands()

  return (
    <div className="bg-white pb-24">
      <section className="mb-12 rounded-b-[3rem] bg-brand-dark pb-16 pt-12 text-white">
        <div className="mx-auto max-w-[1100px] px-4 sm:px-8">
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-brand-accent">Preluare telefoane</p>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">Vinde-ți telefonul vechi</h1>
          <p className="max-w-2xl text-lg text-white/70 md:text-xl">
            Află în două minute cât primești. Bani prin transfer sau voucher pe site, cu bonus.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3 text-sm">
            <Gift size={22} className="text-brand-accent" />
            Alegi voucher? Primești mai mult decât în bani.
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-4 sm:px-8">
        <h2 className="mb-6 text-2xl font-bold text-brand-dark md:text-3xl">Ce telefon vinzi?</h2>
        <DevicePicker brands={brands} />

        <h2 className="mb-6 mt-20 text-2xl font-bold text-brand-dark md:text-3xl">Cum funcționează</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl bg-brand-dark/[0.04] p-6">
              <s.icon size={32} className="mb-4 text-brand-accent" />
              <p className="font-bold text-brand-dark">
                {i + 1}. {s.title}
              </p>
              <p className="mt-1 text-sm text-brand-dark/70">{s.text}</p>
            </li>
          ))}
        </ol>

        <h2 className="mb-6 mt-20 text-2xl font-bold text-brand-dark md:text-3xl">Înainte să-l trimiți</h2>
        <ul className="grid gap-3 text-brand-dark/80 md:grid-cols-2">
          <li className="rounded-2xl border border-brand-dark/10 p-5">
            <b className="text-brand-dark">Dezactivează „Găsește-mi iPhone-ul”</b> sau contul Google /
            Samsung. Un telefon blocat pe cont nu poate fi preluat.
          </li>
          <li className="rounded-2xl border border-brand-dark/10 p-5">
            <b className="text-brand-dark">Fă-ți o copie de siguranță</b> și resetează telefonul la
            setările din fabrică.
          </li>
          <li className="rounded-2xl border border-brand-dark/10 p-5">
            <b className="text-brand-dark">Scoate cartela SIM</b> și cardul de memorie.
          </li>
          <li className="rounded-2xl border border-brand-dark/10 p-5">
            <b className="text-brand-dark">Descrie starea corect.</b> Prețul final se confirmă la
            verificare; o descriere corectă înseamnă că primești exact suma din ofertă.
          </li>
        </ul>
        <p className="mt-8 text-sm text-brand-dark/60">
          Detalii despre verificare, plată, voucher și retur în{" "}
          <LocalizedClientLink href="/vinde-telefonul/termeni" className="font-semibold underline">
            condițiile de preluare
          </LocalizedClientLink>
          .
        </p>
      </div>
    </div>
  )
}
