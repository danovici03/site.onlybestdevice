import {
  activeRuleKeys,
  RULE_DEFS,
  type Answers,
  type RepairGroup,
  type Rule,
  type RuleKey,
  type RuleKind,
} from "./catalog"

/**
 * Prețul de preluare al unui telefon. Funcție pură: primește prețul de bază,
 * regulile și răspunsurile, întoarce oferta cu tot calculul. Rulează numai pe
 * server — clientul vede doar suma finală, calculul rămâne în preluare.
 *
 *   preț = bază(model, stocare)
 *        − scăderile pentru răspunsuri (în aceeași grupă de reparație doar
 *          cea mai mare: un ecran nou repară și pixelii morți și zgârieturile)
 *   oricare regulă de tip „refuz" ⇒ fără ofertă
 *   rotunjire în jos (implicit la 10 lei); sub minim ⇒ fără ofertă
 *   voucher = preț + bonus %, rotunjit la fel
 *
 * Regulile se caută de la specific la general: pe dispozitiv, pe brand,
 * global, apoi valoarea implicită din `RULE_DEFS`. Așa Face ID-ul unui iPhone
 * poate costa altfel decât amprenta unui Samsung fără să dublezi tot tabelul.
 */

export type DeviceRef = { id: string; brand: string }

export type Deduction = {
  key: RuleKey
  label: string
  kind: RuleKind
  /** Valoarea regulii: lei la `fixed`, procent la `percent`. */
  value: number
  /** Suma în lei. 0 la refuz. */
  amount: number
  group: RepairGroup | null
  /** false = acoperită de o reparație mai mare din aceeași grupă. */
  applied: boolean
  /** De unde vine regula — util în admin când un preț pare greșit. */
  source: "device" | "brand" | "global" | "default"
}

export type Quote =
  | {
      status: "offer"
      base_price: number
      deductions: Deduction[]
      total_deduction: number
      /** Banii prin transfer bancar. */
      price: number
      /** Valoarea voucherului pe site (preț + bonus). */
      voucher_price: number
      voucher_bonus_percent: number
    }
  | {
      status: "rejected"
      base_price: number | null
      deductions: Deduction[]
      reasons: string[]
    }
  | {
      status: "too_low"
      base_price: number
      deductions: Deduction[]
      total_deduction: number
      price: number
      min_offer: number
    }
  | { status: "unavailable"; base_price: null; deductions: [] }

type Resolved = { kind: RuleKind; value: number; source: Deduction["source"] }

export function resolveRule(rules: Rule[], key: RuleKey, device: DeviceRef): Resolved {
  const brand = device.brand.trim().toLowerCase()
  const def = RULE_DEFS[key]
  const pick = (r: Rule | undefined, source: Deduction["source"]) =>
    r && (def.kinds as readonly RuleKind[]).includes(r.kind)
      ? { kind: r.kind, value: Number(r.value) || 0, source }
      : null

  const ofKey = rules.filter((r) => r.key === key)
  if (!("globalOnly" in def)) {
    const onDevice = pick(
      ofKey.find((r) => r.scope === "device" && r.scope_value === device.id),
      "device",
    )
    if (onDevice) return onDevice
    const onBrand = pick(
      ofKey.find((r) => r.scope === "brand" && r.scope_value.trim().toLowerCase() === brand),
      "brand",
    )
    if (onBrand) return onBrand
  }
  return (
    pick(ofKey.find((r) => r.scope === "global"), "global") ?? {
      kind: def.default.kind,
      value: def.default.value,
      source: "default",
    }
  )
}

const settingValue = (rules: Rule[], key: RuleKey, device: DeviceRef) =>
  Math.max(0, resolveRule(rules, key, device).value)

/**
 * Rotunjire în jos la `step` lei. Întâi la bani, ca erorile de virgulă mobilă
 * să nu taie un leu (100 × 1.15 = 114.999…).
 */
export const roundDown = (n: number, step: number) => {
  const exact = Math.round(n * 100) / 100
  return step > 1 ? Math.floor(exact / step) * step : Math.floor(exact)
}

/** Valoarea voucherului: suma prin transfer + bonus, rotunjită ca oferta. */
export const voucherAmount = (price: number, bonusPercent: number, step: number) =>
  roundDown((price * (100 + bonusPercent)) / 100, step)

export function computeQuote(input: {
  device: DeviceRef
  /** null = nu cumpărăm combinația asta (stocare fără preț). */
  basePrice: number | null
  answers: Answers
  rules: Rule[]
}): Quote {
  const { device, answers, rules } = input
  const base = input.basePrice
  if (base == null || !(base > 0)) {
    return { status: "unavailable", base_price: null, deductions: [] }
  }

  const threshold = settingValue(rules, "setting.battery_threshold", device)
  const keys = activeRuleKeys(device.brand, answers, threshold)

  const deductions: Deduction[] = keys.map((key) => {
    const r = resolveRule(rules, key, device)
    const def = RULE_DEFS[key]
    const amount =
      r.kind === "fixed"
        ? Math.max(0, Math.round(r.value))
        : r.kind === "percent"
          ? Math.max(0, Math.round((base * r.value) / 100))
          : 0
    return {
      key,
      label: def.label,
      kind: r.kind,
      value: r.value,
      amount,
      group: ("group" in def ? def.group : null) ?? null,
      applied: true,
      source: r.source,
    }
  })

  const rejected = deductions.filter((d) => d.kind === "reject")
  if (rejected.length) {
    return {
      status: "rejected",
      base_price: base,
      deductions,
      reasons: rejected.map((d) => d.label),
    }
  }

  // În fiecare grupă rămâne aplicată doar cea mai mare scădere.
  const byGroup = new Map<RepairGroup, Deduction>()
  for (const d of deductions) {
    if (!d.group) continue
    const best = byGroup.get(d.group)
    if (!best || d.amount > best.amount) byGroup.set(d.group, d)
  }
  for (const d of deductions) {
    if (d.group && byGroup.get(d.group) !== d) d.applied = false
  }

  const total = deductions.reduce((s, d) => s + (d.applied ? d.amount : 0), 0)
  const step = settingValue(rules, "setting.rounding", device)
  const minOffer = settingValue(rules, "setting.min_offer", device)
  const price = Math.max(0, roundDown(base - total, step))

  if (price < minOffer || price <= 0) {
    return {
      status: "too_low",
      base_price: base,
      deductions,
      total_deduction: total,
      price,
      min_offer: minOffer,
    }
  }

  const bonus = settingValue(rules, "setting.voucher_bonus", device)
  return {
    status: "offer",
    base_price: base,
    deductions,
    total_deduction: total,
    price,
    voucher_price: voucherAmount(price, bonus, step),
    voucher_bonus_percent: bonus,
  }
}
