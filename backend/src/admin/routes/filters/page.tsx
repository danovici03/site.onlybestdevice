import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowPath, Funnel, PencilSquare, Plus } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Table,
  Text,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import AttributeEditor from "../../components/filter-attribute-editor"
import {
  describeReport,
  filtersApi,
  postJson,
  type AdminFilterAttribute,
  type AutofillReport,
  type FilterMeta,
} from "../../lib/product-filters"

/**
 * Pagina „Filtre": filtrele din magazin, unde apar și cu ce valori.
 *
 * Ce se configurează aici ajunge direct în panoul de filtre al storefront-ului
 * (`/store/catalog` citește tabelele la fiecare cerere). Completarea automată
 * rulează singură la salvarea unui produs; butonul „Recalculează tot" e pentru
 * după o schimbare de surse sau de categorii, când produsele existente trebuie
 * reluate fără să fie salvate unul câte unul.
 */
const FiltersPage = () => {
  const [attributes, setAttributes] = useState<AdminFilterAttribute[]>([])
  const [meta, setMeta] = useState<FilterMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [recomputing, setRecomputing] = useState(false)
  /** `null` = editor închis; `"new"` = filtru nou; altfel id-ul editat. */
  const [editing, setEditing] = useState<string | "new" | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([
        filtersApi<{ attributes: AdminFilterAttribute[] }>("/attributes"),
        filtersApi<FilterMeta>("/meta"),
      ])
      setAttributes(a.attributes)
      setMeta(m)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categoryName = useMemo(
    () => new Map((meta?.categories ?? []).map((c) => [c.id, c.name])),
    [meta]
  )

  const recomputeAll = async () => {
    setRecomputing(true)
    try {
      const { report } = await postJson<{ report: AutofillReport }>("/recompute", {})
      toast.success("Completare automată terminată", { description: describeReport(report) })
      await load()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRecomputing(false)
    }
  }

  const editingAttribute =
    editing && editing !== "new" ? attributes.find((a) => a.id === editing) ?? null : null

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">Filtre</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Filtrele din magazin, pe categorii. Valorile se completează automat din titlu și din
            fișa tehnică; ce fixezi manual pe produs nu mai e suprascris.
          </Text>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="small" onClick={recomputeAll} isLoading={recomputing}>
            <ArrowPath />
            Recalculează tot
          </Button>
          <Button size="small" onClick={() => setEditing("new")} disabled={!meta}>
            <Plus />
            Filtru nou
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">Se încarcă…</Text>
        </div>
      ) : attributes.length === 0 ? (
        <div className="px-6 py-8">
          <Text className="text-ui-fg-subtle">
            Niciun filtru încă. Creează unul sau rulează scriptul
            <code className="mx-1">seed-product-filters.ts</code> pentru filtrele de pornire.
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Filtru</Table.HeaderCell>
              <Table.HeaderCell>Tip</Table.HeaderCell>
              <Table.HeaderCell>Apare în</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Produse</Table.HeaderCell>
              <Table.HeaderCell className="text-right">Valori</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {attributes.map((a) => (
              <Table.Row
                key={a.id}
                className="cursor-pointer"
                onClick={() => setEditing(a.id)}
              >
                <Table.Cell>
                  <div className="flex flex-col py-1">
                    <Text size="small" weight="plus" leading="compact">
                      {a.label}
                    </Text>
                    <Text size="xsmall" leading="compact" className="text-ui-fg-muted font-mono">
                      ?{a.key}=
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Badge size="2xsmall" color={a.type === "number" ? "blue" : "grey"}>
                    {a.type === "number" ? `Interval${a.unit ? ` (${a.unit})` : ""}` : a.display === "swatch" ? "Culori" : "Listă"}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="max-w-[360px]">
                  {a.is_global ? (
                    <Badge size="2xsmall" color="purple">
                      Global
                    </Badge>
                  ) : a.category_ids.length ? (
                    <Text size="small" className="truncate">
                      {a.category_ids.map((id) => categoryName.get(id) ?? "?").join(", ")}
                    </Text>
                  ) : (
                    // Un filtru fără categorii nu apare nicăieri în magazin —
                    // se vede aici ca să nu rămână uitat.
                    <Badge size="2xsmall" color="orange">
                      Nicăieri
                    </Badge>
                  )}
                </Table.Cell>
                <Table.Cell className="text-right">{a.product_count}</Table.Cell>
                <Table.Cell className="text-right">
                  {a.type === "number" ? "—" : a.values.length}
                </Table.Cell>
                <Table.Cell className="text-right">
                  <PencilSquare className="text-ui-fg-muted inline" />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      {editing && meta && (
        <AttributeEditor
          key={editing}
          attribute={editingAttribute}
          meta={meta}
          onClose={() => setEditing(null)}
          onChanged={load}
          onCreated={(id) => setEditing(id)}
        />
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Filtre",
  icon: Funnel,
})

export default FiltersPage
