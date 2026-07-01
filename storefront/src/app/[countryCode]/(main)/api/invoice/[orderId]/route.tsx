import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"

import { retrieveOrder } from "@lib/data/orders"
import { retrieveCustomer } from "@lib/data/customer"
import { InvoiceDocument } from "@lib/pdf/invoice"

// Forces Node runtime — @react-pdf/renderer depends on Node built-ins.
export const runtime = "nodejs"

type Params = { params: Promise<{ orderId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params

  const customer = await retrieveCustomer().catch(() => null)
  if (!customer) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const order = await retrieveOrder(orderId).catch(() => null)
  if (!order) {
    return new NextResponse("Order not found", { status: 404 })
  }

  if (order.customer_id !== customer.id) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const pdfBuffer = await renderToBuffer(<InvoiceDocument order={order} />)

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rezumat-comanda-${order.display_id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
