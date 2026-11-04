import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/types"
import { Container, Heading, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import {
  api,
  formatDateTime,
  itemsSummary,
  ReturnRequestDrawer,
  StatusBadge,
  type ReturnRequest,
} from "../components/return-requests"

/**
 * Cererile de retur trimise de client pentru comanda asta. Apare doar dacă
 * există cel puțin una; de aici se schimbă și statusul.
 */
const OrderReturnRequestsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [rows, setRows] = useState<ReturnRequest[]>([])
  const [selected, setSelected] = useState<ReturnRequest | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<{ return_requests: ReturnRequest[] }>(
        `/admin/return-requests?order_id=${encodeURIComponent(order.id)}`,
      )
      setRows(data.return_requests)
    } catch {
      setRows([])
    }
  }, [order.id])

  useEffect(() => {
    load()
  }, [load])

  if (rows.length === 0) return null

  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h2">Cereri de retur</Heading>
      </div>
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          className="hover:bg-ui-bg-base-hover flex w-full flex-col gap-1 px-6 py-3 text-left"
          onClick={() => setSelected(r)}
        >
          <div className="flex items-center justify-between gap-2">
            <Text size="small" weight="plus">
              {formatDateTime(r.requested_at)}
            </Text>
            <StatusBadge status={r.status} />
          </div>
          <Text size="small" className="text-ui-fg-subtle line-clamp-2">
            {itemsSummary(r.items)}
          </Text>
        </button>
      ))}
      <ReturnRequestDrawer
        request={selected}
        showOrderLink={false}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null)
          load()
        }}
      />
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderReturnRequestsWidget
