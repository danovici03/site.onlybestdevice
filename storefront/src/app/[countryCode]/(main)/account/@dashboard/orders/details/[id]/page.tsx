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
    title: `Comanda #${order.display_id}`,
    description: `Detalii comandă #${order.display_id}`,
  }
}

export default async function OrderDetailPage(props: Props) {
  const { id } = await props.params
  const order = await retrieveOrder(id).catch(() => null)
  if (!order) notFound()
  return <OrderDetail order={order} />
}
