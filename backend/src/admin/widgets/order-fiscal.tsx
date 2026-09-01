import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/types"
import { ReceiptPercent } from "@medusajs/icons"
import { Badge, Container, Heading, Text, toast } from "@medusajs/ui"

import {
  formatCui,
  readBuyerFiscal,
} from "../../lib/company/buyer-fiscal"

/**
 * Datele de facturare pe firmă, culese la checkout din registrul ANAF.
 *
 * Medusa nu are câmpuri pentru CUI, deci stau în `metadata` — unde s-ar vedea
 * doar ca perechi cheie-valoare, la capătul paginii. Aici sunt sus, lângă
 * comandă, cu un click pentru copiere în programul de facturare.
 */
const OrderFiscalWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const fiscal = readBuyerFiscal(
    order.metadata as Record<string, unknown> | null
  )

  if (!fiscal) return null

  const name = fiscal.name || order.billing_address?.company || "—"
  const cui = formatCui(fiscal.cui, fiscal.vatPayer)

  const copy = async () => {
    const lines = [
      name,
      cui,
      fiscal.regCom ? `Reg. Com. ${fiscal.regCom}` : "",
    ].filter(Boolean)
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      toast.success("Date fiscale copiate")
    } catch {
      toast.error("Nu am putut copia datele")
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <ReceiptPercent />
          <Heading level="h2">Factură pe firmă</Heading>
        </div>
        <Badge color={fiscal.vatPayer ? "green" : "grey"} size="2xsmall">
          {fiscal.vatPayer ? "Plătitoare de TVA" : "Neplătitoare de TVA"}
        </Badge>
      </div>

      <div className="flex flex-col gap-2 px-6 py-4">
        <div>
          <Text size="small" className="text-ui-fg-muted">
            Denumire
          </Text>
          <Text size="small" weight="plus">
            {name}
          </Text>
        </div>
        <div>
          <Text size="small" className="text-ui-fg-muted">
            CUI
          </Text>
          <Text size="small" weight="plus">
            {cui}
          </Text>
        </div>
        {fiscal.regCom ? (
          <div>
            <Text size="small" className="text-ui-fg-muted">
              Nr. reg. com.
            </Text>
            <Text size="small" weight="plus">
              {fiscal.regCom}
            </Text>
          </div>
        ) : null}

        <button
          type="button"
          onClick={copy}
          className="mt-1 self-start text-ui-fg-interactive text-xs hover:underline"
        >
          Copiază datele fiscale
        </button>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderFiscalWidget
