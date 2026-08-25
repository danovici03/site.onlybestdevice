import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import { AdminProduct, DetailWidgetProps } from "@medusajs/types"
import {
  Button,
  Container,
  CurrencyInput,
  Heading,
  Label,
  Skeleton,
  Text,
  toast,
} from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

import {
  fetchProductPrices,
  saveProductPrices,
  type PriceUpdate,
  type ProductPrices,
} from "../lib/product-prices"
import { hasTag } from "../lib/product-tags"
import { useOptionalQueryClient } from "../lib/use-optional-query-client"

/**
 * Cardul „Preț" — preț normal și preț promoțional, direct pe pagina produsului.
 *
 * Medusa v2 nu are niciun câmp de preț inline: singura cale nativă e gridul
 * ascuns în meniul „⋯" al tabelului de variante, gândit pentru cataloage cu mai
 * multe monede și regiuni. Aici avem o monedă și, practic, o variantă pe produs,
 * așa că prețul merită să fie exact acolo unde se uită operatorul.
 *
 * Cele două câmpuri nu sunt simetrice în spate: prețul normal e prețul variantei,
 * iar cel promoțional e un rând într-o price list de tip `sale` — singura formă
 * din care storefront-ul deduce prețul tăiat. Traducerea o face serverul.
 */

/** Simbolul din stânga inputului. Codul monedei se afișează oricum în dreapta. */
const SYMBOLS: Record<string, string> = { ron: "lei", eur: "€", usd: "$" }

const symbolOf = (code: string) => SYMBOLS[code.toLowerCase()] ?? code.toUpperCase()

const formatMoney = (amount: number, code: string) =>
  new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: code.toUpperCase(),
  }).format(amount)

type Draft = Record<string, { price: number | null; sale_price: number | null }>

const toDraft = (data: ProductPrices): Draft =>
  Object.fromEntries(
    data.variants.map((v) => [v.id, { price: v.price, sale_price: v.sale_price }])
  )

/** Ce trimitem la salvare: doar variantele chiar modificate. */
const changedUpdates = (data: ProductPrices, draft: Draft): PriceUpdate[] =>
  data.variants.flatMap((v) => {
    const next = draft[v.id]
    if (!next) return []

    const update: PriceUpdate = { id: v.id }
    if (next.price !== v.price && next.price != null) update.price = next.price
    if (next.sale_price !== v.sale_price) update.sale_price = next.sale_price

    return Object.keys(update).length > 1 ? [update] : []
  })

const ProductPriceWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const queryClient = useOptionalQueryClient()
  const [data, setData] = useState<ProductPrices | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchProductPrices(product.id)
      .then((res) => {
        if (!alive) return
        setData(res)
        setDraft(toDraft(res))
      })
      .catch((err: any) => alive && setError(err.message || "Eroare la citirea prețurilor"))
    return () => {
      alive = false
    }
  }, [product.id])

  const updates = useMemo(
    () => (data ? changedUpdates(data, draft) : []),
    [data, draft]
  )

  // Golirea prețului normal n-are corespondent: în Medusa un preț se schimbă, nu
  // se scoate. Blocăm salvarea în loc să ignorăm tăcut câmpul golit.
  const clearedPrice = useMemo(
    () =>
      !!data &&
      data.variants.some((v) => v.price != null && draft[v.id]?.price == null),
    [data, draft]
  )

  const set = (variantId: string, field: "price" | "sale_price", value: number | null) =>
    setDraft((d) => ({ ...d, [variantId]: { ...d[variantId], [field]: value } }))

  const save = async () => {
    if (!data || !updates.length) return

    setSaving(true)
    try {
      const fresh = await saveProductPrices(product.id, updates)
      setData(fresh)
      setDraft(toDraft(fresh))
      // Scrierea ocolește SDK-ul, deci react-query nu știe că prețul s-a schimbat.
      queryClient?.invalidateQueries({ queryKey: ["products"] })
      toast.success("Prețuri actualizate")
    } catch (err: any) {
      toast.error(err.message || "Eroare la salvare")
    } finally {
      setSaving(false)
    }
  }

  const onSale = !!data && data.variants.some((v) => v.sale_price != null)
  const missingSaleTag = onSale && !hasTag(product, "oferta")

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center gap-3 px-6 py-4">
        <CurrencyDollar />
        <Heading level="h2">Preț</Heading>
      </div>

      <div className="flex flex-col gap-6 px-6 py-4">
        {error && <Text className="text-ui-fg-error">{error}</Text>}

        {!data && !error && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {data?.variants.map((variant) => {
          const values = draft[variant.id] ?? { price: null, sale_price: null }
          const { price, sale_price: sale } = values
          const discount =
            price != null && sale != null && sale < price
              ? { percent: Math.round((1 - sale / price) * 100), saved: price - sale }
              : null

          return (
            <div key={variant.id} className="flex flex-col gap-2">
              {data.variants.length > 1 && (
                <Text size="small" weight="plus">
                  {variant.title}
                  {variant.sku && (
                    <span className="text-ui-fg-subtle font-normal"> · {variant.sku}</span>
                  )}
                </Text>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Label size="small" htmlFor={`price-${variant.id}`}>
                    Preț normal
                  </Label>
                  <CurrencyInput
                    id={`price-${variant.id}`}
                    symbol={symbolOf(data.currency_code)}
                    code={data.currency_code.toUpperCase()}
                    decimalsLimit={2}
                    decimalSeparator=","
                    groupSeparator="."
                    value={price ?? ""}
                    onValueChange={(_v, _n, values) =>
                      set(variant.id, "price", values?.float ?? null)
                    }
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label size="small" htmlFor={`sale-${variant.id}`}>
                    Preț promoțional
                  </Label>
                  <CurrencyInput
                    id={`sale-${variant.id}`}
                    symbol={symbolOf(data.currency_code)}
                    code={data.currency_code.toUpperCase()}
                    decimalsLimit={2}
                    decimalSeparator=","
                    groupSeparator="."
                    placeholder="fără promoție"
                    value={sale ?? ""}
                    onValueChange={(_v, _n, values) =>
                      set(variant.id, "sale_price", values?.float ?? null)
                    }
                  />
                </div>
              </div>

              {discount && (
                <Text size="small" className="text-ui-fg-subtle">
                  −{discount.percent}% · economie{" "}
                  {formatMoney(discount.saved, data.currency_code)}
                </Text>
              )}
              {price != null && sale != null && sale >= price && (
                <Text size="small" className="text-ui-fg-error">
                  Prețul promoțional trebuie să fie mai mic decât prețul normal.
                </Text>
              )}
            </div>
          )
        })}

        {data && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Text size="small" className="text-ui-fg-subtle">
                Golește câmpul de promoție ca să scoți produsul de la reducere.
              </Text>
              {missingSaleTag && (
                <Text size="small" className="text-ui-fg-subtle">
                  Prețul tăiat apare pe site, dar produsul nu e bifat „La ofertă", deci
                  nu intră pe <code>/oferte</code>.
                </Text>
              )}
              {clearedPrice && (
                <Text size="small" className="text-ui-fg-error">
                  Prețul normal nu poate rămâne gol.
                </Text>
              )}
            </div>
            <Button
              size="small"
              disabled={!updates.length || clearedPrice}
              isLoading={saving}
              onClick={save}
            >
              Salvează
            </Button>
          </div>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductPriceWidget
