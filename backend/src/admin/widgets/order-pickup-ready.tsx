import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/types"
import { BuildingStorefront } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"

/** Recunoaștem ridicarea din magazin după numele metodei de livrare salvate. */
const isPickupMethod = (name?: string | null) =>
  /ridicare/i.test(name ?? "")

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ro-RO")
  } catch {
    return iso
  }
}

const OrderPickupReadyWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const methods = (order.shipping_methods ?? []) as { name?: string | null }[]
  const isPickup = methods.some((m) => isPickupMethod(m?.name))

  const [note, setNote] = useState("")
  const [sending, setSending] = useState(false)
  const [sentAt, setSentAt] = useState<string | null>(
    ((order.metadata as Record<string, any> | null)
      ?.pickup_ready_notified_at as string) ?? null
  )

  // Metadata din props poate fi stale după un refetch al paginii.
  useEffect(() => {
    const fromProps = (order.metadata as Record<string, any> | null)
      ?.pickup_ready_notified_at as string | undefined
    if (fromProps) setSentAt(fromProps)
  }, [order.metadata])

  if (!isPickup) return null

  const send = async (force: boolean) => {
    setSending(true)
    try {
      const res = await fetch(`/admin/orders/${order.id}/notify-pickup-ready`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined, force }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(body?.message || `Eroare ${res.status}`)
      }
      setSentAt(body.pickup_ready_notified_at ?? new Date().toISOString())
      setNote("")
      toast.success(`Email trimis către ${order.email}`)
    } catch (err: any) {
      toast.error(err.message || "Nu am putut trimite emailul")
    } finally {
      setSending(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <BuildingStorefront />
          <Heading level="h2">Ridicare din magazin</Heading>
        </div>
        {sentAt ? (
          <Badge color="green" size="2xsmall">
            Anunțat {formatDate(sentAt)}
          </Badge>
        ) : (
          <Badge color="orange" size="2xsmall">
            Clientul nu a fost anunțat
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Trimite clientului un email că <strong>comanda este disponibilă în
          magazin</strong>. Emailul conține numărul comenzii, adresa și programul
          punctului de ridicare.
        </Text>

        <Textarea
          placeholder={
            "Mesaj opțional pentru client (ex. „Te așteptăm până vineri, 18:00.”)"
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          disabled={sending}
        />

        <div className="flex items-center gap-2">
          <Button
            variant={sentAt ? "secondary" : "primary"}
            size="small"
            isLoading={sending}
            onClick={() => send(!!sentAt)}
          >
            {sentAt ? "Trimite din nou" : "Anunță clientul"}
          </Button>
          <Text size="small" className="text-ui-fg-muted">
            → {order.email}
          </Text>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderPickupReadyWidget
