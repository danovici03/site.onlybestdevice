import { MagnifyingGlass, Photo, Plus, XMarkMini } from "@medusajs/icons"
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
import { Fragment, useEffect, useMemo, useState } from "react"
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
  /** Filtrele puse pe rând din „+ Filtru" care încă n-au valoare aleasă. */
  const [added, setAdded] = useState<string[]>([])
  /** Filtrul abia adăugat — se deschide singur, ca să nu mai trebuiască un click. */
  const [justAdded, setJustAdded] = useState<string | null>(null)

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

  const attributes = data?.facets.attributes ?? []

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

  /* ---------------- Filtrele, ca butoane adăugate din meniul „Filtru" ---------------- */

  const categoryId = params.get("category_id")
  const status = params.get("status")
  const stock = params.get("stock")
  const hidden = params.get("hidden")
  const tag = params.get("tag")
  const price = params.get("price")
  const priceSel = price
    ? {
        min: price.split("-")[0] ? Number(price.split("-")[0]) : null,
        max: price.split("-")[1] ? Number(price.split("-")[1]) : null,
        none: false,
      }
    : null

  /** O singură valoare: bifa aleasă înlocuiește, bifa curentă golește. */
  const single = (key: string, current: string | null) => (v: string) =>
    setOne(key, v === current ? null : v)

  const defs: FilterDef[] = [
    {
      kind: "choice",
      id: "status",
      group: "general",
      label: "Stare",
      selected: status ? [status] : [],
      options: Object.entries(STATUS_LABEL)
        .filter(([k]) => data?.facets.status[k] || k === status)
        .map(([k, label]) => ({ value: k, label, count: data?.facets.status[k] ?? 0 })),
      onToggle: single("status", status),
      onClear: () => setOne("status", null),
    },
    {
      kind: "choice",
      id: "stock",
      group: "general",
      label: "Stoc",
      selected: stock ? [stock] : [],
      options: [
        { value: "in", label: "În stoc", count: data?.facets.stock.in ?? 0 },
        { value: "out", label: "Stoc epuizat", count: data?.facets.stock.out ?? 0 },
      ],
      onToggle: single("stock", stock),
      onClear: () => setOne("stock", null),
    },
    {
      kind: "range",
      id: "price",
      group: "general",
      label: "Preț",
      unit: "lei",
      range: data?.facets.price ?? null,
      selected: priceSel,
      onApply: (min, max) => setOne("price", min || max ? `${min}-${max}` : null),
      onClear: () => setOne("price", null),
    },
    {
      kind: "choice",
      id: "tag",
      group: "general",
      label: "Selecție",
      selected: tag ? [tag] : [],
      options: TAGS.map(([value, label]) => ({ value, label })),
      onToggle: single("tag", tag),
      onClear: () => setOne("tag", null),
    },
    {
      kind: "choice",
      id: "hidden",
      group: "general",
      label: "Vizibilitate",
      selected: hidden ? [hidden] : [],
      options: [
        { value: "false", label: "Vizibile în magazin" },
        { value: "true", label: "Ascunse din liste" },
      ],
      onToggle: single("hidden", hidden),
      onClear: () => setOne("hidden", null),
    },
    ...attributes
      .filter(
        (a) =>
          a.values.length > 0 ||
          a.range != null ||
          a.none > 0 ||
          a.selected.none ||
          a.selected.values.length > 0 ||
          a.selected.min != null ||
          a.selected.max != null
      )
      .map((attr): FilterDef => {
        const id = `attr:${attr.key}`
        const clear = () => update((p) => p.delete(PREFIX + attr.key))
        if (attr.type === "number") {
          const s = attr.selected
          return {
            kind: "range",
            id,
            group: "specs",
            label: attr.label,
            unit: attr.unit,
            range: attr.range,
            none: attr.none,
            selected: s.min != null || s.max != null || s.none ? s : null,
            onApply: (min, max, none) => setRange(attr, min, max, none),
            onClear: clear,
          }
        }
        return {
          kind: "choice",
          id,
          group: "specs",
          label: attr.label,
          multi: true,
          selected: [...(attr.selected.none ? [NONE] : []), ...attr.selected.values],
          options: [
            { value: NONE, label: "Fără valoare", count: attr.none, muted: true },
            ...attr.values.map((v) => ({ value: v.slug, label: v.value, count: v.count, hex: v.hex })),
          ],
          onToggle: (v) => toggleValue(attr, v),
          onClear: clear,
        }
      }),
  ]

  const isActive = (d: FilterDef) => (d.kind === "choice" ? d.selected.length > 0 : !!d.selected)
  // Pe rând: filtrele cu valoare și cele abia adăugate (încă fără valoare).
  const shown = defs.filter((d) => isActive(d) || added.includes(d.id))
  const addable = defs.filter((d) => !shown.includes(d))
  const anyActive = !!(categoryId || params.get("q") || defs.some(isActive))

  const addFilter = (id: string) => {
    setJustAdded(id)
    // După ce meniul „+ Filtru" s-a închis — altfel închiderea lui ar prinde
    // și meniul filtrului nou, deschis în același moment.
    window.setTimeout(() => setAdded((prev) => (prev.includes(id) ? prev : [...prev, id])), 0)
  }
  const removeFilter = (d: FilterDef) => {
    setAdded((prev) => prev.filter((x) => x !== d.id))
    if (isActive(d)) d.onClear()
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

      {/* Un singur rând: căutare, categorie, filtrele alese, „+ Filtru". */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <div className="w-full sm:w-64">
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
          width="w-56"
          onChange={(v) => {
            // Filtrele de atribut depind de categorie: la schimbare se golesc.
            setAdded((prev) => prev.filter((id) => !id.startsWith("attr:")))
            update((p) => {
              for (const k of [...p.keys()]) if (k.startsWith(PREFIX)) p.delete(k)
              v ? p.set("category_id", v) : p.delete("category_id")
            })
          }}
          options={categories.map((c) => ({
            value: c.id,
            label: `${"   ".repeat(c.depth)}${c.name} (${c.count})`,
          }))}
        />

        {shown.map((d) =>
          d.kind === "choice" ? (
            <ChoiceFilter
              key={d.id}
              def={d}
              defaultOpen={d.id === justAdded}
              onRemove={() => removeFilter(d)}
            />
          ) : (
            <RangeFilter
              key={d.id}
              def={d}
              defaultOpen={d.id === justAdded}
              onRemove={() => removeFilter(d)}
            />
          )
        )}

        {addable.length > 0 && (
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button variant="secondary" size="small">
                <Plus />
                Filtru
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              align="start"
              className="max-h-[420px] min-w-[200px] overflow-y-auto"
              // La închidere, meniul își readuce focusul pe „+ Filtru" — asta ar
              // închide imediat filtrul abia adăugat, care se deschide singur.
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {(["general", "specs"] as const).map((group) => {
                const items = addable.filter((d) => d.group === group)
                if (!items.length) return null
                return (
                  <DropdownMenu.Group key={group}>
                    {group === "specs" && addable.some((d) => d.group === "general") && (
                      <DropdownMenu.Separator />
                    )}
                    <DropdownMenu.Label>
                      {group === "general" ? "General" : categoryId ? "Filtrele categoriei" : "Specificații"}
                    </DropdownMenu.Label>
                    {items.map((d) => (
                      <DropdownMenu.Item key={d.id} onClick={() => addFilter(d.id)}>
                        {d.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Group>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu>
        )}

        {anyActive && (
          <Button
            variant="transparent"
            size="small"
            onClick={() => {
              setSearch("")
              setAdded([])
              setParams(new URLSearchParams(params.get("sort") ? { sort: params.get("sort")! } : {}))
            }}
          >
            Șterge filtrele
          </Button>
        )}

      </div>

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

type ChoiceDef = {
  kind: "choice"
  id: string
  group: "general" | "specs"
  label: string
  /** Mai multe valori deodată (atributele); altfel o bifă o înlocuiește pe cealaltă. */
  multi?: boolean
  options: { value: string; label: string; count?: number; hex?: string | null; muted?: boolean }[]
  selected: string[]
  onToggle: (value: string) => void
  onClear: () => void
}

type RangeDef = {
  kind: "range"
  id: string
  group: "general" | "specs"
  label: string
  unit: string | null
  range: { min: number; max: number } | null
  /** Numărul de produse fără valoare; absent = filtrul nu are opțiunea (prețul). */
  none?: number
  selected: { min: number | null; max: number | null; none: boolean } | null
  onApply: (min: string, max: string, none: boolean) => void
  onClear: () => void
}

type FilterDef = ChoiceDef | RangeDef

/**
 * Butonul unui filtru de pe rând: „Marcă: Apple, Samsung" + ×. Deschide
 * opțiunile la click; filtrul abia adăugat din „+ Filtru" se deschide singur.
 */
const FilterPill = ({
  label,
  summary,
  onRemove,
  children,
}: {
  label: string
  summary: string | null
  onRemove: () => void
  /** Trigger-ul meniului/popover-ului, primit ca funcție ca să-l putem îmbrăca. */
  children: (trigger: JSX.Element) => JSX.Element
}) => (
  <div className="bg-ui-button-neutral shadow-buttons-neutral txt-compact-small-plus flex h-7 items-center overflow-hidden rounded-md">
    {children(
      <button
        type="button"
        className="hover:bg-ui-button-neutral-hover flex h-full max-w-[260px] items-center gap-1 pl-2 pr-1.5 outline-none"
      >
        <span className={summary ? "text-ui-fg-subtle" : "text-ui-fg-base"}>{label}</span>
        {summary && <span className="text-ui-fg-base truncate">{summary}</span>}
      </button>
    )}
    <button
      type="button"
      aria-label={`Scoate filtrul ${label}`}
      onClick={onRemove}
      className="border-ui-border-base hover:bg-ui-button-neutral-hover text-ui-fg-muted flex h-full items-center border-l px-1"
    >
      <XMarkMini />
    </button>
  </div>
)

/** Filtru cu valori (stare, marcă, RAM, culoare…): meniu cu bife. */
const ChoiceFilter = ({
  def,
  defaultOpen,
  onRemove,
}: {
  def: ChoiceDef
  defaultOpen: boolean
  onRemove: () => void
}) => {
  const labels = def.selected.map(
    (v) => def.options.find((o) => o.value === v)?.label ?? v
  )
  const summary = labels.length
    ? labels.length > 2
      ? `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`
      : labels.join(", ")
    : null

  return (
    <FilterPill label={def.label} summary={summary} onRemove={onRemove}>
      {(trigger) => (
        <DropdownMenu defaultOpen={defaultOpen}>
          <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" className="max-h-[380px] min-w-[220px] overflow-y-auto">
            {def.options.map((o, i) => (
              <Fragment key={o.value}>
                <DropdownMenu.CheckboxItem
                  checked={def.selected.includes(o.value)}
                  // Selecția multiplă ține meniul deschis între bife.
                  onSelect={(e) => def.multi && e.preventDefault()}
                  onCheckedChange={() => def.onToggle(o.value)}
                  className="justify-between gap-4"
                >
                  <span className={clx("flex items-center gap-2", o.muted && "italic")}>
                    {o.hex && (
                      <span
                        className="border-ui-border-base inline-block h-3 w-3 rounded-full border"
                        style={{ background: o.hex }}
                      />
                    )}
                    {o.label}
                  </span>
                  {o.count != null && <span className="text-ui-fg-muted">{o.count}</span>}
                </DropdownMenu.CheckboxItem>
                {o.muted && i < def.options.length - 1 && <DropdownMenu.Separator />}
              </Fragment>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
    </FilterPill>
  )
}

/** Filtru numeric (preț, diagonală, baterie): interval de la–până la, plus „fără valoare". */
const RangeFilter = ({
  def,
  defaultOpen,
  onRemove,
}: {
  def: RangeDef
  defaultOpen: boolean
  onRemove: () => void
}) => {
  const { label, unit, range, none, selected, onApply } = def
  const [open, setOpen] = useState(defaultOpen)
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

  const parts: string[] = []
  if (selected && (selected.min != null || selected.max != null)) {
    parts.push(describeRange(selected.min, selected.max, unit))
  }
  if (selected?.none) parts.push("fără valoare")

  return (
    <FilterPill label={label} summary={parts.length ? parts.join(" sau ") : null} onRemove={onRemove}>
      {(trigger) => (
        <Popover open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>{trigger}</Popover.Trigger>
          <Popover.Content align="start" className="w-64 p-3">
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
                    autoFocus
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
                    id={`none-${def.id}`}
                    checked={withoutValue}
                    onCheckedChange={(c) => setWithoutValue(c === true)}
                  />
                  <Label size="small" htmlFor={`none-${def.id}`}>
                    Fără valoare ({none})
                  </Label>
                </div>
              )}
              <div className="flex justify-end">
                <Button type="submit" size="small">
                  Aplică
                </Button>
              </div>
            </form>
          </Popover.Content>
        </Popover>
      )}
    </FilterPill>
  )
}

export default ProductExplorer
