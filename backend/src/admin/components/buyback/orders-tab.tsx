import { Badge, Button, Checkbox, Drawer, Heading, Input, Label, Table, Text, Textarea, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

import { AnswersForm, answersSummary, PERFECT_ANSWERS, type Answers } from "./answers-form"
import { api, lei, storageLabel } from "./shared"

type Status = "submitted" | "received" | "revised" | "accepted" | "paid" | "declined" | "returned" | "canceled"

export type BuybackOrder = {
  id: string
  display_id: number
  status: Status
  device_name: string
  brand: string
  storage: string
  color: string | null
  answers: Answers
  inspection: Answers | null
  base_price: number
  quoted_price: number
  quoted_voucher_price: number
  voucher_bonus_percent: number
  quote_expires_at: string
  payout_method: "bank" | "voucher"
  revised_price: number | null
  revised_voucher_price: number | null
  final_amount: number | null
  first_name: string
  last_name: string
  email: string
  phone: string
  delivery_method: "courier" | "store"
  address: { county?: string; city?: string; street?: string; postal_code?: string } | null
  iban: string | null
  iban_holder: string | null
  cnp: string | null
  id_document: string | null
  home_address: string | null
  customer_note: string | null
  admin_note: string | null
  customer_message: string | null
  awb: string | null
  voucher_code: string | null
  submitted_at: string
  status_changed_at: string | null
  paid_at: string | null
}

export const STATUS: Record<Status, { label: string; color: "grey" | "blue" | "orange" | "green" | "red" | "purple" }> = {
  submitted: { label: "Trimisă", color: "blue" },
  received: { label: "Primit — în verificare", color: "orange" },
  revised: { label: "Ofertă revizuită", color: "purple" },
  accepted: { label: "De plătit", color: "orange" },
  paid: { label: "Plătită", color: "green" },
  declined: { label: "Refuzată — de returnat", color: "red" },
  returned: { label: "Returnat clientului", color: "grey" },
  canceled: { label: "Anulată", color: "grey" },
}

/** Ce scrie pe butonul care duce preluarea în statusul respectiv. */
const ACTION_LABEL: Record<Status, string> = {
  submitted: "",
  received: "Am primit telefonul",
  revised: "Trimite oferta revizuită",
  accepted: "Starea corespunde — aprobă",
  paid: "Marchează plătită",
  declined: "Refuză preluarea",
  returned: "Telefon returnat",
  canceled: "Anulează",
}

const FILTERS: (Status | "all")[] = ["submitted", "received", "revised", "accepted", "declined", "paid", "all"]

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"

const amountOf = (o: BuybackOrder) =>
  o.final_amount ??
  (o.payout_method === "voucher" ? (o.revised_voucher_price ?? o.quoted_voucher_price) : (o.revised_price ?? o.quoted_price))

export const OrdersTab = () => {
  const [rows, setRows] = useState<BuybackOrder[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<Status | "all">("submitted")
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  const [selected, setSelected] = useState<BuybackOrder | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ limit: "100" })
      if (filter !== "all") p.set("status", filter)
      if (term) p.set("q", term)
      const data = await api<{ orders: BuybackOrder[]; counts: Record<string, number> }>(`/admin/buyback/orders?${p}`)
      setRows(data.orders)
      setCounts(data.counts)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter, term])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="divide-y">
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        {FILTERS.map((f) => (
          <Button key={f} size="small" variant={filter === f ? "primary" : "secondary"} onClick={() => setFilter(f)}>
            {f === "all" ? "Toate" : STATUS[f].label}
            {f !== "all" && counts[f] ? ` (${counts[f]})` : ""}
          </Button>
        ))}
        <Input
          size="small"
          className="ml-auto w-64"
          placeholder="Nr., email, nume, model…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Nr.</Table.HeaderCell>
            <Table.HeaderCell>Telefon</Table.HeaderCell>
            <Table.HeaderCell>Client</Table.HeaderCell>
            <Table.HeaderCell>Plată</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Trimisă</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((o) => (
            <Table.Row key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
              <Table.Cell>#{o.display_id}</Table.Cell>
              <Table.Cell>
                {o.device_name} · {storageLabel(o.storage)}
              </Table.Cell>
              <Table.Cell>
                {o.first_name} {o.last_name}
              </Table.Cell>
              <Table.Cell>
                {lei(amountOf(o))} {o.payout_method === "voucher" ? "voucher" : "transfer"}
              </Table.Cell>
              <Table.Cell>
                <Badge size="2xsmall" color={STATUS[o.status].color}>
                  {STATUS[o.status].label}
                </Badge>
              </Table.Cell>
              <Table.Cell>{fmtDate(o.submitted_at)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
      {!loading && !rows.length && (
        <Text size="small" className="text-ui-fg-subtle px-6 py-8 text-center">
          Nicio preluare aici.
        </Text>
      )}
      {selected && (
        <OrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onSaved={(o) => {
            setSelected(o)
            load()
          }}
        />
      )}
    </div>
  )
}

function OrderDrawer({
  order,
  onClose,
  onSaved,
}: {
  order: BuybackOrder
  onClose: () => void
  onSaved: (o: BuybackOrder) => void
}) {
  const apple = order.brand.toLowerCase() === "apple"
  const [transitions, setTransitions] = useState<Status[]>([])
  const [inspection, setInspection] = useState<Answers>(order.inspection ?? order.answers ?? PERFECT_ANSWERS)
  const [preview, setPreview] = useState<{ revised_price: number | null; revised_voucher_price: number | null; quote: any } | null>(null)
  const [manualPrice, setManualPrice] = useState("")
  const [adminNote, setAdminNote] = useState(order.admin_note ?? "")
  const [message, setMessage] = useState(order.customer_message ?? "")
  const [awb, setAwb] = useState(order.awb ?? "")
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<{ transitions: Status[] }>(`/admin/buyback/orders/${order.id}`)
      .then((d) => setTransitions(d.transitions))
      .catch((e) => toast.error(e.message))
  }, [order.id, order.status])

  const runPreview = async () => {
    try {
      const d = await api<any>(`/admin/buyback/orders/${order.id}/inspect`, {
        method: "POST",
        body: JSON.stringify({ inspection }),
      })
      setPreview(d)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const save = async (status?: Status) => {
    if (status === "paid" && order.payout_method === "bank" && !window.confirm(`Ai făcut transferul de ${lei(amountOf(order))} către ${order.iban}?`)) return
    if (status === "canceled" && !window.confirm("Anulezi preluarea?")) return
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        admin_note: adminNote || null,
        awb: awb || null,
        notify,
      }
      // Doar dacă l-ai schimbat: la un status nou, backend-ul șterge mesajul
      // vechi, iar retrimis la fiecare salvare ar apărea în toate emailurile.
      if ((message || null) !== (order.customer_message ?? null)) body.customer_message = message || null
      if (["received", "revised"].includes(order.status) || status === "revised" || status === "accepted") {
        body.inspection = inspection
      }
      if (status) body.status = status
      if (status === "revised" && manualPrice) body.revised_price = Number(manualPrice)
      const d = await api<{ order: BuybackOrder; transitions: Status[] }>(`/admin/buyback/orders/${order.id}`, {
        method: "POST",
        body: JSON.stringify(body),
      })
      setTransitions(d.transitions)
      setMessage(d.order.customer_message ?? "")
      toast.success(status ? `Status: ${STATUS[d.order.status].label}` : "Salvat")
      onSaved(d.order)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const inspecting = ["received", "revised"].includes(order.status)
  const clientRows = answersSummary(order.answers, apple)
  const inspRows = order.inspection ? answersSummary(order.inspection, apple) : null
  const a = order.address

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <Drawer.Content className="max-w-[720px]">
        <Drawer.Header>
          <Drawer.Title>
            Preluarea #{order.display_id} — {order.device_name}
          </Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-6 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={STATUS[order.status].color}>{STATUS[order.status].label}</Badge>
            <Text size="small" className="text-ui-fg-subtle">
              {storageLabel(order.storage)}
              {order.color ? ` · ${order.color}` : ""} · trimisă {fmtDate(order.submitted_at)}
            </Text>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Heading level="h3">Client</Heading>
              <Text size="small">
                {order.first_name} {order.last_name}
                <br />
                {order.email}
                <br />
                {order.phone}
              </Text>
              <Text size="small" className="text-ui-fg-subtle mt-2">
                {order.delivery_method === "store"
                  ? "Aduce telefonul în magazin"
                  : `Ridicare curier: ${[a?.street, a?.city, a?.county, a?.postal_code].filter(Boolean).join(", ")}`}
              </Text>
              {order.cnp && (
                <Text size="small" className="mt-2">
                  <span className="text-ui-fg-subtle">Pentru borderou:</span>
                  <br />
                  CNP <code className="txt-compact-xsmall">{order.cnp}</code> · CI {order.id_document}
                  <br />
                  Domiciliu: {order.home_address}
                </Text>
              )}
            </div>
            <div>
              <Heading level="h3">Plată</Heading>
              <Text size="small">
                {order.payout_method === "voucher"
                  ? `Voucher (+${order.voucher_bonus_percent}%)`
                  : `Transfer — ${order.iban_holder ?? ""}`}
                <br />
                {order.iban && <code className="txt-compact-xsmall">{order.iban.replace(/(.{4})/g, "$1 ")}</code>}
              </Text>
              <Text size="small" className="mt-2">
                Oferta inițială: <b>{lei(order.payout_method === "voucher" ? order.quoted_voucher_price : order.quoted_price)}</b>
                {order.revised_price != null && (
                  <>
                    <br />
                    Revizuită:{" "}
                    <b>{lei(order.payout_method === "voucher" ? order.revised_voucher_price : order.revised_price)}</b>
                  </>
                )}
                {order.final_amount != null && (
                  <>
                    <br />
                    De plătit: <b>{lei(order.final_amount)}</b>
                  </>
                )}
              </Text>
              {order.voucher_code && (
                <Text size="small" className="mt-2">
                  Voucher: <code>{order.voucher_code}</code>
                </Text>
              )}
            </div>
          </div>

          {order.customer_note && (
            <div className="bg-ui-bg-subtle rounded-lg p-3">
              <Text size="small" weight="plus">
                Mesajul clientului
              </Text>
              <Text size="small">{order.customer_note}</Text>
            </div>
          )}

          <div>
            <Heading level="h3">Evaluare client {inspRows ? "vs. verificare" : ""}</Heading>
            <Table>
              <Table.Body>
                {clientRows.map(([k, v], i) => {
                  const iv = inspRows?.[i]?.[1]
                  return (
                    <Table.Row key={k}>
                      <Table.Cell>{k}</Table.Cell>
                      <Table.Cell>{v}</Table.Cell>
                      {inspRows && (
                        <Table.Cell className={iv !== v ? "text-ui-fg-error font-medium" : ""}>{iv}</Table.Cell>
                      )}
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table>
          </div>

          {inspecting && (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <Heading level="h3">Verificare tehnică</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Pornește de la răspunsurile clientului; schimbă doar ce diferă. Oferta revizuită folosește
                prețul de bază din momentul ofertei ({lei(order.base_price)}) și bonusul promis.
              </Text>
              <AnswersForm value={inspection} onChange={setInspection} apple={apple} />
              <div className="flex flex-wrap items-end gap-3">
                <Button size="small" variant="secondary" onClick={runPreview}>
                  Calculează oferta revizuită
                </Button>
                {preview && (
                  <Text size="small">
                    {preview.revised_price != null
                      ? `Transfer ${lei(preview.revised_price)} / voucher ${lei(preview.revised_voucher_price)}`
                      : `Fără ofertă (${preview.quote?.status === "rejected" ? preview.quote.reasons.join(", ") : "sub minim"})`}
                  </Text>
                )}
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <Label size="small">Sumă manuală prin transfer (opțional)</Label>
                  <Input
                    size="small"
                    className="w-40"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <div>
              <Label size="small">Mesaj pentru client (apare în email și pe pagina preluării)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex.: ecranul are zgârieturi adânci în colțul din dreapta jos." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label size="small">AWB</Label>
                <Input size="small" value={awb} onChange={(e) => setAwb(e.target.value)} />
              </div>
            </div>
            <div>
              <Label size="small">Notă internă</Label>
              <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
              <Text size="small">Trimite email clientului la schimbarea statusului</Text>
            </label>
          </div>
        </Drawer.Body>
        <Drawer.Footer className="flex flex-wrap justify-end gap-2">
          <Button size="small" variant="secondary" onClick={() => save()} isLoading={busy}>
            Salvează
          </Button>
          {transitions.map((t) => (
            <Button
              key={t}
              size="small"
              variant={t === "canceled" || t === "declined" ? "danger" : "primary"}
              onClick={() => save(t)}
              isLoading={busy}
            >
              {ACTION_LABEL[t]}
            </Button>
          ))}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}
