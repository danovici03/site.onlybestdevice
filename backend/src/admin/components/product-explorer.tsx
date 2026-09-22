import { Funnel, MagnifyingGlass, Photo, XMarkMini } from "@medusajs/icons"
import {
  Badge,
  Button,
  Checkbox,
  Container,
  DropdownMenu,
  Heading,
  Input,
  Label,
  Popover,
  Select,
  Table,
  Text,
  clx,
  toast,
} from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { filtersApi, formatNumber, type FilterMeta } from "../lib/product-filters"
import ProductBulkActions from "./product-bulk-actions"

/**
 * Lista de produse din admin, cu filtrele din magazin. O randează widgetul
 * `product-list-explorer` pe pagina „Produse", în locul listei native.
 *
 * Meniul „Adaugă filtru" al listei native e fix în dashboard-ul Medusa (tip,
 * etichetă, canal, stare, date) și nu primește filtre noi. Aici sunt filtrele
 * modulului `product_filter` — cu o categorie aleasă, exact cele din panoul
 * magazinului; fără categorie, toate — plus ce interesează doar operatorul:
 * stare, stoc epuizat, produse ascunse și „fără valoare" la un filtru
 * (produsele pe care completarea automată nu le-a putut încadra).
 *
 * Filtrele stau în URL, deci revenirea din fișa produsului păstrează lista, iar
 * o selecție se poate trimite ca link. Parametrii sunt chiar cei ai rutei
 * `/admin/product-filters/explore`.
 */

const NONE = "__none"
const PREFIX = "f_"
const PAGE_SIZE = 50
/** Select-ul din @medusajs/ui nu acceptă valoarea "" — „oricare" are nevoie de o santinelă. */
const ANY = "any"

type ExploreAttribute = {
  key: string
  label: string
  type: "select" | "number"
  display: "chips" | "swatch"
  unit: string | null
  values: { value: string; slug: string; hex: string | null; count: number }[]
  range: { min: number; max: number } | null
  none: number
  selected: { values: string[]; none: boolean; min: number | null; max: number | null }
}

type ExploreProduct = {
  id: string
  title: string
  status: string
  price: number | null
  stock_qty: number | null
  in_stock: boolean
  thumbnail: string | null
  hidden: boolean
  variants: number
  categories: string | null
  brand: string | null
}

type ExploreResponse = {
  products: ExploreProduct[]
  count: number
  facets: {
    status: Record<string, number>
    stock: { in: number; out: number }
    price: { min: number; max: number } | null
    attributes: ExploreAttribute[]
  }
}

const STATUS_LABEL: Record<string, string> = {
  published: "Publicat",
  draft: "Ciornă",
  proposed: "Propus",
  rejected: "Respins",
}

const SORTS = [
  ["newest", "Cele mai noi"],
  ["oldest", "Cele mai vechi"],
  ["title", "Nume (A–Z)"],
  ["price_asc", "Preț crescător"],
  ["price_desc", "Preț descrescător"],
  ["stock_desc", "Stoc descrescător"],
  ["stock_asc", "Stoc crescător"],
] as const

const TAGS = [
  ["oferta", "La ofertă"],
  ["recomandat", "Recomandat"],
] as const

const formatPrice = (n: number | null) =>
  n == null ? "—" : `${n.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} lei`

/** „6-6.7" → „6 – 6,7 inch"; capetele lipsă devin „de la" / „până la". */
const describeRange = (min: number | null, max: number | null, unit: string | null) =>
  min != null && max != null
    ? `${formatNumber(min, null)} – ${formatNumber(max, unit)}`
    : min != null
      ? `≥ ${formatNumber(min, unit)}`
      : `≤ ${formatNumber(max!, unit)}`

