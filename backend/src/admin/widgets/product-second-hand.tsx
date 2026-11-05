import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { ArrowPath } from "@medusajs/icons"
import { AdminProduct, DetailWidgetProps } from "@medusajs/types"
import {
  Button,
  Container,
  CurrencyInput,
  Heading,
  Input,
  Label,
  Select,
  Skeleton,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { ReactNode, useEffect, useState } from "react"

import { hasTag, setProductTag } from "../lib/product-tags"
import { useOptionalQueryClient } from "../lib/use-optional-query-client"

/**
 * Cardul „Second Hand": bifa + datele produsului folosit.
 *
 * A înlocuit bifa „Outlet / produs expus" (tag fără efect pe site). Bifat,
 * produsul primește tagul `second-hand` — badge pe carduri, pagina
 * /second-hand — iar pe pagina lui apar gradul, sănătatea bateriei, garanția,
 * observațiile și opțiunile „Baterie nouă 100%" / „Folie de sticlă montată".
 *
 * Prețurile celor două servicii sunt implicit cele de pe produsul „Servicii
 * Second Hand"; câmpul gol aici = prețul implicit.
 */

const TAG = "second-hand"
const SERVICE_HANDLES = ["garantie-extinsa", "servicii-second-hand"]

const GRADES = [
  { value: "ca-nou", label: "Ca nou" },
  { value: "excelent", label: "Excelent" },
  { value: "foarte-bun", label: "Foarte bun" },
  { value: "bun", label: "Bun" },
]

type Addon = "battery" | "screen_protector"
type Prices = Record<Addon, number | null>
type Details = {
  grade: string | null
  battery_health: number | null
  warranty_months: number | null
  notes: string | null
}
type Card = {
  enabled: boolean
  details: Details
  prices: Prices
  defaults: Prices
  services_missing: boolean
}

const ADDONS: { key: Addon; label: string }[] = [
  { key: "battery", label: "Preț „Baterie nouă 100%”" },
  { key: "screen_protector", label: "Preț „Folie de sticlă montată”" },
]

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(
    amount
  )

const toInt = (raw: string): number | null => {
  const n = Number(raw.replace(",", "."))
  return raw.trim() && Number.isFinite(n) ? Math.round(n) : null
}

const ProductSecondHandWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>): ReactNode => {
  const queryClient = useOptionalQueryClient()
  const [card, setCard] = useState<Card | null>(null)
  const [enabled, setEnabled] = useState(hasTag(product, TAG))
  const [details, setDetails] = useState<Details | null>(null)
  const [prices, setPrices] = useState<Prices | null>(null)
  const [toggling, setToggling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch(`/admin/second-hand/${product.id}`, {
      credentials: "include",
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body?.message || `Eroare ${res.status}`)
    setCard(body)
    setDetails(body.details)
    setPrices(body.prices)
  }

  useEffect(() => {
    load().catch((e) => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  if (SERVICE_HANDLES.includes(product.handle ?? "")) return null

  const toggle = async (next: boolean) => {
    setToggling(true)
    try {
      await setProductTag(product.id, TAG, next)
      setEnabled(next)
      toast.success(
        next ? "Produs marcat Second Hand" : "Produs scos din Second Hand"
      )
      queryClient?.invalidateQueries({ queryKey: ["products"] })
    } catch (e: any) {
      toast.error(e.message || "Eroare la salvare")
    } finally {
      setToggling(false)
    }
  }

  const save = async () => {
    if (!details || !prices) return
    setSaving(true)
    try {
      const res = await fetch(`/admin/second-hand/${product.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ details, prices }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || `Eroare ${res.status}`)
      setCard(body)
      setDetails(body.details)
      setPrices(body.prices)
      toast.success("Datele Second Hand au fost salvate")
      queryClient?.invalidateQueries({ queryKey: ["products"] })
    } catch (e: any) {
      toast.error(e.message || "Eroare la salvare")
    } finally {
      setSaving(false)
    }
  }

  const setDetail = <K extends keyof Details>(key: K, value: Details[K]) =>
    setDetails((d) => (d ? { ...d, [key]: value } : d))

  const dirty =
    !!card &&
    (JSON.stringify(details) !== JSON.stringify(card.details) ||
      JSON.stringify(prices) !== JSON.stringify(card.prices))

  return (
    <Container className="divide-y p-0">
      <div className="flex items-start gap-3 px-6 py-4">
        <span className="text-ui-fg-subtle mt-0.5">
          <ArrowPath />
        </span>
        <div className="flex-1 min-w-0">
          <label
            htmlFor="second-hand-toggle"
            className="cursor-pointer"
          >
            <Heading level="h2">Second Hand</Heading>
          </label>
          <Text size="small" className="text-ui-fg-subtle">
            Produs folosit: grad, baterie, garanție și opțiunile baterie nouă /
            folie montată pe pagina produsului.
          </Text>
        </div>
        <Switch
          id="second-hand-toggle"
          checked={enabled}
          disabled={toggling}
          onCheckedChange={toggle}
          className="mt-1 shrink-0"
        />
      </div>

      {enabled && (
        <div className="flex flex-col gap-4 px-6 py-4">
          {error && (
            <Text size="small" className="text-ui-fg-error">
              {error}
            </Text>
          )}
          {!details || !prices || !card ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <Label size="small" weight="plus">
                  Aspect (grad)
                </Label>
                <Select
                  value={details.grade ?? ""}
                  onValueChange={(v) => setDetail("grade", v || null)}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Alege gradul" />
                  </Select.Trigger>
                  <Select.Content>
                    {GRADES.map((g) => (
                      <Select.Item key={g.value} value={g.value}>
                        {g.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus" htmlFor="sh-battery">
                    Sănătate baterie (%)
                  </Label>
                  <Input
                    id="sh-battery"
                    type="number"
                    min={1}
                    max={100}
                    placeholder="ex. 83"
                    value={details.battery_health ?? ""}
                    onChange={(e) =>
                      setDetail("battery_health", toInt(e.target.value))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus" htmlFor="sh-warranty">
                    Garanție (luni)
                  </Label>
                  <Input
                    id="sh-warranty"
                    type="number"
                    min={1}
                    max={60}
                    placeholder="ex. 12"
                    value={details.warranty_months ?? ""}
                    onChange={(e) =>
                      setDetail("warranty_months", toInt(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Label size="small" weight="plus" htmlFor="sh-notes">
                  Observații
                </Label>
                <Textarea
                  id="sh-notes"
                  rows={3}
                  placeholder="ex. Zgârieturi fine pe ramă, ecran impecabil. Cutie și cablu incluse."
                  value={details.notes ?? ""}
                  onChange={(e) => setDetail("notes", e.target.value || null)}
                />
              </div>

              {card.services_missing ? (
                <Text size="small" className="text-ui-fg-subtle">
                  Opțiunile „Baterie nouă” și „Folie montată” apar după ce rulezi
                  scriptul <code>create-second-hand-services</code>.
                </Text>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {ADDONS.map(({ key, label }) => {
                    const fallback = card.defaults[key]
                    return (
                      <div key={key} className="flex flex-col gap-1">
                        <Label size="small" weight="plus" htmlFor={`sh-${key}`}>
                          {label}
                        </Label>
                        <CurrencyInput
                          id={`sh-${key}`}
                          symbol="lei"
                          code="RON"
                          decimalsLimit={2}
                          decimalSeparator=","
                          groupSeparator="."
                          allowNegativeValue={false}
                          placeholder={
                            fallback != null
                              ? `standard: ${formatMoney(fallback)}`
                              : "fără preț"
                          }
                          value={prices[key] ?? ""}
                          onValueChange={(_v, _n, values) =>
                            setPrices((p) =>
                              p ? { ...p, [key]: values?.float ?? null } : p
                            )
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  size="small"
                  onClick={save}
                  isLoading={saving}
                  disabled={!dirty}
                >
                  Salvează
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductSecondHandWidget
