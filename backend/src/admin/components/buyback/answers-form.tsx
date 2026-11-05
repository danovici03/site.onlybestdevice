import { Checkbox, Input, Label, Select, Text } from "@medusajs/ui"

export type Answers = {
  network: "unlocked" | "carrier" | "foreign"
  liquid: boolean
  burn_in?: boolean
  screen: string
  case: string
  battery?: number
  display_defects: string[]
  phone_defects: string[]
}

export const PERFECT_ANSWERS: Answers = {
  network: "unlocked",
  liquid: false,
  burn_in: false,
  screen: "perfect",
  case: "perfect",
  battery: 100,
  display_defects: [],
  phone_defects: [],
}

export const GRADES = [
  ["perfect", "Perfect"],
  ["light", "Urme ușoare"],
  ["visible", "Urme vizibile"],
  ["worn", "Uzat"],
  ["broken", "Spart / ciobit"],
] as const

export const DISPLAY = [
  ["unresponsive", "Nu răspunde la atingere"],
  ["yellowed", "Îngălbenit"],
  ["pressure_points", "Puncte de presiune"],
  ["dead_pixels", "Pixeli morți"],
] as const

export const PHONE = [
  ["muffled_sound", "Sunet înfundat"],
  ["front_camera", "Camera față"],
  ["back_camera", "Camera spate"],
  ["biometrics", "Face ID / amprentă"],
  ["battery_swollen", "Baterie umflată"],
  ["other", "Alte probleme"],
] as const

export const NETWORK_LABEL: Record<string, string> = {
  unlocked: "Deblocat",
  carrier: "Operator din România",
  foreign: "Operator străin",
}

const label = (list: readonly (readonly [string, string])[], v: string) =>
  list.find(([k]) => k === v)?.[1] ?? v

/** Rezumatul unui set de răspunsuri, pe un rând per întrebare. */
export function answersSummary(a: Answers, apple: boolean): [string, string][] {
  return [
    ["Rețea", NETWORK_LABEL[a.network] ?? a.network],
    ["Lichide", a.liquid ? "Da" : "Nu"],
    ...(!apple ? ([["Burn-in", a.burn_in ? "Da" : "Nu"]] as [string, string][]) : []),
    ["Ecran", label(GRADES, a.screen)],
    ["Carcasă", label(GRADES, a.case)],
    ...(apple ? ([["Baterie", a.battery != null ? `${a.battery}%` : "—"]] as [string, string][]) : []),
    ["Defecte ecran", a.display_defects?.length ? a.display_defects.map((d) => label(DISPLAY, d)).join(", ") : "—"],
    ["Alte defecte", a.phone_defects?.length ? a.phone_defects.map((d) => label(PHONE, d)).join(", ") : "—"],
  ]
}

/** Formularul cu răspunsurile evaluării — calculator și verificarea tehnică. */
export function AnswersForm({
  value,
  onChange,
  apple,
}: {
  value: Answers
  onChange: (a: Answers) => void
  apple: boolean
}) {
  const set = (patch: Partial<Answers>) => onChange({ ...value, ...patch })
  const toggle = (key: "display_defects" | "phone_defects", v: string) => {
    const cur = value[key] ?? []
    set({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<Answers>)
  }
  const gradeSelect = (v: string, onValue: (v: string) => void) => (
    <Select size="small" value={v} onValueChange={onValue}>
      <Select.Trigger>
        <Select.Value />
      </Select.Trigger>
      <Select.Content>
        {GRADES.map(([k, l]) => (
          <Select.Item key={k} value={k}>
            {l}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label size="small">Rețea</Label>
          <Select size="small" value={value.network} onValueChange={(v) => set({ network: v as Answers["network"] })}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {Object.entries(NETWORK_LABEL).map(([k, l]) => (
                <Select.Item key={k} value={k}>
                  {l}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div>
          <Label size="small">Baterie (%) {apple ? "" : "— doar Apple"}</Label>
          <Input
            size="small"
            disabled={!apple}
            value={value.battery ?? ""}
            onChange={(e) => set({ battery: Math.min(100, Number(e.target.value.replace(/[^\d]/g, "")) || 0) })}
          />
        </div>
        <div>
          <Label size="small">Ecran</Label>
          {gradeSelect(value.screen, (v) => set({ screen: v }))}
        </div>
        <div>
          <Label size="small">Carcasă</Label>
          {gradeSelect(value.case, (v) => set({ case: v }))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <Checkbox checked={value.liquid} onCheckedChange={(v) => set({ liquid: !!v })} />
          <Text size="small">Contact cu lichide</Text>
        </label>
        {!apple && (
          <label className="flex items-center gap-2">
            <Checkbox checked={!!value.burn_in} onCheckedChange={(v) => set({ burn_in: !!v })} />
            <Text size="small">Burn-in</Text>
          </label>
        )}
      </div>
      <div>
        <Text size="small" weight="plus">
          Defecte ecran
        </Text>
        <div className="mt-1 flex flex-wrap gap-4">
          {DISPLAY.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2">
              <Checkbox checked={value.display_defects.includes(k)} onCheckedChange={() => toggle("display_defects", k)} />
              <Text size="small">{l}</Text>
            </label>
          ))}
        </div>
      </div>
      <div>
        <Text size="small" weight="plus">
          Alte defecte
        </Text>
        <div className="mt-1 flex flex-wrap gap-4">
          {PHONE.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2">
              <Checkbox checked={value.phone_defects.includes(k)} onCheckedChange={() => toggle("phone_defects", k)} />
              <Text size="small">{l}</Text>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
