import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

export type ReturnRequestStatus = "requested" | "received" | "refunded" | "denied"

export type ReturnRequestItem = {
  item_id: string
  quantity: number
  reason?: string
  note?: string
  title?: string
  variant_title?: string | null
  thumbnail?: string | null
}

export type ReturnRequest = {
  id: string
  order_id: string
  display_id: number | null
  customer_id: string | null
  email: string
  customer_name: string | null
  phone: string | null
  source: "account" | "guest"
  status: ReturnRequestStatus
  items: ReturnRequestItem[]
  note: string | null
  admin_note: string | null
  requested_at: string
  status_changed_at: string | null
}

export const STATUS_LABEL: Record<ReturnRequestStatus, string> = {
  requested: "Nouă",
  received: "Colet primit",
  refunded: "Rambursată",
  denied: "Refuzată",
}

export const STATUS_COLOR: Record<ReturnRequestStatus, "orange" | "blue" | "green" | "red"> = {
  requested: "orange",
  received: "blue",
  refunded: "green",
  denied: "red",
}

export const StatusBadge = ({ status }: { status: ReturnRequestStatus }) => (
  <Badge size="2xsmall" color={STATUS_COLOR[status]}>
    {STATUS_LABEL[status]}
  </Badge>
)

export const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("ro-RO", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.message || `Cererea a eșuat: ${res.status}`)
  return body as T
}

export const itemsSummary = (items: ReturnRequestItem[]) =>
  items.map((i) => `${i.title ?? i.item_id} × ${i.quantity}`).join(", ")

/**
 * Detaliile unei cereri + schimbarea statusului. Folosit și de pagina
 * „Cereri retur”, și de widgetul de pe comandă.
 */
export const ReturnRequestDrawer = ({
  request,
  onClose,
  onSaved,
  showOrderLink = true,
}: {
  request: ReturnRequest | null
  onClose: () => void
  onSaved: (r: ReturnRequest) => void
  showOrderLink?: boolean
}) => {
  const [status, setStatus] = useState<ReturnRequestStatus>("requested")
  const [adminNote, setAdminNote] = useState("")
  const [notify, setNotify] = useState(true)
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!request) return
    setStatus(request.status)
    setAdminNote(request.admin_note ?? "")
    setNotify(true)
    setMessage("")
  }, [request])

  const statusChanged = !!request && status !== request.status

  const save = async () => {
    if (!request) return
    setSaving(true)
    try {
      const body = await api<{ return_request: ReturnRequest; notified: boolean }>(
        `/admin/return-requests/${request.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            status,
            admin_note: adminNote.trim() || null,
            notify_customer: statusChanged && notify,
            customer_message: message.trim() || undefined,
          }),
        },
      )
      toast.success("Cererea a fost salvată", {
        description:
          statusChanged && notify
            ? body.notified
              ? "Clientul a primit email cu noul status."
              : "Emailul către client nu a putut fi trimis."
            : undefined,
      })
      onSaved(body.return_request)
    } catch (e: any) {
      toast.error(e?.message || "Nu s-a putut salva")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={!!request} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>
            Cerere retur {request?.display_id ? `— comanda #${request.display_id}` : ""}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          {request && (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={request.status} />
                  <Badge size="2xsmall" color="grey">
                    {request.source === "guest" ? "fără cont" : "din cont"}
                  </Badge>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  Trimisă pe {formatDateTime(request.requested_at)}
                  {request.status_changed_at
                    ? ` · status schimbat pe ${formatDateTime(request.status_changed_at)}`
                    : ""}
                </Text>
              </div>

              <div className="bg-ui-bg-subtle flex flex-col gap-1 rounded-md p-3">
                <Text size="small" weight="plus">
                  {request.customer_name || request.email}
                </Text>
                <Text size="small">
                  <a className="text-ui-fg-interactive" href={`mailto:${request.email}`}>
                    {request.email}
                  </a>
                </Text>
                {request.phone && (
                  <Text size="small">
                    <a className="text-ui-fg-interactive" href={`tel:${request.phone}`}>
                      {request.phone}
                    </a>
                  </Text>
                )}
                {showOrderLink && (
                  <Link
                    to={`/orders/${request.order_id}`}
                    className="text-ui-fg-interactive txt-small mt-1"
                  >
                    Deschide comanda #{request.display_id ?? request.order_id} →
                  </Link>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Produse</Label>
                <ul className="flex flex-col gap-2">
                  {request.items.map((it) => (
                    <li key={it.item_id} className="flex gap-3">
                      {it.thumbnail ? (
                        <img
                          src={it.thumbnail}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded border object-cover"
                        />
                      ) : (
                        <div className="bg-ui-bg-subtle h-10 w-10 shrink-0 rounded border" />
                      )}
                      <div className="flex min-w-0 flex-col">
                        <Text size="small" weight="plus">
                          {it.title ?? it.item_id} × {it.quantity}
                        </Text>
                        {it.variant_title && it.variant_title !== it.title && (
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {it.variant_title}
                          </Text>
                        )}
                        {it.reason && (
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            Motiv: {it.reason}
                          </Text>
                        )}
                        {it.note && (
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {it.note}
                          </Text>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {request.note && (
                <div className="flex flex-col gap-1">
                  <Label>Mesajul clientului</Label>
                  <Text size="small" className="whitespace-pre-wrap">
                    {request.note}
                  </Text>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ReturnRequestStatus)}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {(Object.keys(STATUS_LABEL) as ReturnRequestStatus[]).map((s) => (
                      <Select.Item key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              {statusChanged && (
                <div className="flex flex-col gap-3 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rr-notify"
                      checked={notify}
                      onCheckedChange={(v) => setNotify(v === true)}
                    />
                    <Label htmlFor="rr-notify">Trimite clientului email cu noul status</Label>
                  </div>
                  {notify && (
                    <Textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Mesaj pentru client (opțional) — ex. motivul refuzului sau data rambursării."
                    />
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <Label>Notă internă</Label>
                <Textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Vizibilă doar în admin (AWB retur, stare produs, IBAN…)."
                />
              </div>

              <Text size="xsmall" className="text-ui-fg-subtle">
                Statusul de aici îl vede clientul în cont. Returul propriu-zis
                (stoc, rambursare) se face în continuare din pagina comenzii.
              </Text>
            </>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Închide</Button>
          </Drawer.Close>
          <Button onClick={save} isLoading={saving}>
            Salvează
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
