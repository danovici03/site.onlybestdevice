import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getBuybackDevice } from "@lib/data/buyback"
import { canonical } from "@lib/util/canonical"
import BuybackWizard from "@modules/buyback/components/wizard"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = { params: Promise<{ countryCode: string; handle: string }> }

const nameOf = (d: { brand: string; model: string }) =>
  d.brand === "Apple" || d.model.startsWith(d.brand) ? d.model : `${d.brand} ${d.model}`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const device = await getBuybackDevice(handle)
  if (!device) return {}
  const name = nameOf(device)
  return {
    title: `Vinde ${name}`,
    description: `Cât primești pe ${name}${
      device.max_price ? ` — până la ${device.max_price.toLocaleString("ro-RO")} lei` : ""
    }. Evaluare online în 2 minute, bani prin transfer sau voucher cu bonus.`,
    alternates: canonical(`/vinde-telefonul/${handle}`),
  }
}

export default async function VindeModelPage({ params }: Props) {
  const { handle } = await params
  const device = await getBuybackDevice(handle)
  if (!device) notFound()

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-8 sm:px-8 md:pt-12">
      <nav aria-label="Breadcrumb" className="mb-8 text-xs uppercase tracking-widest text-brand-dark/50">
        <LocalizedClientLink href="/vinde-telefonul" className="hover:text-brand-dark">
          Vinde-ți telefonul
        </LocalizedClientLink>
        <span className="mx-2">/</span>
        <span>{nameOf(device)}</span>
      </nav>
      <BuybackWizard device={device} />
    </div>
  )
}
