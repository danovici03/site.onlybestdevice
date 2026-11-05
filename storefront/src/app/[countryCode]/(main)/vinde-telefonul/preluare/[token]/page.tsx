import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getBuybackOrder } from "@lib/data/buyback"
import OrderStatus from "@modules/buyback/components/order-status"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Preluarea ta",
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ nou?: string }>
}

/** Pagina preluării, deschisă cu linkul secret din email. Fără cont. */
export default async function PreluarePage({ params, searchParams }: Props) {
  const { token } = await params
  const { nou } = await searchParams
  const order = await getBuybackOrder(token)
  if (!order) notFound()

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-24 pt-10 sm:px-8 md:pt-14">
      <OrderStatus token={token} initial={order} justSubmitted={nou === "1"} />
    </div>
  )
}
