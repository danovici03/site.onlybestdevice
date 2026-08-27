import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminOrder } from "@medusajs/types"
import {
  Badge,
  Button,
  Container,
  Heading,
  Prompt,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type StatusCode =
  | "processing"
  | "pending"
  | "payment_failed"
  | "awaiting_bank_transfer"
  | "canceled"
  | "completed"

type StatusState = {
  status: {
    code: StatusCode
    label: string
    note: string | null
    manual: boolean
    derived: StatusCode
  }
  derived: { code: StatusCode; label: string }
  medusa: { payment_status: string | null; fulfillment_status: string | null }
  can_send_payment_link: boolean
  payment_link_blocked_reason: string | null
  payment_link: { sent_at: string; count: number } | null
  history: {
    code: StatusCode
    label?: string
    note: string | null
    at: string
    by: string | null
  }[]
  options: { code: StatusCode; label: string }[]
}

const TONE: Record<StatusCode, "green" | "orange" | "red" | "grey" | "blue"> = {
  processing: "blue",
  pending: "orange",
  payment_failed: "red",
  awaiting_bank_transfer: "orange",
  canceled: "red",
  completed: "green",
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ro-RO")
  } catch {
    return iso
  }
}

const api = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.message || `Eroare ${res.status}`)
  }
  return body
}

/**
 * Cardul de status al comenzii.
 *
 * Medusa arată în header două badge-uri separate („Autorizat", „Nelivrat") —
 * axele tehnice ale comenzii. Aici e statusul comercial, unul singur, cel pe
 * care îl vede și clientul în contul lui.
 *
 * Statusul se calculează în backend (`GET /admin/orders/:id/status`), nu aici:
 * regula de derivare trebuie să rămână într-un singur loc, altfel adminul și
 * storefrontul ar începe să spună lucruri diferite despre aceeași comandă.
 */
const OrderStatusWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [state, setState] = useState<StatusState | null>(null)
  const [code, setCode] = useState<StatusCode | "">("")
  const [note, setNote] = useState("")
  const [notify, setNotify] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const load = useCallback(async () => {
    try {
      const body = (await api(`/admin/orders/${order.id}/status`)) as StatusState
      setState(body)
      setCode(body.status.code)
      setNote(body.status.note ?? "")
    } catch (e: any) {
      toast.error(e.message || "Nu am putut citi statusul comenzii")
    }
  }, [order.id])

  useEffect(() => {
    load()
  }, [load])

  if (!state) return null

  const dirty =
    code !== state.status.code || note !== (state.status.note ?? "")

  const apply = async (chosen: StatusCode) => {
    setSaving(true)
    try {
      await api(`/admin/orders/${order.id}/status`, {
        method: "POST",
        body: JSON.stringify({
          code: chosen,
          note: note.trim() || undefined,
          notify,
        }),
      })
      toast.success(
        chosen === "canceled"
          ? "Comanda a fost anulată"
          : notify
            ? "Status salvat, email trimis clientului"
            : "Status salvat"
      )
      setNotify(false)
      await load()
    } catch (e: any) {
      toast.error(e.message || "Nu am putut salva statusul")
    } finally {
      setSaving(false)
      setConfirmCancel(false)
    }
  }

  const save = () => {
    if (!code) return
    // Anularea eliberează stocul și anulează plățile — nu e reversibilă.
    if (code === "canceled") {
      setConfirmCancel(true)
      return
    }
    apply(code)
  }

  const sendPaymentLink = async () => {
    setSendingLink(true)
    try {
      const body = await api(`/admin/orders/${order.id}/payment-link`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() || undefined }),
      })
      toast.success(`Link de plată trimis către ${body.to}`)
      await load()
    } catch (e: any) {
      toast.error(e.message || "Nu am putut trimite linkul de plată")
    } finally {
      setSendingLink(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Status comandă</Heading>
        <Badge color={TONE[state.status.code]} size="2xsmall">
          {state.status.label}
        </Badge>
      </div>

      <div className="px-6 py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Text size="small" className="text-ui-fg-muted">
            Starea reală în Medusa: {state.medusa.payment_status ?? "—"} ·{" "}
            {state.medusa.fulfillment_status ?? "—"} → {state.derived.label}
          </Text>
          {state.status.manual && (
            <Text size="small" className="text-ui-fg-muted">
              Eticheta e pusă manual. Se stinge singură când comanda avansează.
            </Text>
          )}
        </div>

        <Select value={code} onValueChange={(v) => setCode(v as StatusCode)}>
          <Select.Trigger>
            <Select.Value placeholder="Alege statusul" />
          </Select.Trigger>
          <Select.Content>
            {state.options.map((o) => (
              <Select.Item key={o.code} value={o.code}>
                {o.label}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>

        <Textarea
          rows={2}
          placeholder="Notă pentru client (opțional) — ex. „așteptăm stocul, estimare 5 zile”"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="notify-customer"
              checked={notify}
              onCheckedChange={setNotify}
              disabled={code === "canceled"}
            />
            <label htmlFor="notify-customer">
              <Text size="small">
                {code === "canceled"
                  ? "Emailul de anulare pleacă automat"
                  : "Trimite email clientului"}
              </Text>
            </label>
          </div>
          <Button
            size="small"
            variant={code === "canceled" ? "danger" : "primary"}
            isLoading={saving}
            disabled={!dirty && !notify}
            onClick={save}
          >
            {code === "canceled" ? "Anulează comanda" : "Salvează"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <Text size="small" weight="plus">
              Link de plată cu cardul
            </Text>
            <Text size="small" className="text-ui-fg-muted">
              {state.can_send_payment_link
                ? state.payment_link
                  ? `Trimis ultima dată ${formatDate(state.payment_link.sent_at)} (${state.payment_link.count}×)`
                  : `Trimite un link de plată către ${order.email}`
                : state.payment_link_blocked_reason}
            </Text>
          </div>
          {state.can_send_payment_link && (
            <Button
              size="small"
              variant="secondary"
              isLoading={sendingLink}
              onClick={sendPaymentLink}
            >
              {state.payment_link ? "Retrimite" : "Trimite"}
            </Button>
          )}
        </div>
      </div>

      {state.history.length > 0 && (
        <div className="px-6 py-4 flex flex-col gap-2">
          <Text size="small" weight="plus">
            Istoric
          </Text>
          {state.history.map((h, i) => (
            <div key={`${h.at}-${i}`} className="flex justify-between gap-3">
              <Text size="small" className="text-ui-fg-subtle">
                {state.options.find((o) => o.code === h.code)?.label ?? h.code}
                {h.note ? ` — ${h.note}` : ""}
              </Text>
              <Text size="small" className="text-ui-fg-muted whitespace-nowrap">
                {formatDate(h.at)}
              </Text>
            </div>
          ))}
        </div>
      )}

      <Prompt open={confirmCancel} onOpenChange={setConfirmCancel}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Anulezi comanda?</Prompt.Title>
            <Prompt.Description>
              Rezervările de stoc se eliberează, plățile în așteptare se
              anulează, iar clientul primește automat emailul de anulare.
              Acțiunea nu poate fi anulată.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Renunță</Prompt.Cancel>
            <Prompt.Action onClick={() => apply("canceled")}>
              Anulează comanda
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
})

export default OrderStatusWidget
