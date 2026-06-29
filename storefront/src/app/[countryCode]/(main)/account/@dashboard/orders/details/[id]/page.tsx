import { Metadata } from "next"
import { notFound } from "next/navigation"

import { retrieveOrder } from "@lib/data/orders"
import OrderDetail from "@modules/account/components/order-detail"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) notFound()
  return {
    title: `Ordine #${order.display_id}`,
    description: `Dettagli dell'ordine #${order.display_id}`,
  }
}

export default async function OrderDetailPage(props: Props) {
  const { id } = await props.params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) notFound()
  return <OrderDetail order={order} />
}
