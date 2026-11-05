/**
 * Întrebările evaluării pentru preluarea telefoanelor și regulile de preț care
 * le corespund. Sursa unică pentru backend (calcul, validare, admin) — site-ul
 * primește lista prin API, nu o copiază.
 *
 * Întrebările sunt fixe în cod; din admin se schimbă doar valorile regulilor.
 * Pașii sunt cei de pe flip.ro/sell (analizat pe 04.11.2026): rețea, lichide,
 * burn-in (doar non-Apple, ecrane OLED cu istoric de ardere), starea ecranului,
 * starea carcasei, bateria (doar Apple — doar iOS arată sănătatea bateriei),
 * defecte de ecran, alte defecte.
 */

export const GRADES = ["perfect", "light", "visible", "worn", "broken"] as const
export type Grade = (typeof GRADES)[number]

export const GRADE_LABEL: Record<Grade, string> = {
  perfect: "Perfect",
  light: "Urme ușoare de folosire",
  visible: "Urme vizibile de folosire",
  worn: "Uzat",
  broken: "Spart sau ciobit",
}

export const NETWORKS = ["unlocked", "carrier", "foreign"] as const
export type Network = (typeof NETWORKS)[number]

export const NETWORK_LABEL: Record<Network, string> = {
  unlocked: "Deblocat",
  carrier: "Blocat pe un operator din România",
  foreign: "Blocat pe un operator străin",
}

export const DISPLAY_DEFECTS = [
  "unresponsive",
  "yellowed",
  "pressure_points",
  "dead_pixels",
] as const
export type DisplayDefect = (typeof DISPLAY_DEFECTS)[number]

export const DISPLAY_DEFECT_LABEL: Record<DisplayDefect, string> = {
  unresponsive: "Nu răspunde la atingere",
  yellowed: "Ecran îngălbenit",
  pressure_points: "Puncte de presiune",
  dead_pixels: "Pixeli „morți”",
}

export const PHONE_DEFECTS = [
  "muffled_sound",
  "front_camera",
  "back_camera",
  "biometrics",
  "battery_swollen",
  "other",
] as const
export type PhoneDefect = (typeof PHONE_DEFECTS)[number]

export const PHONE_DEFECT_LABEL: Record<PhoneDefect, string> = {
  muffled_sound: "Se aude încet (înfundat)",
  front_camera: "Camera față (selfie)",
  back_camera: "Camera spate",
  biometrics: "Senzor amprentă / Face ID",
  battery_swollen: "Baterie umflată",
  other: "Alte probleme (nu pornește, butoane etc.)",
}

export type Answers = {
  network: Network
  liquid: boolean
  /** Doar non-Apple. La Apple se ignoră. */
  burn_in?: boolean
  screen: Grade
  case: Grade
  /** Sănătatea bateriei în %, doar Apple. La celelalte se ignoră. */
  battery?: number
  display_defects: DisplayDefect[]
  phone_defects: PhoneDefect[]
}

export const isApple = (brand: string) => brand.trim().toLowerCase() === "apple"

/** Ce întrebări primește un brand — aceleași condiții ca la flip. */
export const questionsFor = (brand: string) => ({
  battery: isApple(brand),
  burn_in: !isApple(brand),
})

// ---------------------------------------------------------------------------
// Reguli
// ---------------------------------------------------------------------------

export const RULE_KINDS = ["fixed", "percent", "reject"] as const
export type RuleKind = (typeof RULE_KINDS)[number]

export const RULE_SCOPES = ["global", "brand", "device"] as const
export type RuleScope = (typeof RULE_SCOPES)[number]

/**
 * Grupa de reparație. În aceeași grupă se scade doar **cea mai mare** sumă,
 * nu suma lor: un ecran spart cu pixeli morți se repară cu un singur ecran
 * nou, nu cu două. Fără grupă, scăderile se adună.
 */
export type RepairGroup = "screen" | "case" | "battery"

export type RuleDef = {
  label: string
  /** Secțiunea din admin. */
  section: "refuz" | "ecran" | "carcasa" | "baterie" | "defecte" | "setari"
  group?: RepairGroup
  kinds: readonly RuleKind[]
  /** Valoarea folosită cât timp nu există un rând în tabelul de reguli. */
  default: { kind: RuleKind; value: number }
  /** Setările nu sunt scăderi: le citește calculul direct (prag, minim...). */
  setting?: boolean
  /** Setările au sens doar global. */
  globalOnly?: boolean
  help?: string
}

const DEDUCTION: readonly RuleKind[] = ["fixed", "percent", "reject"]

/**
 * Valorile implicite sunt un punct de pornire, nu prețuri verificate. Ce e
 * măsurat pe flip (iPhone 16 Pro, 04.11.2026): urmele ușoare nu scad nimic,
 * bateria sub 80% scade ~300 lei fix. Restul trebuie reglate din costurile
 * reale de service înainte de lansare.
 */
