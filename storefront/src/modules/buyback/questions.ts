import type { BuybackGrade } from "@lib/data/buyback"

/**
 * Textele evaluării. Cheile trebuie să fie aceleași ca în backend
 * (`backend/src/lib/buyback/catalog.ts`) — backend-ul respinge orice altă
 * valoare.
 */

export const GRADE_OPTIONS: { value: BuybackGrade; label: string; screen: string; case: string }[] = [
  {
    value: "perfect",
    label: "Perfect",
    screen: "Nicio zgârietură, nici privit în lumină.",
    case: "Ca nou: fără zgârieturi, lovituri sau urme pe ramă.",
  },
  {
    value: "light",
    label: "Urme ușoare de folosire",
    screen: "Câteva zgârieturi fine, vizibile doar în lumină, cu ecranul stins.",
    case: "Zgârieturi fine, greu de observat de la distanța normală.",
  },
  {
    value: "visible",
    label: "Urme vizibile de folosire",
    screen: "Zgârieturi pe care le vezi cu ochiul liber și le simți la atingere.",
    case: "Zgârieturi vizibile, mici lovituri sau decolorări pe ramă.",
  },
  {
    value: "worn",
    label: "Uzat",
    screen: "Zgârieturi adânci și multe, vizibile și cu ecranul aprins.",
    case: "Lovituri și zgârieturi adânci, colțuri ciobite.",
  },
  {
    value: "broken",
    label: "Spart sau ciobit",
    screen: "Sticla e crăpată, ciobită sau are fisuri.",
    case: "Spatele e crăpat sau rama e îndoită.",
  },
]

export const NETWORK_OPTIONS = [
  { value: "unlocked", label: "Deblocat", help: "Merge cu cartela oricărui operator." },
  { value: "carrier", label: "Blocat pe Vodafone, Orange sau Digi", help: "Cumpărat cu abonament și încă blocat." },
  { value: "foreign", label: "Blocat pe un operator din străinătate", help: "" },
] as const

export const DISPLAY_DEFECT_OPTIONS = [
  { value: "unresponsive", label: "Nu răspunde la atingere", help: "Zone în care atingerea nu funcționează." },
  { value: "yellowed", label: "Ecran îngălbenit", help: "Albul bate în galben sau are pete." },
  { value: "pressure_points", label: "Puncte de presiune", help: "Pete luminoase sau umbre pe ecran." },
  { value: "dead_pixels", label: "Pixeli „morți”", help: "Puncte care rămân negre sau colorate." },
] as const

export const PHONE_DEFECT_OPTIONS = [
  { value: "muffled_sound", label: "Se aude încet sau înfundat", help: "Difuzorul sau casca." },
  { value: "front_camera", label: "Camera din față (selfie)", help: "Nu pornește, imagine neclară sau pete." },
  { value: "back_camera", label: "Camera din spate", help: "Nu pornește, nu focalizează sau are pete." },
  { value: "biometrics", label: "Senzor de amprentă / Face ID", help: "Nu recunoaște sau nu se poate configura." },
  { value: "battery_swollen", label: "Baterie umflată", help: "Ecranul sau spatele s-a ridicat." },
  { value: "other", label: "Alte probleme", help: "Nu pornește, butoane defecte, nu încarcă." },
] as const

export const lei = (n: number) => `${n.toLocaleString("ro-RO")} lei`

/** „256GB” → „256 GB”. */
export const storageLabel = (s: string) => s.replace(/(\d)(GB|TB)$/, "$1 $2")
