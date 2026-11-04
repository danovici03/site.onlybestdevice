import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowUturnLeft } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"

import {
  api,
  formatDateTime,
  itemsSummary,
  ReturnRequestDrawer,
  STATUS_LABEL,
  StatusBadge,
  type ReturnRequest,
  type ReturnRequestStatus,
} from "../../components/return-requests"

type Filter = "all" | ReturnRequestStatus

const FILTERS: Filter[] = ["requested", "received", "refunded", "denied", "all"]
const PAGE = 50

const ReturnRequestsPage = () => {
  const [rows, setRows] = useState<ReturnRequest[]>([])
  const [count, setCount] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<Filter>("requested")
  const [search, setSearch] = useState("")
  const [term, setTerm] = useState("")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ReturnRequest | null>(null)

  // Căutarea pornește după ce te oprești din scris.
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => setOffset(0), [filter, term])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) })
      if (filter !== "all") params.set("status", filter)
      if (term) params.set("q", term)
      const data = await api<{
        return_requests: ReturnRequest[]
        count: number
        counts: Record<string, number>
      }>(`/admin/return-requests?${params}`)
      setRows(data.return_requests)
      setCount(data.count)
      setCounts(data.counts ?? {})
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter, term, offset])

  useEffect(() => {
    load()
  }, [load])

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Heading>Cereri retur</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Toate cererile trimise de pe site — din contul clientului și din
              formularul pentru vizitatori.
            </Text>
          </div>
          <Input
            type="search"
            size="small"
            className="md:w-72"
            placeholder="Nr. comandă, email sau nume"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="small"
              variant={filter === f ? "primary" : "secondary"}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Toate" : STATUS_LABEL[f]}
              <span className="opacity-70">{f === "all" ? total : counts[f] ?? 0}</span>
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-12 text-center md:px-6">
          <Text>Se încarcă…</Text>
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-12 text-center md:px-6">
          <Text>Nicio cerere de retur pentru acest filtru.</Text>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Data</Table.HeaderCell>
                  <Table.HeaderCell>Comanda</Table.HeaderCell>
                  <Table.HeaderCell>Client</Table.HeaderCell>
                  <Table.HeaderCell>Produse</Table.HeaderCell>
                  <Table.HeaderCell>Motiv</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => (
                  <Table.Row
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <Table.Cell className="whitespace-nowrap">
                      {formatDateTime(r.requested_at)}
                    </Table.Cell>
                    <Table.Cell>
                      <Link
                        to={`/orders/${r.order_id}`}
                        className="text-ui-fg-interactive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        #{r.display_id ?? "—"}
                      </Link>
                    </Table.Cell>
                    <Table.Cell className="max-w-[220px]">
                      <div className="flex flex-col">
                        <span className="truncate">{r.customer_name || r.email}</span>
                        <span className="text-ui-fg-subtle truncate text-xs">
                          {r.email}
                          {r.source === "guest" ? " · fără cont" : ""}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="max-w-xs">
                      <span className="line-clamp-2">{itemsSummary(r.items)}</span>
                    </Table.Cell>
                    <Table.Cell className="max-w-[200px]">
                      <span className="text-ui-fg-subtle line-clamp-2 text-sm">
                        {Array.from(new Set(r.items.map((i) => i.reason).filter(Boolean))).join(", ") || "—"}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <StatusBadge status={r.status} />
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="divide-y md:hidden">
            {rows.map((r) => (
              <button
                key={r.id}
                type="button"
                className="flex w-full flex-col gap-1 px-4 py-4 text-left"
                onClick={() => setSelected(r)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Comanda #{r.display_id ?? "—"}</span>
                  <StatusBadge status={r.status} />
                </div>
                <span className="text-sm">{r.customer_name || r.email}</span>
                <span className="text-ui-fg-subtle line-clamp-2 text-xs">
                  {itemsSummary(r.items)}
                </span>
                <span className="text-ui-fg-subtle text-xs">
                  {formatDateTime(r.requested_at)}
                  {r.source === "guest" && (
                    <Badge size="2xsmall" color="grey" className="ml-2">
                      fără cont
                    </Badge>
                  )}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <Text size="small" className="text-ui-fg-subtle">
          {count} {count === 1 ? "cerere" : "cereri"}
        </Text>
        {count > PAGE && (
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              Înapoi
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={offset + PAGE >= count}
              onClick={() => setOffset(offset + PAGE)}
            >
              Înainte
            </Button>
          </div>
        )}
      </div>

      <ReturnRequestDrawer
        request={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null)
          load()
        }}
      />
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Cereri retur",
  icon: ArrowUturnLeft,
})

export default ReturnRequestsPage