export const RULE_DEFS = {
  "network.foreign": {
    label: "Blocat pe operator străin",
    section: "refuz",
    kinds: DEDUCTION,
    default: { kind: "reject", value: 0 },
  },
  "network.carrier": {
    label: "Blocat pe operator din România",
    section: "refuz",
    kinds: DEDUCTION,
    default: { kind: "fixed", value: 0 },
    help: "Costul decodării, dacă e cazul.",
  },
  "liquid.yes": {
    label: "A avut contact cu lichide",
    section: "refuz",
    kinds: DEDUCTION,
    default: { kind: "reject", value: 0 },
  },
  "defect.other": {
    label: PHONE_DEFECT_LABEL.other,
    section: "refuz",
    kinds: DEDUCTION,
    default: { kind: "reject", value: 0 },
  },

  "screen.light": {
    label: `Ecran: ${GRADE_LABEL.light}`,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "fixed", value: 0 },
  },
  "screen.visible": {
    label: `Ecran: ${GRADE_LABEL.visible}`,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 8 },
  },
  "screen.worn": {
    label: `Ecran: ${GRADE_LABEL.worn}`,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 18 },
  },
  "screen.broken": {
    label: `Ecran: ${GRADE_LABEL.broken}`,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 35 },
  },
  "burn_in.yes": {
    label: "Ecran ars (burn-in)",
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 30 },
  },
  "display.unresponsive": {
    label: `Ecran: ${DISPLAY_DEFECT_LABEL.unresponsive}`,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 35 },
  },
  "display.yellowed": {
    label: DISPLAY_DEFECT_LABEL.yellowed,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 25 },
  },
  "display.pressure_points": {
    label: `Ecran: ${DISPLAY_DEFECT_LABEL.pressure_points}`,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 25 },
  },
  "display.dead_pixels": {
    label: `Ecran: ${DISPLAY_DEFECT_LABEL.dead_pixels}`,
    section: "ecran",
    group: "screen",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 25 },
  },

  "case.light": {
    label: `Carcasă: ${GRADE_LABEL.light}`,
    section: "carcasa",
    group: "case",
    kinds: DEDUCTION,
    default: { kind: "fixed", value: 0 },
  },
  "case.visible": {
    label: `Carcasă: ${GRADE_LABEL.visible}`,
    section: "carcasa",
    group: "case",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 6 },
  },
  "case.worn": {
    label: `Carcasă: ${GRADE_LABEL.worn}`,
    section: "carcasa",
    group: "case",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 15 },
  },
  "case.broken": {
    label: `Carcasă: ${GRADE_LABEL.broken}`,
    section: "carcasa",
    group: "case",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 25 },
  },

  "battery.low": {
    label: "Baterie sub prag (Apple)",
    section: "baterie",
    group: "battery",
    kinds: DEDUCTION,
    default: { kind: "fixed", value: 300 },
    help: "Costul unei baterii noi montate. Pe flip: ~296 lei la iPhone 16 Pro.",
  },
  "defect.battery_swollen": {
    label: PHONE_DEFECT_LABEL.battery_swollen,
    section: "baterie",
    group: "battery",
    kinds: DEDUCTION,
    default: { kind: "fixed", value: 300 },
  },

  "defect.muffled_sound": {
    label: PHONE_DEFECT_LABEL.muffled_sound,
    section: "defecte",
    kinds: DEDUCTION,
    default: { kind: "fixed", value: 150 },
  },
  "defect.front_camera": {
    label: PHONE_DEFECT_LABEL.front_camera,
    section: "defecte",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 10 },
  },
  "defect.back_camera": {
    label: PHONE_DEFECT_LABEL.back_camera,
    section: "defecte",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 15 },
  },
  "defect.biometrics": {
    label: PHONE_DEFECT_LABEL.biometrics,
    section: "defecte",
    kinds: DEDUCTION,
    default: { kind: "percent", value: 20 },
    help: "Face ID nu se repară la iPhone fără Apple — de regulă scădere mare.",
  },

  "setting.battery_threshold": {
    label: "Pragul bateriei (%)",
    section: "setari",
    kinds: ["fixed"],
    default: { kind: "fixed", value: 80 },
    setting: true,
    globalOnly: true,
    help: "Sub acest procent se aplică „Baterie sub prag”.",
  },
  "setting.voucher_bonus": {
    label: "Bonus voucher (%)",
    section: "setari",
    kinds: ["percent"],
    default: { kind: "percent", value: 10 },
    setting: true,
    help: "Cât în plus primește clientul dacă alege voucher pe site în loc de bani.",
  },
  "setting.min_offer": {
    label: "Ofertă minimă (lei)",
    section: "setari",
    kinds: ["fixed"],
    default: { kind: "fixed", value: 100 },
    setting: true,
    help: "Sub această sumă nu facem ofertă.",
  },
  "setting.rounding": {
    label: "Rotunjire în jos (lei)",
    section: "setari",
    kinds: ["fixed"],
    default: { kind: "fixed", value: 10 },
    setting: true,
    globalOnly: true,
  },
} as const satisfies Record<string, RuleDef>

export type RuleKey = keyof typeof RULE_DEFS
export const RULE_KEYS = Object.keys(RULE_DEFS) as RuleKey[]

/** Un rând din tabelul `buyback_rule`. */
export type Rule = {
  key: string
  scope: RuleScope
  /** Brandul (orice majuscule) sau id-ul dispozitivului; "" la global. */
  scope_value: string
  kind: RuleKind
  value: number
}

/** Răspunsurile → cheile de reguli care se aplică. */
export function activeRuleKeys(brand: string, answers: Answers, batteryThreshold: number): RuleKey[] {
  const q = questionsFor(brand)
  const keys: RuleKey[] = []
  if (answers.network === "foreign") keys.push("network.foreign")
  if (answers.network === "carrier") keys.push("network.carrier")
  if (answers.liquid) keys.push("liquid.yes")
  if (q.burn_in && answers.burn_in) keys.push("burn_in.yes")
  if (answers.screen !== "perfect") keys.push(`screen.${answers.screen}` as RuleKey)
  if (answers.case !== "perfect") keys.push(`case.${answers.case}` as RuleKey)
  if (q.battery && typeof answers.battery === "number" && answers.battery < batteryThreshold) {
    keys.push("battery.low")
  }
  for (const d of new Set(answers.display_defects)) keys.push(`display.${d}` as RuleKey)
  for (const d of new Set(answers.phone_defects)) keys.push(`defect.${d}` as RuleKey)
  return keys
}
