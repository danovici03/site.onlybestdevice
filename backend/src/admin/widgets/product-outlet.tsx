import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/types"
import { Tag } from "@medusajs/icons"
import { Container, Heading, Switch, Text, toast } from "@medusajs/ui"
import { useState } from "react"

const OUTLET_TAG = "outlet"

const resolveOutletTagId = async (): Promise<string> => {
  const listRes = await fetch(
    `/admin/product-tags?value=${encodeURIComponent(OUTLET_TAG)}&limit=1`,
    { credentials: "include" }
  )
  if (listRes.ok) {
    const body = await listRes.json().catch(() => ({}))
    const found = (body?.product_tags ?? []).find(
      (t: { id: string; value: string }) =>
        (t.value ?? "").toLowerCase() === OUTLET_TAG
    )
    if (found?.id) {
      return found.id
    }
  }

  const createRes = await fetch(`/admin/product-tags`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: OUTLET_TAG }),
  })
  if (!createRes.ok) {
    const body = await createRes.json().catch(() => ({}))
    throw new Error(body?.message || `Eroare la crearea tagului (${createRes.status})`)
  }
  const created = await createRes.json()
  const id = created?.product_tag?.id
  if (!id) {
    throw new Error("Tagul outlet a fost creat, dar nu a returnat un id")
  }
  return id
}

const ProductOutletWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>) => {
  const initialOutlet = (product.tags ?? []).some(
    (t) => (t.value ?? "").toLowerCase() === OUTLET_TAG
  )
  const [isOutlet, setIsOutlet] = useState(initialOutlet)
  const [saving, setSaving] = useState(false)

  const toggle = async (next: boolean) => {
    setSaving(true)
    try {
      const existingTags = (product.tags ?? []).filter(
        (t) => (t.value ?? "").toLowerCase() !== OUTLET_TAG
      )
      const nonOutletIds = existingTags.map((t) => ({ id: t.id }))

      let nextTags: { id: string }[]
      if (next) {
        const outletId = await resolveOutletTagId()
        nextTags = [...nonOutletIds, { id: outletId }]
      } else {
        nextTags = nonOutletIds
      }

      const res = await fetch(`/admin/products/${product.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message || `Eroare ${res.status}`)
      }
      setIsOutlet(next)
      toast.success(
        next ? "Produs marcat ca Outlet" : "Produs scos din Outlet"
      )
    } catch (err: any) {
      toast.error(err.message || "Eroare la salvare")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Tag />
          <Heading level="h2">Outlet / produs expus</Heading>
        </div>
      </div>
      <div className="px-6 py-4 flex items-start justify-between gap-6">
        <div className="flex flex-col gap-1 max-w-2xl">
          <Text>
            Marchează produsul ca <strong>Outlet</strong> dacă a fost expus
            în magazin sau folosit în scop demonstrativ.
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            Tehnic, aplică sau scoate tagul <code>outlet</code> de pe produs.
            Atenție: deocamdată site-ul nu afișează nimic pe baza acestui tag —
            rămâne o etichetă internă până adăugăm badge-ul și regulile de
            garanție pentru produsele expuse.
          </Text>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={isOutlet}
            disabled={saving}
            onCheckedChange={toggle}
            id="outlet-toggle"
          />
          <label
            htmlFor="outlet-toggle"
            className="text-sm font-medium cursor-pointer"
          >
            {isOutlet ? "Produs Outlet" : "Produs standard"}
          </label>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductOutletWidget
