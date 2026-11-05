import { Badge, Button, Heading, Label, Select, Table, Text, toast } from "@medusajs/ui"
import { useMemo, useState } from "react"

import { AnswersForm, PERFECT_ANSWERS, type Answers } from "./answers-form"
import { api, lei, storageLabel, type BuybackDevice } from "./shared"

type Quote = {
  status: "offer" | "rejected" | "too_low" | "unavailable"
  base_price: number | null
  price?: number
  voucher_price?: number
  voucher_bonus_percent?: number
  total_deduction?: number
  min_offer?: number
  reasons?: string[]
  deductions: {
    key: string
    label: string
    kind: string
    value: number
    amount: number
    applied: boolean
    source: string
  }[]
}

const SOURCE_LABEL: Record<string, string> = {
  device: "model",
  brand: "brand",
  global: "global",
  default: "implicit",
}

/** Ce ofertă primește clientul pentru un set de răspunsuri — cu tot calculul. */
export const CalculatorTab = ({ devices }: { devices: BuybackDevice[] }) => {
  const [deviceId, setDeviceId] = useState("")
  const [priceId, setPriceId] = useState("")
  const [answers, setAnswers] = useState<Answers>(PERFECT_ANSWERS)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)

  const sorted = useMemo(
    () => [...devices].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)),
    [devices],
  )
  const device = devices.find((d) => d.id === deviceId)
  const apple = device?.brand.toLowerCase() === "apple"

  const run = async () => {
    setBusy(true)
    try {
      const { quote } = await api<{ quote: Quote }>("/admin/buyback/quote", {
        method: "POST",
        body: JSON.stringify({
          price_id: priceId,
          answers,
        }),
      })
      setQuote(quote)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 px-6 py-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label size="small">Model</Label>
            <Select
              size="small"
              value={deviceId}
              onValueChange={(v) => (setDeviceId(v), setPriceId(""), setQuote(null))}
            >
              <Select.Trigger>
                <Select.Value placeholder="Alege modelul…" />
              </Select.Trigger>
              <Select.Content>
                {sorted.map((d) => (
                  <Select.Item key={d.id} value={d.id}>
                    {d.brand} {d.model}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div>
            <Label size="small">Stocare</Label>
            <Select size="small" value={priceId} onValueChange={setPriceId} disabled={!device}>
              <Select.Trigger>
                <Select.Value placeholder="Alege…" />
              </Select.Trigger>
              <Select.Content>
                {(device?.prices ?? []).map((p) => (
                  <Select.Item key={p.id} value={p.id}>
                    {storageLabel(p.storage)} — {p.base_price == null ? "fără preț" : lei(p.base_price)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>

        <AnswersForm value={answers} onChange={setAnswers} apple={apple} />

        <div>
          <Button size="small" onClick={run} disabled={!priceId} isLoading={busy}>
            Calculează oferta
          </Button>
        </div>
      </div>

      <div>
        {quote && (
          <div className="flex flex-col gap-3">
            <Heading level="h3">
              {quote.status === "offer" && `Oferta: ${lei(quote.price)}`}
              {quote.status === "rejected" && "Fără ofertă (refuz)"}
              {quote.status === "too_low" && `Sub ofertă minimă (${lei(quote.price)} < ${lei(quote.min_offer)})`}
              {quote.status === "unavailable" && "Stocarea nu are preț de bază"}
            </Heading>
            {quote.status === "offer" && (
              <Text size="small">
                Voucher pe site: <b>{lei(quote.voucher_price)}</b> (+{quote.voucher_bonus_percent}%)
              </Text>
            )}
            {quote.reasons?.length ? (
              <Text size="small" className="text-ui-fg-error">
                Motiv: {quote.reasons.join(", ")}
              </Text>
            ) : null}
            {quote.base_price != null && (
              <Table>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell>Preț de bază</Table.Cell>
                    <Table.Cell />
                    <Table.Cell className="text-right">{lei(quote.base_price)}</Table.Cell>
                  </Table.Row>
                  {quote.deductions.map((d) => (
                    <Table.Row key={d.key} className={d.applied ? "" : "opacity-50 line-through"}>
                      <Table.Cell>{d.label}</Table.Cell>
                      <Table.Cell>
                        <Badge size="2xsmall" color="grey">
                          {d.kind === "reject" ? "refuz" : d.kind === "percent" ? `${d.value}%` : `${d.value} lei`}
                          {" · "}
                          {SOURCE_LABEL[d.source] ?? d.source}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell className="text-right">{d.kind === "reject" ? "—" : `−${lei(d.amount)}`}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
            {quote.deductions.some((d) => !d.applied) && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Rândurile tăiate sunt acoperite de o reparație mai mare din aceeași grupă.
              </Text>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
