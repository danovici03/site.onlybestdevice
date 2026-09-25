import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProduct, DetailWidgetProps } from "@medusajs/types"
import { Funnel } from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { ReactNode, useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { filtersApi, formatNumber, postJson, type FilterType } from "../lib/product-filters"

type ProductFilter = {
  id: string
  key: string
  label: string
  type: FilterType
  display: "chips" | "swatch"
  unit: string | null
  is_multi: boolean
  is_global: boolean
  source: "auto" | "manual" | null
  value_ids: string[]
  value_number: number | null
  values: { id: string; value: string; hex: string | null }[]
}

/** „Fără valoare" în selectul simplu — Radix Select nu acceptă `""`. */
const NONE = "__none"

/**
 * Cardul „Filtre" de pe produs: ce valori are produsul în filtrele din magazin.
 *
 * Aproape totul vine din completarea automată (titlu + fișa tehnică), deci
 * cardul e în primul rând de verificare: un rând fără valoare înseamnă că
 * produsul nu apare când clientul bifează filtrul respectiv. Corecția manuală
 * se face din drawer și rămâne fixată — completarea n-o mai suprascrie până nu
 * apeși „Automat".
 *
 * Rânduri compacte, câte unul per filtru: la telefoane sunt ~13 filtre, iar un
 * formular complet deschis ar împinge restul paginii produsului mult în jos.
 */
const ProductFiltersWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const [filters, setFilters] = useState<ProductFilter[] | null>(null)
  const [hasCategories, setHasCategories] = useState(true)
  const [editing, setEditing] = useState<ProductFilter | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await filtersApi<{ attributes: ProductFilter[]; has_categories: boolean }>(
        `/products/${product.id}`
      )
      setFilters(res.attributes)
      setHasCategories(res.has_categories)
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [product.id])

  useEffect(() => {
    load()
  }, [load])

  const empty = filters?.filter((f) => !f.source).length ?? 0

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <Funnel />
          <Heading level="h2">Filtre în magazin</Heading>
        </div>
        <Link to="/filters" className="txt-compact-small text-ui-fg-interactive hover:underline">
          Configurează filtrele
        </Link>
      </div>

      {filters == null ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Se încarcă…
          </Text>
        </div>
      ) : !hasCategories ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Produsul nu e în nicio categorie. Filtrele vin din categorie — pune-l într-una și
            valorile se completează automat la salvare.
          </Text>
        </div>
      ) : filters.length === 0 ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Categoriile produsului n-au filtre configurate.
          </Text>
        </div>
      ) : (
        <>
          {empty > 0 && (
            <div className="px-6 py-3">
              <Text size="xsmall" className="text-ui-fg-subtle">
                {empty === 1 ? "Un filtru n-are" : `${empty} filtre n-au`} valoare: produsul nu apare când
                clientul le bifează.
              </Text>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setEditing(f)}
                className="hover:bg-ui-bg-base-hover border-ui-border-base flex items-center justify-between gap-3 border-b px-6 py-2.5 text-left sm:odd:border-r"
              >
                <div className="min-w-0">
                  <Text size="xsmall" leading="compact" className="text-ui-fg-subtle">
                    {f.label}
                  </Text>
                  <Text size="small" leading="compact" weight="plus" className="truncate">
                    {describe(f) ?? <span className="text-ui-fg-muted font-normal">—</span>}
                  </Text>
                </div>
                {f.source === "manual" ? (
                  <Badge size="2xsmall" color="blue">
                    manual
                  </Badge>
                ) : f.source === "auto" ? (
                  <Badge size="2xsmall" color="grey">
                    auto
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}

      {editing && (
        <FilterDrawer
          productId={product.id}
          filter={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </Container>
  )
}

/** Valoarea afișată în rând; `null` = produsul n-are valoare pe filtrul ăsta. */
const describe = (f: ProductFilter): ReactNode | null => {
  if (f.type === "number") {
    return f.value_number == null ? null : formatNumber(f.value_number, f.unit)
  }
  const chosen = f.values.filter((v) => f.value_ids.includes(v.id))
  if (!chosen.length) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      {f.display === "swatch" &&
        chosen.map((v) => (
          <span
            key={v.id}
            className="inline-block h-3 w-3 rounded-full ring-1 ring-inset ring-black/10"
            style={{ backgroundColor: v.hex ?? "#e5e7eb" }}
          />
        ))}
      {chosen.map((v) => v.value).join(", ")}
    </span>
  )
}

const FilterDrawer = ({
  productId,
  filter,
  onClose,
  onSaved,
}: {
  productId: string
  filter: ProductFilter
  onClose: () => void
  onSaved: () => Promise<void>
}) => {
  const [valueIds, setValueIds] = useState<string[]>(filter.value_ids)
  const [number, setNumber] = useState(filter.value_number == null ? "" : String(filter.value_number))
  const [saving, setSaving] = useState(false)

  const submit = async (body: Record<string, unknown>, message: string) => {
    setSaving(true)
    try {
      await postJson(`/products/${productId}`, { attribute_id: filter.id, ...body })
      toast.success(message)
      await onSaved()
    } catch (err: any) {
      toast.error(err.message)
      setSaving(false)
    }
  }

  const save = () => {
    if (filter.type === "number") {
      const n = number.trim() === "" ? null : Number(number.replace(",", "."))
      if (n != null && !Number.isFinite(n)) return toast.error("Valoarea trebuie să fie un număr.")
      return submit({ value_number: n }, "Valoare fixată manual")
    }
    return submit({ value_ids: valueIds }, "Valoare fixată manual")
  }

  const toggle = (id: string, on: boolean) =>
    setValueIds((prev) => (on ? [...prev, id] : prev.filter((v) => v !== id)))

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>{filter.label}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4 overflow-auto">
          <Text size="small" className="text-ui-fg-subtle">
            {filter.source === "manual"
              ? "Valoarea e fixată manual — completarea automată n-o atinge. „Automat” o recalculează din titlu și fișă."
              : "Valoarea vine din completarea automată. Dacă o schimbi aici, rămâne fixată manual."}
          </Text>

          {filter.type === "number" ? (
            <div className="flex flex-col gap-1.5">
              <Label size="small" weight="plus">
                Valoare{filter.unit ? ` (${filter.unit})` : ""}
              </Label>
              <Input
                type="number"
                step="any"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="Gol = produsul n-are valoarea asta"
              />
            </div>
          ) : filter.is_multi ? (
            <div className="flex flex-col gap-1">
              {filter.values.map((v) => (
                <label key={v.id} className="hover:bg-ui-bg-base-hover flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5">
                  <Checkbox checked={valueIds.includes(v.id)} onCheckedChange={(c) => toggle(v.id, c === true)} />
                  {filter.display === "swatch" && <Dot hex={v.hex} />}
                  <Text size="small">{v.value}</Text>
                </label>
              ))}
            </div>
          ) : (
            <Select value={valueIds[0] ?? NONE} onValueChange={(v) => setValueIds(v === NONE ? [] : [v])}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={NONE}>Fără valoare</Select.Item>
                {filter.values.map((v) => (
                  <Select.Item key={v.id} value={v.id}>
                    {v.value}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          )}

          {filter.type === "select" && filter.values.length === 0 && (
            <Text size="small" className="text-ui-fg-subtle">
              Filtrul n-are încă valori. Adaugă-le din pagina Filtre.
            </Text>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            variant="secondary"
            size="small"
            disabled={saving || filter.source !== "manual"}
            onClick={() => submit({ reset: true }, "Valoarea se completează din nou automat")}
          >
            Automat
          </Button>
          <Button size="small" onClick={save} isLoading={saving}>
            Salvează
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

const Dot = ({ hex }: { hex: string | null }) => (
  <span
    className="inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
    style={{ backgroundColor: hex ?? "#e5e7eb" }}
  />
)

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default ProductFiltersWidget
