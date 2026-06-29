import { Metadata } from "next"

import BestSellers from "@modules/home/components/best-sellers"
import Hero from "@modules/home/components/hero"
import IconicProducts from "@modules/home/components/iconic-products"
import Rooms from "@modules/home/components/rooms"
import { getRegion } from "@lib/data/regions"

export const metadata: Metadata = {
  title: { absolute: "onlybestdevice | Cele mai noi device-uri" },
  description:
    "Cele mai noi device-uri, cu garanție 24 de luni, plata cu cardul sau în rate și retur gratuit în 14 zile.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  return (
    <>
      <Hero />
      <Rooms />
      <IconicProducts countryCode={countryCode} />
      <BestSellers countryCode={countryCode} />
    </>
  )
}
