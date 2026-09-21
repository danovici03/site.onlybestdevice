import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { AdminProductCategory, DetailWidgetProps } from "@medusajs/types"
import { ArrowDownMini, ArrowUpMini, Funnel, XMarkMini } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Select,
  Text,
  toast,
} from "@medusajs/ui"
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { filtersApi, postJson } from "../lib/product-filters"

type BriefFilter = {
  id: string
  key: string
  label: string
  type: "select" | "number"
  unit: string | null
  values_count: number
}

type CategoryFilters = {
  own: BriefFilter[]
  inherited: BriefFilter[]
  global: BriefFilter[]
  available: BriefFilter[]
}

/**
 * Cardul „Filtre" de pe categorie: ce filtre vede clientul aici și în ce ordine.
 *
 * Doar filtrele proprii categoriei se pot muta sau scoate de aici. Cele globale
 * (marca) și cele moștenite de la categoria-părinte se schimbă din locul lor —
 * altfel o scoatere de aici ar avea efect și în categoriile-surori, fără ca
 * operatorul să vadă asta.
 *
 * Ordinea se salvează explicit, cu buton: săgețile sunt ieftine de apăsat de
 * mai multe ori, iar fiecare salvare golește cache-ul catalogului din magazin.
 */
const CategoryFiltersWidget = ({ data: category }: DetailWidgetProps<AdminProductCategory>) => {
  const [data, setData] = useState<CategoryFilters | null>(null)
  const [own, setOwn] = useState<BriefFilter[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await filtersApi<CategoryFilters>(`/categories/${category.id}`)
      setData(res)
      setOwn(res.own)
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [category.id])

  useEffect(() => {
    load()
  }, [load])

  const dirty = useMemo(
    () => !!data && own.map((f) => f.id).join() !== data.own.map((f) => f.id).join(),
    [own, data]
  )

  // Se pot adăuga filtrele care nu apar încă aici, plus cele scoase în sesiunea
  // curentă (au ieșit din `own`, dar nu sunt în `available` de la server).
  const addable = useMemo(() => {
    if (!data) return []
    const ownIds = new Set(own.map((f) => f.id))
    const removed = data.own.filter((f) => !ownIds.has(f.id))
    return [...data.available, ...removed]
      .filter((f) => !ownIds.has(f.id))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [data, own])

  const move = (i: number, dir: -1 | 1) =>
    setOwn((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const add = (id: string) => {
    const f = addable.find((a) => a.id === id)
    if (f) setOwn((prev) => [...prev, f])
  }

  const save = async () => {
    setSaving(true)
    try {
      await postJson(`/categories/${category.id}`, { attribute_ids: own.map((f) => f.id) })
      // Filtrele noi se completează pe produse la următoarea salvare a fiecăruia;
      // recalcularea explicită le aduce imediat (doar pentru filtrele adăugate).
      const added = own.filter((f) => !data?.own.some((o) => o.id === f.id)).map((f) => f.id)
      if (added.length) await postJson("/recompute", { attribute_ids: added })
      toast.success("Filtrele categoriei au fost salvate")
      await load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const typeHint = (f: BriefFilter) =>
    f.type === "number" ? `interval${f.unit ? ` · ${f.unit}` : ""}` : `${f.values_count} valori`

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <Funnel />
          <div>
            <Heading level="h2">Filtre în magazin</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Ordinea în care apar în panoul de filtre al categoriei.
            </Text>
          </div>
        </div>
        <Link to="/filters" className="txt-compact-small text-ui-fg-interactive hover:underline">
          Editează filtrele
        </Link>
      </div>

      {!data ? (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            Se încarcă…
          </Text>
        </div>
      ) : (
        <>
          {[...data.global, ...data.inherited].length > 0 && (
            <div className="flex flex-col gap-1 px-6 py-3">
              {data.global.map((f) => (
                <Row key={f.id} label={f.label} hint={typeHint(f)}>
                  <Badge size="2xsmall" color="purple">
                    Global
                  </Badge>
                </Row>
              ))}
              {data.inherited.map((f) => (
                <Row key={f.id} label={f.label} hint={typeHint(f)}>
                  <Badge size="2xsmall" color="grey">
                    Moștenit de la părinte
                  </Badge>
                </Row>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 px-6 py-3">
            {own.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                Niciun filtru propriu categoriei.
              </Text>
            ) : (
              own.map((f, i) => (
                <Row key={f.id} label={f.label} hint={typeHint(f)}>
                  <IconButton size="small" variant="transparent" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Mută sus">
                    <ArrowUpMini />
                  </IconButton>
                  <IconButton
                    size="small"
                    variant="transparent"
                    disabled={i === own.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Mută jos"
                  >
                    <ArrowDownMini />
                  </IconButton>
                  <IconButton
                    size="small"
                    variant="transparent"
                    onClick={() => setOwn((prev) => prev.filter((x) => x.id !== f.id))}
                    aria-label="Scoate din categorie"
                  >
                    <XMarkMini />
                  </IconButton>
                </Row>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3 px-6 py-4">
            {addable.length > 0 ? (
              // `value=""` ține selectul pe placeholder: alegerea adaugă, nu selectează.
              <Select size="small" value="" onValueChange={add}>
                <Select.Trigger className="w-[220px]">
                  <Select.Value placeholder="Adaugă filtru…" />
                </Select.Trigger>
                <Select.Content>
                  {addable.map((f) => (
                    <Select.Item key={f.id} value={f.id}>
                      {f.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            ) : (
              <span />
            )}
            <Button size="small" onClick={save} disabled={!dirty} isLoading={saving}>
              Salvează
            </Button>
          </div>
        </>
      )}
    </Container>
  )
}

const Row = ({ label, hint, children }: { label: string; hint: string; children: ReactNode }) => (
  <div className="flex items-center gap-2 py-1">
    <div className="min-w-0 flex-1">
      <Text size="small" weight="plus" leading="compact" className="truncate">
        {label}
      </Text>
      <Text size="xsmall" leading="compact" className="text-ui-fg-muted">
        {hint}
      </Text>
    </div>
    {children}
  </div>
)

export const config = defineWidgetConfig({
  zone: "product_category.details.after",
})

export default CategoryFiltersWidget
