import { PencilSquare, Plus, Trash } from "@medusajs/icons"
import {
  Badge,
  Button,
  Heading,
  IconButton,
  Input,
  Select,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMemo, useState } from "react"

import ChipInput from "./chip-input"
import {
  filtersApi,
  postJson,
  type AdminFilterAttribute,
  type AdminFilterValue,
} from "../lib/product-filters"

/**
 * Valorile canonice ale unui filtru-listă.
 *
 * Munca obișnuită aici nu e adăugarea, ci curățenia: completarea automată
 * creează câte o valoare pentru fiecare scriere nouă din fișe, iar dublurile
 * („Over the ear" lângă „Over-ear") se unesc. Unirea mută produsele și
 * păstrează numele șters ca alias, deci dublura nu mai reapare.
 *
 * Ordinea implicită e după numărul de produse: valorile de sus sunt cele pe
 * care le vede clientul cel mai des, iar cele cu 0 produse (resturi după o
 * unire sau o recalculare) se văd separat, ca să poată fi șterse.
 */
const FilterValuesSection = ({
  attribute,
  onChanged,
}: {
  attribute: AdminFilterAttribute
  onChanged: () => Promise<void>
}) => {
  const swatch = attribute.display === "swatch"
  const [newValue, setNewValue] = useState("")
  const [newHex, setNewHex] = useState("#cccccc")
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState("")

  const sorted = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return [...attribute.values]
      .filter(
        (v) =>
          !q ||
          v.value.toLowerCase().includes(q) ||
          v.aliases.some((a) => a.toLowerCase().includes(q))
      )
      .sort(
        (a, b) =>
          b.product_count - a.product_count || a.rank - b.rank || a.value.localeCompare(b.value)
      )
  }, [attribute.values, filter])

  const add = async () => {
    if (!newValue.trim()) return
    setAdding(true)
    try {
      await postJson(`/attributes/${attribute.id}/values`, {
        value: newValue.trim(),
        ...(swatch ? { hex: newHex } : {}),
      })
      setNewValue("")
      toast.success("Valoare adăugată")
      await onChanged()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Heading level="h2">Valori</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {attribute.values.length} valori · unește dublurile ca să rămână una singură în magazin.
          </Text>
        </div>
        {attribute.values.length > 8 && (
          <Input
            size="small"
            type="search"
            className="max-w-[180px]"
            placeholder="Caută…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        {swatch && (
          <input
            type="color"
            value={newHex}
            onChange={(e) => setNewHex(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent"
            aria-label="Culoarea valorii noi"
          />
        )}
        <Input
          size="small"
          value={newValue}
          placeholder="Valoare nouă (ex. 8 GB)"
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button size="small" variant="secondary" onClick={add} isLoading={adding}>
          <Plus />
          Adaugă
        </Button>
      </div>

      <div className="border-ui-border-base divide-y rounded-lg border">
        {sorted.length === 0 ? (
          <div className="px-4 py-6">
            <Text size="small" className="text-ui-fg-subtle">
              {filter ? "Nicio valoare nu se potrivește." : "Nicio valoare încă."}
            </Text>
          </div>
        ) : (
          sorted.map((v) => (
            <ValueRow
              key={v.id}
              value={v}
              swatch={swatch}
              siblings={attribute.values}
              onChanged={onChanged}
            />
          ))
        )}
      </div>
    </div>
  )
}

const ValueRow = ({
  value,
  swatch,
  siblings,
  onChanged,
}: {
  value: AdminFilterValue
  swatch: boolean
  siblings: AdminFilterValue[]
  onChanged: () => Promise<void>
}) => {
  const prompt = usePrompt()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState({
    value: value.value,
    hex: value.hex ?? "#cccccc",
    aliases: value.aliases,
    rank: value.rank,
  })

  const startEdit = () => {
    setDraft({ value: value.value, hex: value.hex ?? "#cccccc", aliases: value.aliases, rank: value.rank })
    setEditing(true)
  }

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await fn()
      toast.success(success)
      await onChanged()
      return true
    } catch (err: any) {
      toast.error(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const ok = await run(
      () =>
        postJson(`/values/${value.id}`, {
          value: draft.value.trim(),
          aliases: draft.aliases,
          rank: Number.isFinite(draft.rank) ? Math.trunc(draft.rank) : 0,
          ...(swatch ? { hex: draft.hex } : {}),
        }),
      "Valoare salvată"
    )
    if (ok) setEditing(false)
  }

  const remove = async () => {
    const ok = await prompt({
      title: `Ștergi „${value.value}"?`,
      description: value.product_count
        ? `Valoarea dispare de pe ${value.product_count} produse. Dacă e o dublură, folosește „Unește în…" — produsele trec pe cealaltă valoare, iar la ștergere completarea automată o poate recrea la următoarea salvare.`
        : "Valoarea nu e pe niciun produs.",
      confirmText: "Șterge",
      cancelText: "Anulează",
      variant: "danger",
    })
    if (ok) await run(() => filtersApi(`/values/${value.id}`, { method: "DELETE" }), "Valoare ștearsă")
  }

  const merge = async (intoId: string) => {
    const into = siblings.find((s) => s.id === intoId)
    if (!into) return
    const ok = await prompt({
      title: `Unești „${value.value}" în „${into.value}"?`,
      description: `Cele ${value.product_count} produse trec pe „${into.value}", iar „${value.value}" devine alias al ei — completarea automată nu o mai recreează.`,
      confirmText: "Unește",
      cancelText: "Anulează",
      variant: "confirmation",
    })
    if (ok) await run(() => postJson(`/values/${value.id}/merge`, { into_id: intoId }), "Valori unite")
  }

  if (editing) {
    return (
      <div className="bg-ui-bg-subtle flex flex-col gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          {swatch && (
            <input
              type="color"
              value={draft.hex}
              onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))}
              className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent"
              aria-label="Culoare"
            />
          )}
          <Input
            size="small"
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
          />
          <Input
            size="small"
            type="number"
            className="w-20"
            title="Poziție (mai mic = mai sus în magazin)"
            value={draft.rank}
            onChange={(e) => setDraft((d) => ({ ...d, rank: Number(e.target.value) }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Alias-uri — scrierile din fișe care înseamnă aceeași valoare
            {swatch ? " (la culori, orice nuanță care conține cuvântul intră aici)" : ""}.
          </Text>
          <ChipInput
            values={draft.aliases}
            onChange={(aliases) => setDraft((d) => ({ ...d, aliases }))}
            placeholder="ex. 8GB, Black — Enter pentru adăugare"
          />
        </div>
        {draft.value.trim() !== value.value && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Redenumirea schimbă și URL-ul valorii; numele vechi rămâne alias.
          </Text>
        )}
        <div className="flex justify-end gap-2">
          <Button size="small" variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
            Anulează
          </Button>
          <Button size="small" onClick={save} isLoading={busy}>
            Salvează
          </Button>
        </div>
      </div>
    )
  }

  const others = siblings.filter((s) => s.id !== value.id)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {swatch && (
        <span
          className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
          style={{ backgroundColor: value.hex ?? "#e5e7eb" }}
        />
      )}
      <div className="min-w-0 flex-1">
        <Text size="small" weight="plus" leading="compact" className="truncate">
          {value.value}
        </Text>
        {value.aliases.length > 0 && (
          <Text size="xsmall" leading="compact" className="text-ui-fg-muted truncate">
            {value.aliases.join(", ")}
          </Text>
        )}
      </div>
      <Badge size="2xsmall" color={value.product_count ? "grey" : "orange"}>
        {value.product_count ? `${value.product_count} produse` : "0 produse"}
      </Badge>
      {others.length > 0 && (
        // `value=""` ține selectul mereu pe placeholder: e o acțiune, nu o stare.
        <Select size="small" value="" onValueChange={merge} disabled={busy}>
          <Select.Trigger className="w-[130px]">
            <Select.Value placeholder="Unește în…" />
          </Select.Trigger>
          <Select.Content>
            {others.map((o) => (
              <Select.Item key={o.id} value={o.id}>
                {o.value}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      )}
      <IconButton size="small" variant="transparent" onClick={startEdit} aria-label="Editează">
        <PencilSquare />
      </IconButton>
      <IconButton size="small" variant="transparent" onClick={remove} disabled={busy} aria-label="Șterge">
        <Trash />
      </IconButton>
    </div>
  )
}

export default FilterValuesSection