/** Categoriile în ordinea arborelui, cu adâncimea pentru indentare. */
const categoryTree = (cats: FilterMeta["categories"]) => {
  const children = new Map<string | null, FilterMeta["categories"]>()
  for (const c of cats) {
    const list = children.get(c.parent_category_id) ?? []
    list.push(c)
    children.set(c.parent_category_id, list)
  }
  const out: { id: string; name: string; depth: number; count: number }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const c of children.get(parent) ?? []) {
      out.push({ id: c.id, name: c.name, depth, count: c.product_count })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

const ProductExplorer = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<ExploreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<FilterMeta | null>(null)
  const [search, setSearch] = useState(params.get("q") ?? "")
  /** Produsele bifate — pot fi și pe alte pagini ale listei. */
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectingAll, setSelectingAll] = useState(false)
  /** Crește după o acțiune în masă, ca lista să se reîncarce cu aceiași parametri. */
  const [refresh, setRefresh] = useState(0)

  const page = Math.max(1, Number(params.get("page")) || 1)
  const queryString = params.toString()
  const filterString = useMemo(() => {
    const p = new URLSearchParams(queryString)
    p.delete("page")
    p.delete("sort")
    return p.toString()
  }, [queryString])

  // Bifele țin de setul filtrat: cu alte filtre, o selecție veche ar lovi
  // produse care nici nu se mai văd în listă. Paginarea și sortarea le păstrează.
  useEffect(() => {
    setSelected(new Set())
  }, [filterString])

  /** Schimbă un parametru și întoarce lista la prima pagină. */
  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params)
    mutate(next)
    next.delete("page")
    setParams(next)
  }
  const setOne = (key: string, value: string | null) =>
    update((p) => (value ? p.set(key, value) : p.delete(key)))

  useEffect(() => {
    filtersApi<FilterMeta>("/meta")
      .then(setMeta)
      .catch((err) => toast.error(err.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const qs = new URLSearchParams(queryString)
    qs.set("limit", String(PAGE_SIZE))
    filtersApi<ExploreResponse>(`/explore?${qs}`)
      .then((res) => !cancelled && setData(res))
      .catch((err) => !cancelled && toast.error(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [queryString, refresh])

  // Căutarea ajunge în URL după o scurtă pauză, nu la fiecare tastă.
  useEffect(() => {
    if (search === (params.get("q") ?? "")) return
    const t = setTimeout(() => setOne("q", search.trim() || null), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const categories = useMemo(() => categoryTree(meta?.categories ?? []), [meta])
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id

  const attributes = data?.facets.attributes ?? []
  const visibleAttributes = attributes.filter(
    (a) =>
      a.values.length > 0 ||
      a.range != null ||
      a.none > 0 ||
      a.selected.none ||
      a.selected.values.length > 0 ||
      a.selected.min != null ||
      a.selected.max != null
  )

  const toggleValue = (attr: ExploreAttribute, slug: string) =>
    update((p) => {
      const key = PREFIX + attr.key
      const current = p.getAll(key)
      p.delete(key)
      const next = current.includes(slug) ? current.filter((v) => v !== slug) : [...current, slug]
      next.forEach((v) => p.append(key, v))
    })

  const setRange = (attr: ExploreAttribute, min: string, max: string, none: boolean) =>
    update((p) => {
      const key = PREFIX + attr.key
      p.delete(key)
      if (min || max) p.append(key, `${min}-${max}`)
      if (none) p.append(key, NONE)
    })

  /* ---------------- Filtrele active, ca etichete de scos ---------------- */

  const chips: { label: string; onRemove: () => void }[] = []
  const categoryId = params.get("category_id")
  if (categoryId) {
    // Filtrele de categorie nu mai au sens fără categorie — pleacă odată cu ea.
    chips.push({
      label: `Categorie: ${categoryName(categoryId)}`,
      onRemove: () => setOne("category_id", null),
    })
  }
  const status = params.get("status")
  if (status) chips.push({ label: `Stare: ${STATUS_LABEL[status] ?? status}`, onRemove: () => setOne("status", null) })
  const stock = params.get("stock")
  if (stock) chips.push({ label: stock === "in" ? "În stoc" : "Stoc epuizat", onRemove: () => setOne("stock", null) })
  const hidden = params.get("hidden")
  if (hidden) chips.push({ label: hidden === "true" ? "Ascunse" : "Vizibile", onRemove: () => setOne("hidden", null) })
  const tag = params.get("tag")
  if (tag) chips.push({ label: TAGS.find(([v]) => v === tag)?.[1] ?? `Etichetă: ${tag}`, onRemove: () => setOne("tag", null) })
  const price = params.get("price")
  if (price) {
    const [a, b] = price.split("-").map((s) => (s ? Number(s) : null))
    chips.push({ label: `Preț: ${describeRange(a, b, "lei")}`, onRemove: () => setOne("price", null) })
  }
  for (const attr of attributes) {
    const { selected } = attr
    for (const slug of selected.values) {
      const value = attr.values.find((v) => v.slug === slug)?.value ?? slug
      chips.push({ label: `${attr.label}: ${value}`, onRemove: () => toggleValue(attr, slug) })
    }
    if (attr.type === "number" && (selected.min != null || selected.max != null)) {
      chips.push({
        label: `${attr.label}: ${describeRange(selected.min, selected.max, attr.unit)}`,
        onRemove: () => setRange(attr, "", "", selected.none),
      })
    }
    if (selected.none) {
      chips.push({
        label: `${attr.label}: fără valoare`,
        onRemove: () =>
          attr.type === "number"
            ? setRange(attr, selected.min?.toString() ?? "", selected.max?.toString() ?? "", false)
            : toggleValue(attr, NONE),
      })
    }
  }

  const count = data?.count ?? 0
  const pageIds = (data?.products ?? []).map((p) => p.id)
  const pageSelected = pageIds.filter((id) => selected.has(id)).length

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (pageSelected === pageIds.length) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  /** Toate produsele filtrate, de pe toate paginile — id-urile vin de la server. */
  const selectAllFiltered = async () => {
    setSelectingAll(true)
    try {
      const qs = new URLSearchParams(queryString)
      qs.delete("page")
      qs.set("ids_only", "true")
      const { ids } = await filtersApi<{ ids: string[] }>(`/explore?${qs}`)
      setSelected(new Set(ids))
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSelectingAll(false)
    }
  }
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))
  const goToPage = (n: number) => {
    const next = new URLSearchParams(params)
    if (n <= 1) next.delete("page")
    else next.set("page", String(n))
    setParams(next)
  }

  return (
    <Container className="divide-y p-0">
      {/* Antetul listei native, cu aceleași acțiuni (rutele-copil ale /products). */}
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h1">Produse</Heading>
        <div className="flex items-center gap-x-2">
          <Button size="small" variant="secondary" asChild>
            <Link to="/products/export">Export</Link>
          </Button>
          <Button size="small" variant="secondary" asChild>
            <Link to="/products/import">Import</Link>
          </Button>
          <Button size="small" variant="secondary" asChild>
            <Link to="/products/create">Creează</Link>
          </Button>
        </div>
      </div>

      {/* Criteriile generale */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <div className="relative w-full sm:w-72">
          <Input
            type="search"
            size="small"
            placeholder="Caută după nume, SKU, handle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <FilterSelect
          value={categoryId}
          placeholder="Categorie"
          width="w-60"
          onChange={(v) =>
            // Filtrele de atribut depind de categorie: la schimbare se golesc.
            update((p) => {
              for (const k of [...p.keys()]) if (k.startsWith(PREFIX)) p.delete(k)
              v ? p.set("category_id", v) : p.delete("category_id")
            })
          }
          options={categories.map((c) => ({
            value: c.id,
            label: `${"   ".repeat(c.depth)}${c.name} (${c.count})`,
          }))}
        />
        <FilterSelect
          value={status}
          placeholder="Stare"
          onChange={(v) => setOne("status", v)}
          options={Object.entries(STATUS_LABEL)
            .filter(([k]) => data?.facets.status[k] || k === status)
            .map(([k, label]) => ({ value: k, label: `${label} (${data?.facets.status[k] ?? 0})` }))}
        />
        <FilterSelect
          value={stock}
          placeholder="Stoc"
          onChange={(v) => setOne("stock", v)}
          options={[
            { value: "in", label: `În stoc (${data?.facets.stock.in ?? 0})` },
            { value: "out", label: `Stoc epuizat (${data?.facets.stock.out ?? 0})` },
          ]}
        />
        <FilterSelect
          value={tag}
          placeholder="Selecție"
          onChange={(v) => setOne("tag", v)}
          options={TAGS.map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          value={hidden}
          placeholder="Vizibilitate"
          onChange={(v) => setOne("hidden", v)}
          options={[
            { value: "false", label: "Vizibile în magazin" },
            { value: "true", label: "Ascunse" },
          ]}
        />
        <RangeButton
          label="Preț"
          unit="lei"
          range={data?.facets.price ?? null}
          selected={
            price
              ? {
                  min: price.split("-")[0] ? Number(price.split("-")[0]) : null,
                  max: price.split("-")[1] ? Number(price.split("-")[1]) : null,
                  none: false,
                }
              : null
          }
          onApply={(min, max) => setOne("price", min || max ? `${min}-${max}` : null)}
        />

        <div className="ml-auto">
          <FilterSelect
            value={params.get("sort") ?? "newest"}
            placeholder="Sortare"
            clearable={false}
            onChange={(v) => setOne("sort", v === "newest" ? null : v)}
            options={SORTS.map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>

      {/* Filtrele de atribut, din modulul product_filter */}
      {visibleAttributes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-3">
          <Funnel className="text-ui-fg-muted" />
          {visibleAttributes.map((attr) =>
            attr.type === "number" ? (
              <RangeButton
                key={attr.key}
                label={attr.label}
                unit={attr.unit}
                range={attr.range}
                none={attr.none}
                selected={
                  attr.selected.min != null || attr.selected.max != null || attr.selected.none
                    ? attr.selected
                    : null
                }
                onApply={(min, max, none) => setRange(attr, min, max, none)}
              />
            ) : (
              <SelectAttributeButton
                key={attr.key}
                attr={attr}
                onToggle={(slug) => toggleValue(attr, slug)}
              />
            )
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-3">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.onRemove}
              className="bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover border-ui-border-base txt-compact-small-plus flex items-center gap-1 rounded-md border py-0.5 pl-2 pr-1"
            >
              {c.label}
              <XMarkMini className="text-ui-fg-muted" />
            </button>
          ))}
          <Button
            variant="transparent"
            size="small"
            onClick={() => {
              setSearch("")
              setParams(new URLSearchParams(params.get("sort") ? { sort: params.get("sort")! } : {}))
            }}
          >
            Șterge filtrele
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          {loading && !data ? "Se încarcă…" : `${count} ${count === 1 ? "produs" : "produse"}`}
          {selected.size > 0 && ` · ${selected.size} selectate`}
        </Text>
        {count > 0 && selected.size < count && (
          <Button variant="secondary" size="small" onClick={selectAllFiltered} isLoading={selectingAll}>
            Selectează toate cele {count} filtrate
          </Button>
        )}
        {selected.size > 0 && (
          <Button variant="transparent" size="small" onClick={() => setSelected(new Set())}>
            Deselectează
          </Button>
        )}
      </div>

      {data && data.products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12">
          <MagnifyingGlass className="text-ui-fg-muted" />
          <Text className="text-ui-fg-subtle">Niciun produs nu corespunde filtrelor.</Text>
        </div>
      ) : (
        <div className={clx("overflow-x-auto", loading && "opacity-60 transition-opacity")}>
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell className="w-10">
                  <Checkbox
                    aria-label="Selectează pagina"
                    checked={
                      pageSelected === 0
                        ? false
                        : pageSelected === pageIds.length
                          ? true
                          : "indeterminate"
                    }
                    onCheckedChange={togglePage}
                  />
                </Table.HeaderCell>
                <Table.HeaderCell>Produs</Table.HeaderCell>
                <Table.HeaderCell>Marcă</Table.HeaderCell>
                <Table.HeaderCell>Stare</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Preț</Table.HeaderCell>
                <Table.HeaderCell className="text-right">Stoc</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(data?.products ?? []).map((p) => (
                <Table.Row
                  key={p.id}
                  className={clx("cursor-pointer", selected.has(p.id) && "bg-ui-bg-highlight")}
                  onClick={() => navigate(`/products/${p.id}`)}
                >
                  <Table.Cell className="w-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Selectează ${p.title}`}
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                    />
                  </Table.Cell>
                  <Table.Cell className="max-w-[520px]">
                    <div className="flex items-center gap-3 py-1">
                      <div className="bg-ui-bg-component border-ui-border-base flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <Photo className="text-ui-fg-muted" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Text size="small" weight="plus" leading="compact" className="truncate">
                          {p.title}
                        </Text>
                        <Text size="xsmall" leading="compact" className="text-ui-fg-subtle truncate">
                          {p.categories ?? "Fără categorie"}
                          {p.variants > 1 ? ` · ${p.variants} variante` : ""}
                        </Text>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{p.brand ?? <span className="text-ui-fg-muted">—</span>}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      <Badge size="2xsmall" color={p.status === "published" ? "green" : "grey"}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </Badge>
                      {p.hidden && (
                        <Badge size="2xsmall" color="orange">
                          ascuns
                        </Badge>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-right">{formatPrice(p.price)}</Table.Cell>
                  <Table.Cell className="text-right">
                    {p.stock_qty != null ? (
                      <span className={p.in_stock ? "" : "text-ui-fg-error"}>{p.stock_qty}</span>
                    ) : (
                      <span className="text-ui-fg-muted">{p.in_stock ? "negestionat" : "—"}</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          <Table.Pagination
            count={count}
            pageSize={PAGE_SIZE}
            pageIndex={page - 1}
            pageCount={pageCount}
            canPreviousPage={page > 1}
            canNextPage={page < pageCount}
            previousPage={() => goToPage(page - 1)}
            nextPage={() => goToPage(page + 1)}
            translations={{ of: "din", results: "produse", pages: "pagini", prev: "Înapoi", next: "Înainte" }}
          />
        </div>
      )}
      <ProductBulkActions
        ids={[...selected]}
        categories={categories}
        onClear={() => setSelected(new Set())}
        onDone={() => {
          setSelected(new Set())
          setRefresh((n) => n + 1)
        }}
      />
    </Container>
  )
}

/** Select cu opțiunea „oricare" (golește parametrul). */
const FilterSelect = ({
  value,
  placeholder,
  options,
  onChange,
  width = "w-44",
  clearable = true,
}: {
  value: string | null
  placeholder: string
  options: { value: string; label: string }[]
  onChange: (value: string | null) => void
  width?: string
  clearable?: boolean
}) => (
  <div className={width}>
    <Select
      size="small"
      value={value ?? ANY}
      onValueChange={(v) => onChange(v === ANY ? null : v)}
    >
      <Select.Trigger>
        <Select.Value placeholder={placeholder} />
      </Select.Trigger>
      <Select.Content>
        {clearable && <Select.Item value={ANY}>{placeholder}: oricare</Select.Item>}
        {options.map((o) => (
          <Select.Item key={o.value} value={o.value}>
            {o.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  </div>
)

/** Filtru cu valori (marcă, RAM, culoare…): meniu cu bife, rămâne deschis între bife. */
const SelectAttributeButton = ({
  attr,
  onToggle,
}: {
  attr: ExploreAttribute
  onToggle: (slug: string) => void
}) => {
  const active = attr.selected.values.length + (attr.selected.none ? 1 : 0)
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="small" className={clx(active && "border-ui-fg-interactive")}>
          {attr.label}
          {active > 0 && (
            <Badge size="2xsmall" color="blue">
              {active}
            </Badge>
          )}
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="max-h-[380px] min-w-[220px] overflow-y-auto">
        <DropdownMenu.CheckboxItem
          checked={attr.selected.none}
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => onToggle(NONE)}
          className="justify-between gap-4"
        >
          <span className="italic">Fără valoare</span>
          <span className="text-ui-fg-muted">{attr.none}</span>
        </DropdownMenu.CheckboxItem>
        {attr.values.length > 0 && <DropdownMenu.Separator />}
        {attr.values.map((v) => (
          <DropdownMenu.CheckboxItem
            key={v.slug}
            checked={attr.selected.values.includes(v.slug)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={() => onToggle(v.slug)}
            className="justify-between gap-4"
          >
            <span className="flex items-center gap-2">
              {v.hex && (
                <span
                  className="border-ui-border-base inline-block h-3 w-3 rounded-full border"
                  style={{ background: v.hex }}
                />
              )}
              {v.value}
            </span>
            <span className="text-ui-fg-muted">{v.count}</span>
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}

/** Filtru numeric (preț, diagonală, baterie): interval de la–până la, plus „fără valoare". */
const RangeButton = ({
  label,
  unit,
  range,
  none,
  selected,
  onApply,
}: {
  label: string
  unit: string | null
  range: { min: number; max: number } | null
  /** Numărul de produse fără valoare; absent = filtrul nu are opțiunea (prețul). */
  none?: number
  selected: { min: number | null; max: number | null; none: boolean } | null
  onApply: (min: string, max: string, none: boolean) => void
}) => {
  const [open, setOpen] = useState(false)
  const [min, setMin] = useState("")
  const [max, setMax] = useState("")
  const [withoutValue, setWithoutValue] = useState(false)

  useEffect(() => {
    if (!open) return
    setMin(selected?.min?.toString() ?? "")
    setMax(selected?.max?.toString() ?? "")
    setWithoutValue(!!selected?.none)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const apply = () => {
    onApply(min.trim(), max.trim(), withoutValue)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" size="small" className={clx(selected && "border-ui-fg-interactive")}>
          {label}
          {selected && (
            <Badge size="2xsmall" color="blue">
              1
            </Badge>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Content className="flex w-64 flex-col gap-3 p-3">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            apply()
          }}
        >
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label size="xsmall">De la</Label>
              <Input
                size="small"
                inputMode="decimal"
                placeholder={range ? String(range.min) : ""}
                value={min}
                onChange={(e) => setMin(e.target.value.replace(",", "."))}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Label size="xsmall">Până la</Label>
              <Input
                size="small"
                inputMode="decimal"
                placeholder={range ? String(range.max) : ""}
                value={max}
                onChange={(e) => setMax(e.target.value.replace(",", "."))}
              />
            </div>
          </div>
          {range && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              În listă: {describeRange(range.min, range.max, unit)}
            </Text>
          )}
          {none != null && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`none-${label}`}
                checked={withoutValue}
                onCheckedChange={(c) => setWithoutValue(c === true)}
              />
              <Label size="small" htmlFor={`none-${label}`}>
                Fără valoare ({none})
              </Label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => {
                onApply("", "", false)
                setOpen(false)
              }}
            >
              Golește
            </Button>
            <Button type="submit" size="small">
              Aplică
            </Button>
          </div>
        </form>
      </Popover.Content>
    </Popover>
  )
}

export default ProductExplorer
