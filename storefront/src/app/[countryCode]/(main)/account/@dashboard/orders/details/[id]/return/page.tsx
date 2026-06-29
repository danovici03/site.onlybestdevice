import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { retrieveOrder } from "@lib/data/orders"
import ReturnRequestForm from "@modules/account/components/return-request"

const RETURN_WINDOW_DAYS = 14

type Props = {
  params: Promise<{ id: string; countryCode: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) notFound()
  return {
    title: `Richiedi reso — Ordine #${order.display_id}`,
  }
}

export default async function ReturnPage(props: Props) {
  const { id, countryCode } = await props.params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) notFound()

  // Server-side guard for the 14-day window — UI buttons also enforce this,
  // but a direct nav to the URL should fail gracefully too.
  const ref =
    (order as any).delivered_at ||
    (order as any).shipped_at ||
    order.updated_at ||
    order.created_at
  const days = (Date.now() - new Date(ref).getTime()) / 86_400_000
  if (days > RETURN_WINDOW_DAYS) {
    redirect(`/${countryCode}/account/orders/details/${order.id}`)
  }

  return <ReturnRequestForm order={order} countryCode={countryCode} />
}
