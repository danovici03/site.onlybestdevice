import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ArrowUturnLeft } from "@medusajs/icons"
import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Table,
  Text,
  toast,
  Tooltip,
  usePrompt,
} from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

/**
 * Produsele șterse din Admin, cu butonul de restaurare.
 *
 * Ștergerea din Medusa e soft delete, dar Adminul nu are cale de întoarcere, iar
 * un produs șters rupe legătura cu gestiunea: ERP-ul rămâne cu `variant_id`-ul
 * vechi și nu mai poate trimite stoc. Restaurarea readuce produsul cu aceleași
 * ID-uri, deci gestiunea se leagă la loc singură. Logica e în
 * `lib/products/restore.ts`.
 */

type DeletedProduct = {
  id: string
  title: string
  handle: string | null
  status: string
  thumbnail: string | null
  deleted_at: string
  skus: string[]
  /** False = șters fără fotografia stării de dinainte; restaurare aproximativă. */
  exact: boolean
  conflicts: string[]
}

type RestoreResult = {
  id: string
  title: string
  warnings: string[]
  variants: number
  prices: number[][]
  stock: number[][]
}

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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

const statusLabel = (s: string) =>
  s === "published" ? "publicat" : s === "draft" ? "draft" : s

// Pozele sunt adesea hotlinkate de la furnizori; una căzută lasă locul gol, nu
// iconița de imagine spartă a browserului.
const Thumb = ({ src }: { src: string | null }) => {
  const [failed, setFailed] = useState(false)
  return src && !failed ? (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-md border object-cover"
    />
  ) : (
    <div className="bg-ui-bg-subtle h-10 w-10 shrink-0 rounded-md border" />
  )
}

const DeletedProductsPage = () => {
  const prompt = usePrompt()
  const [products, setProducts] = useState<DeletedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ products: DeletedProduct[] }>(
        "/admin/deleted-products",
      )
      setProducts(data.products)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.handle ?? "").toLowerCase().includes(q) ||
        p.skus.some((s) => s.toLowerCase().includes(q)),
    )
  }, [products, search])

  const restore = async (p: DeletedProduct) => {
    const ok = await prompt({
      title: "Restaurezi produsul?",
      description:
        `„${p.title}” revine cu aceleași ID-uri, prețuri, poze și categorii, ` +
        `în starea „${statusLabel(p.status)}”. Gestiunea se leagă la loc singură.` +
        (p.exact
          ? ""
          : " Starea de dinainte de ștergere nu a fost salvată: verifică apoi prețul promoțional."),
      confirmText: "Restaurează",
      cancelText: "Anulează",
      variant: "confirmation",
    })
    if (!ok) return

    setBusyId(p.id)
    try {
      const { result } = await api<{ result: RestoreResult }>(
        `/admin/deleted-products/${p.id}/restore`,
        { method: "POST" },
      )
      const stock = result.stock.flat()
      const notify = result.warnings.length ? toast.warning : toast.success
      notify(`„${result.title}” a fost restaurat`, {
        description:
          `${result.variants} ${result.variants === 1 ? "variantă" : "variante"}, ` +
          `stoc ${stock.length ? stock.join(", ") : "—"}. ` +
          "Stocul trimis din gestiune după ștergere n-a ajuns: resincronizează-l de acolo." +
          (result.warnings.length ? ` ${result.warnings.join(" ")}` : ""),
        duration: result.warnings.length ? 20000 : 10000,
      })
      setProducts((list) => list.filter((x) => x.id !== p.id))
    } catch (err: any) {
      toast.error(err.message)
      load()
    } finally {
      setBusyId(null)
    }
  }

  const RestoreButton = ({ p }: { p: DeletedProduct }) => (
    <Button
      size="small"
      variant="secondary"
      disabled={!!p.conflicts.length || busyId !== null}
      isLoading={busyId === p.id}
      onClick={() => restore(p)}
    >
      <ArrowUturnLeft />
      Restaurează
    </Button>
  )

  const Conflicts = ({ p }: { p: DeletedProduct }) =>
    p.conflicts.length ? (
      <Text size="xsmall" className="text-ui-fg-error">
        Nu se poate restaura: {p.conflicts.join("; ")}.
      </Text>
    ) : null

  // Produsele șterse înainte de fotografia de la ștergere: restaurarea nu poate
  // deosebi o promoție activă de una scoasă mai demult.
  const Approximate = ({ p }: { p: DeletedProduct }) =>
    p.exact ? null : (
      <Tooltip content="Șters înainte ca starea lui să fie salvată la ștergere. După restaurare verifică prețul promoțional: o promoție scoasă mai demult poate reapărea.">
        <Badge size="2xsmall" color="orange">
          verifică promoția
        </Badge>
      </Tooltip>
    )

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <Heading>Produse șterse</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Produsele șterse rămân în bază și pot fi readuse cu aceleași ID-uri,
            deci legătura cu gestiunea revine singură.
          </Text>
        </div>
        <Input
          type="search"
          size="small"
          placeholder="Caută după nume sau SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-64"
        />
      </div>

      {loading ? (
        <div className="px-4 py-12 text-center md:px-6">
          <Text>Se încarcă…</Text>
        </div>
      ) : visible.length === 0 ? (
        <div className="px-4 py-12 text-center md:px-6">
          <Text>
            {products.length ? "Niciun produs șters nu se potrivește." : "Niciun produs șters."}
          </Text>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Produs</Table.HeaderCell>
                  <Table.HeaderCell>SKU</Table.HeaderCell>
                  <Table.HeaderCell>Stare</Table.HeaderCell>
                  <Table.HeaderCell>Șters la</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Acțiuni</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {visible.map((p) => (
                  <Table.Row key={p.id}>
                    <Table.Cell className="max-w-md">
                      <div className="flex items-center gap-3 py-2">
                        <Thumb src={p.thumbnail} />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-medium">{p.title}</span>
                          <Conflicts p={p} />
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-mono text-xs">
                      {p.skus.join(", ") || "—"}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge size="2xsmall" color={p.status === "published" ? "green" : "grey"}>
                          {statusLabel(p.status)}
                        </Badge>
                        <Approximate p={p} />
                      </div>
                    </Table.Cell>
                    <Table.Cell>{formatDate(p.deleted_at)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex justify-end">
                        <RestoreButton p={p} />
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="divide-y md:hidden">
            {visible.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex items-start gap-3">
                  <Thumb src={p.thumbnail} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium">{p.title}</span>
                    <span className="text-ui-fg-subtle font-mono text-xs">
                      {p.skus.join(", ") || "—"}
                    </span>
                    <span className="text-ui-fg-subtle text-xs">
                      șters la {formatDate(p.deleted_at)}
                    </span>
                  </div>
                  <Badge size="2xsmall" color={p.status === "published" ? "green" : "grey"}>
                    {statusLabel(p.status)}
                  </Badge>
                </div>
                <Conflicts p={p} />
                <div className="flex items-center gap-2">
                  <RestoreButton p={p} />
                  <Approximate p={p} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <Text size="small" className="text-ui-fg-subtle">
          {products.length} {products.length === 1 ? "produs șters" : "produse șterse"}
        </Text>
        <Link to="/products" className="text-ui-fg-interactive text-sm">
          Înapoi la produse
        </Link>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Produse șterse",
  nested: "/products",
})

export default DeletedProductsPage
