import { InformationCircleSolid } from "@medusajs/icons"
import {
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Tooltip,
  TooltipProvider,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { ReactNode, useMemo, useState } from "react"

import ChipInput from "./chip-input"
import FilterValuesSection from "./filter-values-section"
import {
  describeReport,
  filtersApi,
  postJson,
  slugifyKey,
  type AdminFilterAttribute,
  type AutofillReport,
  type FilterDisplay,
  type FilterMeta,
  type FilterType,
} from "../lib/product-filters"

/** Valoarea „Niciunul" din dropdown — Radix Select nu acceptă `""`. */
const NONE = "__none"

type Draft = {
  label: string
  key: string
  type: FilterType
  display: FilterDisplay
  unit: string
  is_global: boolean
  is_multi: boolean
  closed_values: boolean
  extractor: string | null
  sources: string[]
  category_ids: string[]
}

const toDraft = (a: AdminFilterAttribute | null): Draft => ({
  label: a?.label ?? "",
  key: a?.key ?? "",
  type: a?.type ?? "select",
  display: a?.display ?? "chips",
  unit: a?.unit ?? "",
  is_global: a?.is_global ?? false,
  is_multi: a?.is_multi ?? false,
  closed_values: a?.closed_values ?? false,
  extractor: a?.extractor ?? null,
  sources: a?.sources ?? [],
  category_ids: a?.category_ids ?? [],
})

/**
 * Editorul unui filtru: setările din stânga, valorile canonice din dreapta.
 *
 * FocusModal, nu Drawer: arborele de categorii și lista de valori (zeci, cu
 * alias-uri) nu încap lizibil în coloana îngustă a unui drawer.
 *
 * După salvare pornește singură completarea automată pentru filtrul ăsta —
 * aproape orice câmp de aici (surse, extractor, categorii, tip) schimbă ce
 * valori ar trebui să aibă produsele, iar un filtru salvat dar necompletat ar
 * apărea gol în magazin până la următoarea salvare a fiecărui produs.
 */
const AttributeEditor = ({
  attribute,
  meta,
  onClose,
  onChanged,
  onCreated,
}: {
  /** `null` = filtru nou. */
  attribute: AdminFilterAttribute | null
  meta: FilterMeta
  onClose: () => void
  onChanged: () => Promise<void>
  onCreated: (id: string) => void
}) => {
  const prompt = usePrompt()
  const [draft, setDraft] = useState<Draft>(() => toDraft(attribute))
  // La un filtru nou, cheia urmează eticheta până o atinge operatorul.
  const [keyTouched, setKeyTouched] = useState(!!attribute)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const setLabel = (label: string) =>
    setDraft((d) => ({ ...d, label, key: keyTouched ? d.key : slugifyKey(label) }))

  const extractors = meta.extractors.filter((e) => e.type === draft.type)

  const specSuggestions = useMemo(
    () =>
      meta.spec_labels.map((s) => ({
        value: s.label,
        hint: `${s.product_count} produse${
          s.samples?.length ? ` · ${s.samples.filter(Boolean).slice(0, 3).join(", ")}` : ""
        }`,
      })),
    [meta.spec_labels]
  )

  const tree = useMemo(() => {
    const children = new Map<string | null, FilterMeta["categories"]>()
    for (const c of meta.categories) {
      const list = children.get(c.parent_category_id) ?? []
      list.push(c)
      children.set(c.parent_category_id, list)
    }
    return children
  }, [meta.categories])

  const toggleCategory = (id: string, on: boolean) =>
    set("category_ids", on ? [...draft.category_ids, id] : draft.category_ids.filter((c) => c !== id))

  const keyChanged = !!attribute && draft.key !== attribute.key
  const typeChanged = !!attribute && draft.type !== attribute.type

  const save = async () => {
    if (!draft.label.trim() || !draft.key.trim()) {
      toast.error("Eticheta și cheia sunt obligatorii.")
      return
    }
    setSaving(true)
    try {
      const body = {
        ...draft,
        unit: draft.unit.trim() || null,
        // Un extractor de alt tip decât filtrul (ex. rămas de la o schimbare
        // de tip) ar fi respins de backend sau, mai rău, ar da valori greșite.
        extractor: extractors.some((e) => e.id === draft.extractor) ? draft.extractor : null,
      }
      const { attribute: saved } = attribute
        ? await postJson<{ attribute: { id: string } }>(`/attributes/${attribute.id}`, body)
        : await postJson<{ attribute: { id: string } }>("/attributes", body)

      const { report } = await postJson<{ report: AutofillReport }>("/recompute", {
        attribute_ids: [saved.id],
      })
      toast.success(attribute ? "Filtru salvat" : "Filtru creat", {
        description: describeReport(report),
      })
      await onChanged()
      if (!attribute) onCreated(saved.id)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!attribute) return
    const ok = await prompt({
      title: `Ștergi filtrul „${attribute.label}"?`,
      description: `Dispare din magazin, împreună cu cele ${attribute.values.length} valori și cu valorile de pe ${attribute.product_count} produse (inclusiv cele setate manual). Linkurile cu ?${attribute.key}= nu mai filtrează.`,
      confirmText: "Șterge",
      cancelText: "Anulează",
      variant: "danger",
    })
    if (!ok) return
    setDeleting(true)
    try {
      await filtersApi(`/attributes/${attribute.id}`, { method: "DELETE" })
      toast.success("Filtru șters")
      await onChanged()
      onClose()
    } catch (err: any) {
      toast.error(err.message)
      setDeleting(false)
    }
  }

  const renderCategory = (c: FilterMeta["categories"][number], depth: number): ReactNode => (
    <div key={c.id}>
      <label
        className="hover:bg-ui-bg-base-hover flex cursor-pointer items-center gap-2 rounded-md py-1 pr-2"
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        <Checkbox
          checked={draft.category_ids.includes(c.id)}
          onCheckedChange={(v) => toggleCategory(c.id, v === true)}
          disabled={draft.is_global}
        />
        <Text size="small" leading="compact" weight={depth === 0 ? "plus" : "regular"}>
          {c.name}
        </Text>
        <Text size="xsmall" className="text-ui-fg-muted ml-auto">
          {c.product_count}
        </Text>
      </label>
      {(tree.get(c.id) ?? []).map((child) => renderCategory(child, depth + 1))}
    </div>
  )

  return (
    <FocusModal open onOpenChange={(open) => !open && onClose()}>
      <FocusModal.Content>
        <FocusModal.Header>
          <div className="flex items-center gap-2">
            {attribute && (
              <Button variant="danger" size="small" onClick={remove} isLoading={deleting}>
                Șterge
              </Button>
            )}
            <Button size="small" onClick={save} isLoading={saving}>
              {attribute ? "Salvează și recalculează" : "Creează"}
            </Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Body className="overflow-auto">
          <TooltipProvider>
            <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-8 lg:grid-cols-2">
              <div className="flex flex-col gap-6">
                <div>
                  <FocusModal.Title asChild>
                    <Heading level="h2">{attribute ? attribute.label : "Filtru nou"}</Heading>
                  </FocusModal.Title>
                  <FocusModal.Description asChild>
                    <Text size="small" className="text-ui-fg-subtle">
                      Cum apare filtrul în magazin și de unde își ia valorile.
                    </Text>
                  </FocusModal.Description>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Eticheta din magazin">
                    <Input value={draft.label} onChange={(e) => setLabel(e.target.value)} placeholder="Memorie RAM" />
                  </Field>
                  <Field
                    label="Cheie (URL)"
                    tip="Numele parametrului din adresă: ?ram=8-gb. Doar litere mici, cifre și cratimă."
                  >
                    <Input
                      value={draft.key}
                      className="font-mono"
                      onChange={(e) => {
                        setKeyTouched(true)
                        set("key", e.target.value.toLowerCase())
                      }}
                      placeholder="ram"
                    />
                  </Field>
                </div>
                {keyChanged && (
                  <Text size="small" className="text-ui-fg-error -mt-3">
                    Schimbarea cheii schimbă URL-urile filtrelor: linkurile vechi (?{attribute!.key}=…) nu mai filtrează.
                  </Text>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Tip">
                    <Select value={draft.type} onValueChange={(v) => set("type", v as FilterType)}>
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="select">Listă de valori</Select.Item>
                        <Select.Item value="number">Interval numeric</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>
                  <Field label="Afișare">
                    <Select
                      value={draft.display}
                      onValueChange={(v) => set("display", v as FilterDisplay)}
                      disabled={draft.type === "number"}
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="chips">Butoane</Select.Item>
                        <Select.Item value="swatch">Pastile de culoare</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>
                  <Field label="Unitate" tip="Afișată lângă număr: GB, inch, mAh, h.">
                    <Input value={draft.unit} onChange={(e) => set("unit", e.target.value)} placeholder="GB" />
                  </Field>
                </div>
                {typeChanged && (
                  <Text size="small" className="text-ui-fg-error -mt-3">
                    La schimbarea tipului, valorile vechi de pe produse nu se mai potrivesc — se recalculează la salvare.
                  </Text>
                )}

                <div className="flex flex-col gap-3">
                  <SwitchRow
                    id="is_global"
                    checked={draft.is_global}
                    onChange={(v) => set("is_global", v)}
                    title="Global"
                    hint="Apare în orice listă, inclusiv în magazinul întreg și la căutare (ca marca)."
                  />
                  {draft.type === "select" && (
                    <>
                      <SwitchRow
                        id="is_multi"
                        checked={draft.is_multi}
                        onChange={(v) => set("is_multi", v)}
                        title="Mai multe valori pe produs"
                        hint="Fișa „Wi-Fi, Bluetooth, NFC” devine trei valori; o husă poate fi compatibilă cu două modele."
                      />
                      <SwitchRow
                        id="closed_values"
                        checked={draft.closed_values}
                        onChange={(v) => set("closed_values", v)}
                        title="Doar valorile din listă"
                        hint="Completarea automată nu creează valori noi; ce nu se potrivește cu o valoare sau un alias e ignorat."
                      />
                    </>
                  )}
                </div>

                <Field
                  label="Extractor din cod"
                  tip="Parser pentru ce nu stă într-o singură etichetă din fișă (ex. marca din titlu). Se încearcă primul; dacă nu găsește nimic, se citesc sursele de mai jos."
                >
                  <Select
                    value={draft.extractor && extractors.some((e) => e.id === draft.extractor) ? draft.extractor : NONE}
                    onValueChange={(v) => set("extractor", v === NONE ? null : v)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value={NONE}>Niciunul</Select.Item>
                      {extractors.map((e) => (
                        <Select.Item key={e.id} value={e.id}>
                          {e.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field>

                <Field
                  label="Surse din fișa tehnică"
                  tip="Etichetele din specificațiile produsului, în ordinea încercării. Diacriticele și majusculele nu contează."
                >
                  <ChipInput
                    values={draft.sources}
                    onChange={(v) => set("sources", v)}
                    suggestions={specSuggestions}
                    placeholder="Caută o etichetă (ex. Memorie RAM) și apasă Enter"
                  />
                </Field>

                <Field
                  label="Categorii"
                  tip="Filtrul apare în categoriile bifate și în subcategoriile lor. Ordinea din fiecare categorie se schimbă din pagina categoriei."
                >
                  {draft.is_global ? (
                    <Text size="small" className="text-ui-fg-subtle">
                      Filtrul e global — apare în toate categoriile.
                    </Text>
                  ) : (
                    <div className="border-ui-border-base max-h-[360px] overflow-auto rounded-lg border p-1">
                      {(tree.get(null) ?? []).map((c) => renderCategory(c, 0))}
                    </div>
                  )}
                </Field>
              </div>

              <div className="flex flex-col gap-4">
                {!attribute ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    Valorile se adaugă după crearea filtrului. De obicei nu trebuie adăugate de mână:
                    completarea automată le creează din fișe, iar aici doar le unești și le redenumești.
                  </Text>
                ) : attribute.type === "number" ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    Filtrele numerice n-au listă de valori: în magazin apar ca interval (min–max), calculat
                    din produsele listei curente.
                  </Text>
                ) : (
                  <FilterValuesSection attribute={attribute} onChanged={onChanged} />
                )}
              </div>
            </div>
          </TooltipProvider>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  )
}

const Field = ({ label, tip, children }: { label: string; tip?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-1">
      <Label size="small" weight="plus">
        {label}
      </Label>
      {tip && (
        <Tooltip content={tip} className="max-w-[280px]">
          <InformationCircleSolid className="text-ui-fg-muted" />
        </Tooltip>
      )}
    </div>
    {children}
  </div>
)

const SwitchRow = ({
  id,
  checked,
  onChange,
  title,
  hint,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  hint: string
}) => (
  <div className="flex items-start gap-3">
    <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    <div>
      <Label htmlFor={id} size="small" weight="plus" className="cursor-pointer">
        {title}
      </Label>
      <Text size="xsmall" className="text-ui-fg-subtle">
        {hint}
      </Text>
    </div>
  </div>
)

export default AttributeEditor
