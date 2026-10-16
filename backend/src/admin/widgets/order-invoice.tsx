import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/types"
import { DocumentText } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

import { uploadPdf } from "../lib/admin-uploads"

type Invoice = {
  url: string
  file_name: string | null
  attached_at: string | null
}

const readInvoice = (metadata: unknown): Invoice | null => {
  const m = (metadata ?? {}) as Record<string, unknown>
  if (typeof m.invoice_url !== "string" || !m.invoice_url) return null
  return {
    url: m.invoice_url,
    file_name: typeof m.invoice_file_name === "string" ? m.invoice_file_name : null,
    attached_at:
      typeof m.invoice_attached_at === "string" ? m.invoice_attached_at : null,
  }
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ro-RO")
  } catch {
    return iso
  }
}

/**
 * Factura fiscală a comenzii. Site-ul nu generează facturi: o emitem noi după
 * plată și o atașăm de aici. Cât timp nu e atașată, clientul nu vede niciun
 * buton de factură; după atașare îl vede pe pagina comenzii și în cont.
 */
const OrderInvoiceWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const prompt = usePrompt()
  const inputRef = useRef<HTMLInputElement>(null)
  const [invoice, setInvoice] = useState<Invoice | null>(() =>
    readInvoice(order.metadata)
  )
  const [busy, setBusy] = useState(false)

  // Metadata din props poate fi stale după un refetch al paginii.
  useEffect(() => {
    setInvoice(readInvoice(order.metadata))
  }, [order.metadata])

  const attach = async (file: File) => {
    setBusy(true)
    try {
      const url = await uploadPdf(file)
      const res = await fetch(`/admin/orders/${order.id}/invoice`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, file_name: file.name }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `Eroare ${res.status}`)
      setInvoice(body.invoice)
      toast.success("Factura a fost atașată", {
        description: body.revalidated
          ? "Clientul o vede acum pe pagina comenzii."
          : "Salvată, dar site-ul n-a confirmat reîmprospătarea — poate apărea cu întârziere.",
      })
    } catch (e: any) {
      toast.error(e?.message || "Factura nu a putut fi atașată")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const remove = async () => {
    const confirmed = await prompt({
      title: "Scoți factura?",
      description:
        "Clientul nu va mai vedea butonul de descărcare. Poți atașa alta oricând.",
      confirmText: "Scoate",
      cancelText: "Renunță",
    })
    if (!confirmed) return

    setBusy(true)
    try {
      const res = await fetch(`/admin/orders/${order.id}/invoice`, {
        method: "DELETE",
        credentials: "include",
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `Eroare ${res.status}`)
      setInvoice(null)
      toast.success("Factura a fost scoasă")
    } catch (e: any) {
      toast.error(e?.message || "Factura nu a putut fi scoasă")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <DocumentText />
          <Heading level="h2">Factură</Heading>
        </div>
        <Badge color={invoice ? "green" : "grey"} size="2xsmall">
          {invoice ? "Atașată" : "Neatașată"}
        </Badge>
      </div>

      <div className="flex flex-col gap-3 px-6 py-4">
        {invoice ? (
          <div>
            <a
              href={invoice.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ui-fg-interactive txt-compact-small-plus hover:underline break-all"
            >
              {invoice.file_name || "Vezi factura"}
            </a>
            {invoice.attached_at ? (
              <Text size="small" className="text-ui-fg-muted">
                Atașată la {formatDate(invoice.attached_at)}
              </Text>
            ) : null}
          </div>
        ) : (
          <Text size="small" className="text-ui-fg-muted">
            Clientul nu vede nicio factură până nu atașezi PDF-ul emis.
          </Text>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) attach(file)
          }}
        />

        <div className="flex gap-2">
          <Button
            size="small"
            variant="secondary"
            isLoading={busy}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {invoice ? "Înlocuiește PDF" : "Atașează factura (PDF)"}
          </Button>
          {invoice ? (
            <Button
              size="small"
              variant="transparent"
              disabled={busy}
              onClick={remove}
            >
              Scoate
            </Button>
          ) : null}
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderInvoiceWidget
