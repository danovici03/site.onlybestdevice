import { Badge, Button, Checkbox, Input, Label, Select, Switch, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import { uploadImages } from "../../lib/admin-uploads"
import { api, lei, storageLabel, type BuybackDevice } from "./shared"

/**
 * Tabelul de prețuri de preluare: un rând pe model + stocare. Se editează în
 * celule și se salvează doar ce s-a schimbat. Lângă prețul nostru stau:
 *  - prețul de vânzare din catalog (telefon nou, același model și stocare),
 *  - maximul flip (stare perfectă, cea mai mare stocare) — doar reper.
 */
export const PricesTab = ({
  devices,
  reload,
}: {
  devices: BuybackDevice[]
  reload: () => Promise<void>
}) => {
  const [brand, setBrand] = useState("all")
  const [search, setSearch] = useState("")
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [onlyActive, setOnlyActive] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [adjust, setAdjust] = useState("")
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => setEdits({}), [devices])

  const brands = useMemo(
    () => [...new Set(devices.map((d) => d.brand))].sort((a, b) => a.localeCompare(b)),
    [devices],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return devices.filter((d) => {
      if (brand !== "all" && d.brand !== brand) return false
      if (onlyActive && !d.is_active) return false
      if (q && !`${d.brand} ${d.model}`.toLowerCase().includes(q)) return false
      if (onlyMissing && !d.prices.some((p) => p.base_price == null)) return false
      return true
    })
  }, [devices, brand, search, onlyMissing, onlyActive])

  const priced = devices.reduce((n, d) => n + d.prices.filter((p) => p.base_price != null).length, 0)
  const totalPrices = devices.reduce((n, d) => n + d.prices.length, 0)
  const dirty = Object.keys(edits).length

  const valueOf = (id: string, original: number | null) =>
    id in edits ? edits[id] : original == null ? "" : String(original)

  const setCell = (id: string, original: number | null, v: string) => {
    setEdits((e) => {
      const next = { ...e }
      const clean = v.replace(/[^\d]/g, "")
      if (clean === (original == null ? "" : String(original))) delete next[id]
      else next[id] = clean
      return next
    })
  }

  /** Ajustare procentuală pe rândurile vizibile care au deja preț. */
  const applyAdjust = () => {
    const pct = Number(adjust.replace(",", "."))
    if (!Number.isFinite(pct) || pct === 0) return toast.error("Scrie un procent, ex. 5 sau -5")
    const next = { ...edits }
    let n = 0
    for (const d of visible) {
      for (const p of d.prices) {
        const cur = p.id in next ? Number(next[p.id]) : p.base_price
        if (!cur) continue
        next[p.id] = String(Math.floor((cur * (1 + pct / 100)) / 10) * 10)
        n++
      }
    }
    setEdits(next)
    toast.info(`${n} prețuri ajustate cu ${pct}% — verifică și salvează`)
  }

  const save = async () => {
    setSaving(true)
    try {
      const update = Object.entries(edits).map(([id, v]) => ({
        id,
        base_price: v === "" ? null : Number(v),
      }))
      await api("/admin/buyback/prices", { method: "POST", body: JSON.stringify({ update }) })
      toast.success(`${update.length} prețuri salvate`)
      await reload()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (d: BuybackDevice) => {
    try {
      await api(`/admin/buyback/devices/${d.id}`, {
        method: "POST",
        body: JSON.stringify({ is_active: !d.is_active }),
      })
      await reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const addStorage = async (d: BuybackDevice) => {
    const s = window.prompt(`Stocare nouă pentru ${d.brand} ${d.model} (ex. 512GB, 1TB)`)
    if (!s) return
    try {
      await api(`/admin/buyback/devices/${d.id}`, {
        method: "POST",
        body: JSON.stringify({ add_storages: [s] }),
      })
      await reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  /**
   * Poza modelului pe site. Fără ea, site-ul arată o siluetă generică pe brand.
   * Upload-ul merge în S3 (pe local tot în S3-ul de producție — vezi
   * `medusa-config.ts`), ca pozele de produs.
   */
  const setImage = async (d: BuybackDevice, file: File | null) => {
    try {
      const image_url = file ? (await uploadImages([file]))[0] : null
      await api(`/admin/buyback/devices/${d.id}`, {
        method: "POST",
        body: JSON.stringify({ image_url }),
      })
      toast.success(file ? `Poză salvată pentru ${d.model}` : "Poza a fost scoasă")
      await reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const removeStorage = async (id: string, label: string) => {
    if (!window.confirm(`Scoți stocarea ${label} din preluare?`)) return
    try {
      await api("/admin/buyback/prices", { method: "POST", body: JSON.stringify({ delete: [id] }) })
      await reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="divide-y">
      <div className="flex flex-col gap-3 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          Prețul de bază = telefon perfect, deblocat, plată prin transfer. Din el
          se scad regulile (tabul „Reguli”). Stocările fără preț nu primesc
          ofertă. {priced} din {totalPrices} stocări au preț.
        </Text>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select value={brand} onValueChange={setBrand} size="small">
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Toate brandurile</Select.Item>
                {brands.map((b) => (
                  <Select.Item key={b} value={b}>
                    {b}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <Input
            size="small"
            className="w-56"
            placeholder="Caută model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Checkbox id="bb-missing" checked={onlyMissing} onCheckedChange={(v) => setOnlyMissing(!!v)} />
            <Label htmlFor="bb-missing" size="small">
              Doar fără preț
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="bb-active" checked={onlyActive} onCheckedChange={(v) => setOnlyActive(!!v)} />
            <Label htmlFor="bb-active" size="small">
              Doar active
            </Label>
          </div>
          <div className="ml-auto flex items-end gap-2">
            <Input
              size="small"
              className="w-20"
              placeholder="±%"
              value={adjust}
              onChange={(e) => setAdjust(e.target.value)}
            />
            <Button size="small" variant="secondary" onClick={applyAdjust}>
              Ajustează vizibilele
            </Button>
            <Button size="small" variant="secondary" onClick={() => setAdding((v) => !v)}>
              Model nou
            </Button>
            <Button size="small" onClick={save} disabled={!dirty} isLoading={saving}>
              Salvează{dirty ? ` (${dirty})` : ""}
            </Button>
          </div>
        </div>
        {adding && <NewDeviceForm onDone={async () => (setAdding(false), await reload())} />}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Model</Table.HeaderCell>
              <Table.HeaderCell>Stocare</Table.HeaderCell>
              <Table.HeaderCell>Preț preluare (lei)</Table.HeaderCell>
              <Table.HeaderCell>Vindem nou la</Table.HeaderCell>
              <Table.HeaderCell>Preluare / vânzare</Table.HeaderCell>
              <Table.HeaderCell>Flip maxim</Table.HeaderCell>
              <Table.HeaderCell>Activ</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {visible.map((d) =>
              (d.prices.length ? d.prices : [null]).map((p, i) => {
                const raw = p ? valueOf(p.id, p.base_price) : ""
                const price = raw === "" ? null : Number(raw)
                const ratio = price && p?.sale_price ? Math.round((price / p.sale_price) * 100) : null
                return (
                  <Table.Row key={p?.id ?? d.id} className={!d.is_active ? "opacity-50" : ""}>
                    <Table.Cell>
                      {i === 0 && (
                        <div className="flex items-center gap-2">
                          <DeviceImage device={d} onChange={(f) => setImage(d, f)} />
                          <span className="txt-compact-small-plus">
                            {d.brand} {d.model}
                          </span>
                          <button
                            className="text-ui-fg-interactive txt-compact-xsmall"
                            onClick={() => addStorage(d)}
                          >
                            + stocare
                          </button>
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {p ? (
                        <span className="flex items-center gap-1">
                          {storageLabel(p.storage)}
                          <button
                            title="Scoate stocarea"
                            className="text-ui-fg-muted hover:text-ui-fg-error txt-compact-xsmall"
                            onClick={() => removeStorage(p.id, storageLabel(p.storage))}
                          >
                            ×
                          </button>
                        </span>
                      ) : (
                        <Text size="small" className="text-ui-fg-muted">
                          nicio stocare
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {p && (
                        <Input
                          size="small"
                          className={`w-28 ${p.id in edits ? "bg-ui-tag-orange-bg" : ""}`}
                          inputMode="numeric"
                          placeholder="—"
                          value={raw}
                          onChange={(e) => setCell(p.id, p.base_price, e.target.value)}
                        />
                      )}
                    </Table.Cell>
                    <Table.Cell>{p ? lei(p.sale_price) : ""}</Table.Cell>
                    <Table.Cell>
                      {ratio != null && (
                        <Badge size="2xsmall" color={ratio > 85 ? "red" : ratio > 70 ? "orange" : "green"}>
                          {ratio}%
                        </Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>{i === 0 ? lei(d.competitor_price) : ""}</Table.Cell>
                    <Table.Cell>
                      {i === 0 && <Switch checked={d.is_active} onCheckedChange={() => toggleActive(d)} />}
                    </Table.Cell>
                  </Table.Row>
                )
              }),
            )}
          </Table.Body>
        </Table>
        {!visible.length && (
          <Text size="small" className="text-ui-fg-subtle px-6 py-8 text-center">
            Niciun model pentru filtrele alese.
          </Text>
        )}
      </div>
    </div>
  )
}

const NewDeviceForm = ({ onDone }: { onDone: () => Promise<void> }) => {
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [storages, setStorages] = useState("128GB, 256GB")
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    setBusy(true)
    try {
      await api("/admin/buyback/devices", {
        method: "POST",
        body: JSON.stringify({
          brand,
          model,
          storages: storages.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      })
      toast.success(`${brand} ${model} adăugat — pune-i prețurile`)
      await onDone()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }, [brand, model, storages, onDone])

  return (
    <div className="bg-ui-bg-subtle flex flex-wrap items-end gap-3 rounded-lg p-3">
      <div>
        <Label size="small">Brand</Label>
        <Input size="small" className="w-32" placeholder="Google" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </div>
      <div>
        <Label size="small">Model</Label>
        <Input size="small" className="w-56" placeholder="Pixel 9 Pro" value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
      <div>
        <Label size="small">Stocări (cu virgulă)</Label>
        <Input size="small" className="w-56" value={storages} onChange={(e) => setStorages(e.target.value)} />
      </div>
      <Button size="small" onClick={submit} isLoading={busy} disabled={!brand.trim() || !model.trim()}>
        Adaugă
      </Button>
    </div>
  )
}

/** Miniatura modelului: click = alegi o poză nouă; × = o scoți. */
const DeviceImage = ({
  device,
  onChange,
}: {
  device: BuybackDevice
  onChange: (file: File | null) => void
}) => {
  const [busy, setBusy] = useState(false)
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setBusy(true)
    await onChange(file)
    setBusy(false)
  }
  return (
    <div className="group relative h-10 w-10 shrink-0">
      <label
        title={device.image_url ? "Schimbă poza" : "Adaugă poză"}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border ${
          device.image_url ? "bg-ui-bg-base" : "border-dashed text-ui-fg-muted"
        } ${busy ? "opacity-50" : ""}`}
      >
        {device.image_url ? (
          <img src={device.image_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="txt-compact-xsmall">{busy ? "…" : "+ poză"}</span>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={pick} disabled={busy} />
      </label>
      {device.image_url && (
        <button
          title="Scoate poza"
          onClick={() => window.confirm("Scoți poza? Pe site va apărea silueta generică.") && onChange(null)}
          className="bg-ui-bg-base absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full border text-[10px] group-hover:flex"
        >
          ×
        </button>
      )}
    </div>
  )
}
