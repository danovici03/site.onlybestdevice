import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Star, CheckCircle, XCircle, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Label,
  Select,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Review = {
  id: string
  product_id: string
  variant_id: string | null
  customer_id: string | null
  customer_name: string
  customer_email: string | null
  rating: number
  title: string | null
  body: string
  status: "pending" | "approved" | "rejected"
  is_verified_purchase: boolean
  admin_response: string | null
  created_at: string
  product?: {
    id: string
    title: string
    handle?: string
    thumbnail?: string | null
  } | null
}

type StatusFilter = "all" | "pending" | "approved" | "rejected"

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message || `Cererea a eșuat: ${res.status}`)
  }
  return res.json()
}

const statusColor = (s: Review["status"]) =>
  s === "approved" ? "green" : s === "rejected" ? "red" : "orange"

const statusLabel = (s: Review["status"]) =>
  s === "approved" ? "aprobată" : s === "rejected" ? "respinsă" : "în așteptare"

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5 text-ui-fg-base">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={
          i < rating ? "text-ui-tag-orange-text" : "text-ui-fg-disabled"
        }
      />
    ))}
  </div>
)

const ReviewsPage = () => {
  const [reviews, setReviews] = useState<Review[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusFilter>("pending")
  const [selected, setSelected] = useState<Review | null>(null)
  const [response, setResponse] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = status === "all" ? "" : `?status=${status}`
      const data = await api<{ reviews: Review[]; count: number }>(
        `/admin/reviews${qs}`,
      )
      setReviews(data.reviews)
      setCount(data.count)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (
    id: string,
    newStatus: Review["status"],
  ) => {
    try {
      await api(`/admin/reviews/${id}`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      })
      toast.success(`Recenzie ${statusLabel(newStatus)}`)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Ștergi definitiv această recenzie?")) return
    try {
      await api(`/admin/reviews/${id}`, { method: "DELETE" })
      toast.success("Recenzie ștearsă")
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const saveResponse = async () => {
    if (!selected) return
    try {
      await api(`/admin/reviews/${selected.id}`, {
        method: "POST",
        body: JSON.stringify({ admin_response: response || null }),
      })
      toast.success("Răspuns salvat")
      setSelected(null)
      load()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  const renderActions = (r: Review) => (
    <>
      {r.status !== "approved" && (
        <Button
          size="small"
          variant="secondary"
          onClick={() => updateStatus(r.id, "approved")}
        >
          <CheckCircle />
        </Button>
      )}
      {r.status !== "rejected" && (
        <Button
          size="small"
          variant="secondary"
          onClick={() => updateStatus(r.id, "rejected")}
        >
          <XCircle />
        </Button>
      )}
      <Button
        size="small"
        variant="secondary"
        onClick={() => {
          setSelected(r)
          setResponse(r.admin_response ?? "")
        }}
      >
        Răspunde
      </Button>
      <Button
        size="small"
        variant="danger"
        onClick={() => remove(r.id)}
      >
        <Trash />
      </Button>
    </>
  )

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <Heading>Recenzii produse</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Moderează recenziile clienților. Recenziile de la achiziții
            verificate se publică automat.
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Label>Filtru</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as StatusFilter)}
          >
            <Select.Trigger className="w-full md:w-44">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="pending">În așteptare</Select.Item>
              <Select.Item value="approved">Aprobate</Select.Item>
              <Select.Item value="rejected">Respinse</Select.Item>
              <Select.Item value="all">Toate</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-12 text-center md:px-6">
          <Text>Se încarcă…</Text>
        </div>
      ) : reviews.length === 0 ? (
        <div className="px-4 py-12 text-center md:px-6">
          <Text>Nicio recenzie pentru acest filtru.</Text>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Produs</Table.HeaderCell>
                  <Table.HeaderCell>Client</Table.HeaderCell>
                  <Table.HeaderCell>Notă</Table.HeaderCell>
                  <Table.HeaderCell>Recenzie</Table.HeaderCell>
                  <Table.HeaderCell>Stare</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Acțiuni</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {reviews.map((r) => (
                  <Table.Row key={r.id}>
                    <Table.Cell className="max-w-xs">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium truncate">
                          {r.product?.title ?? r.product_id}
                        </span>
                        <span className="text-xs text-ui-fg-subtle">
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col gap-1">
                        <span>{r.customer_name}</span>
                        {r.is_verified_purchase && (
                          <Badge size="2xsmall" color="green">
                            achiziție verificată
                          </Badge>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Stars rating={r.rating} />
                    </Table.Cell>
                    <Table.Cell className="max-w-md">
                      {r.title && (
                        <div className="font-medium truncate">{r.title}</div>
                      )}
                      <div className="text-ui-fg-subtle text-sm line-clamp-2">
                        {r.body}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={statusColor(r.status)}>
                        {statusLabel(r.status)}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end gap-1">
                        {renderActions(r)}
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="divide-y md:hidden">
            {reviews.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">
                      {r.product?.title ?? r.product_id}
                    </span>
                    <span className="text-ui-fg-subtle text-xs">
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                  <Badge size="2xsmall" color={statusColor(r.status)}>
                    {statusLabel(r.status)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm">{r.customer_name}</span>
                    {r.is_verified_purchase && (
                      <Badge size="2xsmall" color="green">
                        achiziție verificată
                      </Badge>
                    )}
                  </div>
                  <Stars rating={r.rating} />
                </div>

                <div className="flex flex-col gap-1">
                  {r.title && <div className="font-medium">{r.title}</div>}
                  <Text size="small" className="text-ui-fg-subtle">
                    {r.body}
                  </Text>
                </div>

                <div className="flex flex-wrap gap-1">{renderActions(r)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="px-4 py-3 md:px-6">
        <Text size="small" className="text-ui-fg-subtle">
          {count} {count === 1 ? "recenzie" : "recenzii"}
        </Text>
      </div>

      <Drawer open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Title>Răspunsul magazinului</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-4">
            {selected && (
              <>
                <div className="bg-ui-bg-subtle rounded-md p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selected.customer_name}</span>
                    <Stars rating={selected.rating} />
                  </div>
                  {selected.title && (
                    <div className="font-medium">{selected.title}</div>
                  )}
                  <Text size="small">{selected.body}</Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Răspunsul tău public</Label>
                  <Textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={6}
                    placeholder="Va apărea sub recenzie, pe pagina produsului."
                  />
                </div>
              </>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button variant="secondary">Anulează</Button>
            </Drawer.Close>
            <Button onClick={saveResponse}>Salvează răspunsul</Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Recenzii",
  icon: Star,
})

export default ReviewsPage
