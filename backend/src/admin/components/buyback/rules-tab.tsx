import { Badge, Button, Heading, Input, Label, Select, Text, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

import {
  api,
  KIND_LABEL,
  SECTION_LABEL,
  type BuybackDevice,
  type RuleDef,
  type RuleKind,
  type RuleRow,
  type RuleScope,
} from "./shared"

type Draft = { kind: RuleKind; value: string }

/**
 * Regulile de scădere. Fiecare cheie are o valoare globală (sau implicită din
 * cod, dacă n-ai schimbat-o) și, opțional, excepții pe brand sau pe model.
 * La calcul câștigă cea mai specifică: model > brand > global > implicit.
 *
 * În aceeași grupă de reparație (ecran / carcasă / baterie) se scade doar cea
 * mai mare sumă — un ecran nou acoperă și zgârieturile și pixelii morți.
 */
export const RulesTab = ({ devices }: { devices: BuybackDevice[] }) => {
  const [defs, setDefs] = useState<RuleDef[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const data = await api<{ defs: RuleDef[]; rules: RuleRow[] }>("/admin/buyback/rules")
      setDefs(data.defs)
      setRules(data.rules)
      setDrafts({})
    } catch (e: any) {
      toast.error(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const deviceName = useMemo(
    () => new Map(devices.map((d) => [d.id, `${d.brand} ${d.model}`])),
    [devices],
  )

  const globalOf = (key: string) => rules.find((r) => r.key === key && r.scope === "global")
  const effective = (def: RuleDef): Draft => {
    if (drafts[def.key]) return drafts[def.key]
    const g = globalOf(def.key)
    return g ? { kind: g.kind, value: String(g.value) } : { kind: def.default.kind, value: String(def.default.value) }
  }

  const setDraft = (def: RuleDef, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [def.key]: { ...effective(def), ...patch } }))

  const post = async (body: unknown) => {
    const data = await api<{ rules: RuleRow[] }>("/admin/buyback/rules", {
      method: "POST",
      body: JSON.stringify(body),
    })
    setRules(data.rules)
  }

  const save = async () => {
    setSaving(true)
    try {
      const upsert = Object.entries(drafts).map(([key, d]) => ({
        key,
        scope: "global",
        scope_value: "",
        kind: d.kind,
        value: d.kind === "reject" ? 0 : Number(d.value.replace(",", ".")) || 0,
      }))
      await post({ upsert })
      setDrafts({})
      toast.success("Regulile au fost salvate")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async (def: RuleDef) => {
    const g = globalOf(def.key)
    setDrafts((d) => {
      const { [def.key]: _, ...rest } = d
      return rest
    })
    if (!g) return
    try {
      await post({ delete: [g.id] })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const removeOverride = async (r: RuleRow) => {
    try {
      await post({ delete: [r.id] })
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const sections = Object.keys(SECTION_LABEL) as RuleDef["section"][]
  const dirty = Object.keys(drafts).length

  const describe = (kind: RuleKind, value: number) =>
    kind === "reject" ? "refuz" : kind === "percent" ? `${value}%` : `${value} lei`

  return (
    <div className="divide-y">
      <div className="flex items-start justify-between gap-4 px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle max-w-3xl">
          Valorile marcate „implicit” sunt un punct de pornire, nu costuri
          verificate — pune costurile tale reale de service înainte de lansare.
          „Procent” se aplică la prețul de bază al stocării. În aceeași grupă
          (ecran / carcasă / baterie) se scade doar reparația cea mai mare.
        </Text>
        <Button size="small" onClick={save} disabled={!dirty} isLoading={saving}>
          Salvează{dirty ? ` (${dirty})` : ""}
        </Button>
      </div>

      {sections.map((section) => {
        const list = defs.filter((d) => d.section === section)
        if (!list.length) return null
        return (
          <div key={section} className="px-6 py-4">
            <Heading level="h3" className="mb-3">
              {SECTION_LABEL[section]}
            </Heading>
            <div className="flex flex-col gap-3">
              {list.map((def) => {
                const eff = effective(def)
                const isDefault = !globalOf(def.key) && !drafts[def.key]
                const overrides = rules.filter((r) => r.key === def.key && r.scope !== "global")
                return (
                  <div key={def.key} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <div className="flex items-center gap-2">
                        <Text size="small" weight="plus">
                          {def.label}
                        </Text>
                        {isDefault && (
                          <Badge size="2xsmall" color="grey">
                            implicit
                          </Badge>
                        )}
                        {drafts[def.key] && (
                          <Badge size="2xsmall" color="orange">
                            nesalvat
                          </Badge>
                        )}
                      </div>
                      {def.help && (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {def.help}
                        </Text>
                      )}
                      {overrides.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {overrides.map((r) => (
                            <Badge key={r.id} size="2xsmall" color="blue">
                              {r.scope === "brand" ? r.scope_value : (deviceName.get(r.scope_value) ?? r.scope_value)}
                              : {describe(r.kind, r.value)}
                              <button className="ml-1" title="Șterge excepția" onClick={() => removeOverride(r)}>
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {def.kinds.length > 1 ? (
                        <div className="w-44">
                          <Select
                            size="small"
                            value={eff.kind}
                            onValueChange={(v) => setDraft(def, { kind: v as RuleKind })}
                          >
                            <Select.Trigger>
                              <Select.Value />
                            </Select.Trigger>
                            <Select.Content>
                              {def.kinds.map((k) => (
                                <Select.Item key={k} value={k}>
                                  {KIND_LABEL[k]}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        </div>
                      ) : null}
                      <Input
                        size="small"
                        className="w-24"
                        disabled={eff.kind === "reject"}
                        value={eff.kind === "reject" ? "" : eff.value}
                        onChange={(e) => setDraft(def, { value: e.target.value })}
                      />
                      <Text size="xsmall" className="text-ui-fg-subtle w-6">
                        {eff.kind === "percent" ? "%" : eff.kind === "fixed" ? "lei" : ""}
                      </Text>
                      <Button
                        size="small"
                        variant="transparent"
                        disabled={isDefault}
                        onClick={() => resetToDefault(def)}
                      >
                        Implicit
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <OverrideForm defs={defs} devices={devices} onSaved={(r) => setRules(r)} />
    </div>
  )
}

const OverrideForm = ({
  defs,
  devices,
  onSaved,
}: {
  defs: RuleDef[]
  devices: BuybackDevice[]
  onSaved: (rules: RuleRow[]) => void
}) => {
  const choices = defs.filter((d) => !d.globalOnly)
  const [key, setKey] = useState("")
  const [scope, setScope] = useState<Exclude<RuleScope, "global">>("brand")
  const [target, setTarget] = useState("")
  const [kind, setKind] = useState<RuleKind>("fixed")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  const def = choices.find((d) => d.key === key)
  const brands = useMemo(() => [...new Set(devices.map((d) => d.brand))].sort(), [devices])
  const sortedDevices = useMemo(
    () => [...devices].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)),
    [devices],
  )

  useEffect(() => {
    if (def && !def.kinds.includes(kind)) setKind(def.kinds[0])
  }, [def])

  const submit = async () => {
    setBusy(true)
    try {
      const data = await api<{ rules: RuleRow[] }>("/admin/buyback/rules", {
        method: "POST",
        body: JSON.stringify({
          upsert: [
            {
              key,
              scope,
              scope_value: target,
              kind,
              value: kind === "reject" ? 0 : Number(value.replace(",", ".")) || 0,
            },
          ],
        }),
      })
      onSaved(data.rules)
      setValue("")
      toast.success("Excepția a fost salvată")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-6 py-4">
      <Heading level="h3">Excepție pe brand sau model</Heading>
      <Text size="small" className="text-ui-fg-subtle mb-3">
        Ex.: Face ID la Apple costă 40%, ecranul la Galaxy S25 Ultra costă 1.200 lei fix.
      </Text>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Label size="small">Regula</Label>
          <Select size="small" value={key} onValueChange={setKey}>
            <Select.Trigger>
              <Select.Value placeholder="Alege…" />
            </Select.Trigger>
            <Select.Content>
              {choices.map((d) => (
                <Select.Item key={d.key} value={d.key}>
                  {d.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="w-32">
          <Label size="small">Pentru</Label>
          <Select
            size="small"
            value={scope}
            onValueChange={(v) => (setScope(v as "brand" | "device"), setTarget(""))}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="brand">Brand</Select.Item>
              <Select.Item value="device">Model</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="w-64">
          <Label size="small">{scope === "brand" ? "Brand" : "Model"}</Label>
          <Select size="small" value={target} onValueChange={setTarget}>
            <Select.Trigger>
              <Select.Value placeholder="Alege…" />
            </Select.Trigger>
            <Select.Content>
              {scope === "brand"
                ? brands.map((b) => (
                    <Select.Item key={b} value={b}>
                      {b}
                    </Select.Item>
                  ))
                : sortedDevices.map((d) => (
                    <Select.Item key={d.id} value={d.id}>
                      {d.brand} {d.model}
                    </Select.Item>
                  ))}
            </Select.Content>
          </Select>
        </div>
        <div className="w-44">
          <Label size="small">Tip</Label>
          <Select size="small" value={kind} onValueChange={(v) => setKind(v as RuleKind)}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {(def?.kinds ?? (["fixed", "percent", "reject"] as RuleKind[])).map((k) => (
                <Select.Item key={k} value={k}>
                  {KIND_LABEL[k]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div>
          <Label size="small">Valoare</Label>
          <Input
            size="small"
            className="w-24"
            disabled={kind === "reject"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button size="small" onClick={submit} isLoading={busy} disabled={!key || !target}>
          Adaugă excepția
        </Button>
      </div>
    </div>
  )
}
