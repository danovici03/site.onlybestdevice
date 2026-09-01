/**
 * Interogarea registrului public ANAF pentru datele unei firme după CUI.
 *
 * ATENȚIE: doar pe server (route handler). Serviciul ANAF nu trimite anteturi
 * CORS, deci din browser cererea nici n-ar pleca, iar `findLocality` aduce cu
 * el nomenclatorul de 360 KB.
 *
 * Serviciul e gratuit și fără cheie, dar acceptă o singură cerere pe secundă
 * pentru toată lumea de la aceeași ieșire — de aici cache-ul și serializarea
 * de mai jos. Documentația: https://static.anaf.ro/static/10/Anaf/Informatii_R/
 * documentatie_SW_PlatitorTVA_v9.txt
 */

import { findLocality } from "@lib/localities"
import { matchCounty } from "@lib/util/counties"
import { isValidCui, normalizeCui, type CompanyFiscal } from "@lib/util/cui"

/** v9 e singura versiune încă activă; v8 și mai vechi întorc 404. */
const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva"

/** ANAF răspunde de obicei în sub o secundă; peste atât nu blocăm checkout-ul. */
const TIMEOUT_MS = 8000

/** Intervalul minim între două cereri, impus de ANAF (1/secundă). */
const MIN_INTERVAL_MS = 1200

/** Datele firmei sunt practic statice; le ținem o zi în memoria instanței. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type CompanyAddress = {
  address_1: string
  city: string
  /** Numele canonic al județului sau `""` dacă ANAF a dat ceva nerecunoscut. */
  province: string
  postal_code: string
}

export type CompanyDetails = CompanyFiscal & {
  address: CompanyAddress
  /** Radiată sau declarată inactivă — comanda merită un avertisment. */
  inactive: boolean
  /** TVA la încasare: exigibilitatea TVA-ului se schimbă pentru vânzător. */
  vatOnCollection: boolean
  /** Înregistrată în RO e-Factura (dincolo de obligația B2B generală). */
  eInvoice: boolean
}

export class AnafError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/* ------------------------------------------------------------------ */
/* Normalizări de text                                                 */
/* ------------------------------------------------------------------ */

/**
 * ANAF scrie diacriticele cu sedilă (Ş, Ţ) — forma turcească, moștenită din
 * Windows-1250. Nomenclatorul nostru și restul site-ului folosesc virgula
 * (Ș, Ț), deci fără conversie „Bistriţa" n-ar mai fi găsit „Bistrița".
 */
const fixDiacritics = (value: string): string =>
  value
    .replace(/Ş/g, "Ș")
    .replace(/ş/g, "ș")
    .replace(/Ţ/g, "Ț")
    .replace(/ţ/g, "ț")

const clean = (value?: string | null): string =>
  fixDiacritics((value ?? "").trim()).replace(/\s+/g, " ")

/**
 * ANAF scrie localitatea împreună cu unitatea de care aparține: „Sector 6 Mun.
 * Bucureşti", „Coldău Orş. Beclean", „Mun. Bistriţa". Nomenclatorul SIRUTA are
 * doar numele („Coldău"), iar sectoarele apar ca „Sectorul N" — fără curățarea
 * asta, `LocalitySelect` rămâne cu un oraș pe care nu-l recunoaște.
 */
const cleanLocality = (value: string): string => {
  const sector = value.match(/sector(?:ul)?\s*(\d)/i)
  if (sector) return `Sectorul ${sector[1]}`

  return value
    .replace(/^(mun\.|municipiul|or[șs]\.|ora[șs]ul|com\.|comuna|sat)\s+/i, "")
    .replace(/\s+(mun\.|municipiul|or[șs]\.|ora[șs]ul|com\.|comuna)\s+.+$/i, "")
    .trim()
}

/** „MUNICIPIUL BUCUREȘTI", „JUD. CLUJ" → numele canonic din `RO_COUNTIES`. */
const cleanCounty = (name: string, autoCode: string): string => {
  const stripped = name.replace(/^(jude[țt]ul|jud\.|municipiul|mun\.)\s+/i, "")
  return matchCounty(stripped) || matchCounty(autoCode) || ""
}

/**
 * ANAF întoarce codul poștal fără zeroul din față („60787" pentru 060787),
 * pentru că îl ține ca număr. Curierii îl vor pe cel de 6 cifre.
 */
const cleanPostalCode = (value: string): string => {
  const digits = value.replace(/\D/g, "")
  if (!digits || Number(digits) === 0) return ""
  return digits.length < 6 ? digits.padStart(6, "0") : digits
}

/* ------------------------------------------------------------------ */
/* Maparea adresei                                                     */
/* ------------------------------------------------------------------ */

type AnafAddress = Record<string, string | undefined>

/**
 * Adresa se compune din câmpuri separate (`*denumire_Strada`, `*numar_Strada`,
 * `*detalii_Adresa`), fiecare cu prefixul secțiunii: `s` la sediul social, `d`
 * la domiciliul fiscal.
 */
const buildAddress = (raw: AnafAddress, p: "s" | "d"): CompanyAddress => {
  const street = clean(raw[`${p}denumire_Strada`])
  const number = clean(raw[`${p}numar_Strada`])
  const details = clean(raw[`${p}detalii_Adresa`])

  // La adresele rurale strada lipsește și rămâne doar numărul; atunci „Nr." e
  // începutul liniei, deci se scrie cu majusculă.
  const line = [
    street && number
      ? `${street}${/^nr\.?/i.test(number) ? " " : " nr. "}${number}`
      : street || (number ? `Nr. ${number}` : ""),
    details,
  ]
    .filter(Boolean)
    .join(", ")

  return {
    address_1: line,
    city: cleanLocality(clean(raw[`${p}denumire_Localitate`])),
    province: cleanCounty(
      clean(raw[`${p}denumire_Judet`]),
      clean(raw[`${p}cod_JudetAuto`])
    ),
    postal_code: cleanPostalCode(clean(raw[`${p}cod_Postal`])),
  }
}

/**
 * Sediul social e adresa care trebuie să apară pe factură. Domiciliul fiscal
 * (unde firma e administrată efectiv) intră doar ca plasă de siguranță, câmp
 * cu câmp: la firmele mari, sediul social vine adesea fără cod poștal.
 */
const resolveAddress = (found: Record<string, any>): CompanyAddress => {
  const legal = buildAddress(found.adresa_sediu_social ?? {}, "s")
  const fiscal = buildAddress(found.adresa_domiciliu_fiscal ?? {}, "d")

  const merged: CompanyAddress = {
    address_1: legal.address_1 || fiscal.address_1,
    city: legal.city || fiscal.city,
    province: legal.province || fiscal.province,
    postal_code: legal.postal_code || fiscal.postal_code,
  }

  // Localitatea trece prin nomenclator ca să ajungă la forma pe care o
  // acceptă select-ul din checkout — și ca să-i luăm codul poștal când firma
  // e într-o comună unde codul e unic și ANAF nu-l are.
  const locality = findLocality(merged.city, merged.province || undefined)
  if (locality) {
    merged.city = locality.name
    merged.province = merged.province || locality.county
    merged.postal_code = merged.postal_code || locality.postalCode
  }

  return merged
}

/* ------------------------------------------------------------------ */
/* Apelul propriu-zis                                                  */
/* ------------------------------------------------------------------ */

const cache = new Map<string, { at: number; value: CompanyDetails | null }>()

/** Momentul ultimei cereri către ANAF, pentru respectarea unei cereri/secundă. */
let lastCallAt = 0
/** Coada de așteptare, ca două cereri simultane să nu plece în aceeași clipă. */
let queue: Promise<unknown> = Promise.resolve()
let waiting = 0

/** Data cerută de ANAF (situația fiscală la zi), în fusul României. */
const today = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const callAnaf = async (cui: string): Promise<Record<string, any> | null> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(ANAF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Fără User-Agent, ANAF răspunde intermitent cu 403.
        "User-Agent": "onlybestdevice.ro checkout",
      },
      body: JSON.stringify([{ cui: Number(cui), data: today() }]),
      cache: "no-store",
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new AnafError(
        "Registrul ANAF nu răspunde. Poți completa datele manual.",
        502
      )
    }

    const body = await res.json()
    return body?.found?.[0] ?? null
  } catch (err) {
    if (err instanceof AnafError) throw err
    throw new AnafError(
      "Registrul ANAF nu răspunde. Poți completa datele manual.",
      504
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Datele firmei cu CUI-ul dat, sau `null` dacă ANAF nu o cunoaște.
 *
 * Aruncă `AnafError` doar când vina e a noastră sau a serviciului; un CUI
 * inexistent e un rezultat valid, nu o eroare.
 */
export async function lookupCompany(
  input: string
): Promise<CompanyDetails | null> {
  const cui = normalizeCui(input)
  if (!cui) throw new AnafError("Introdu CUI-ul firmei (doar cifre).", 400)
  if (!isValidCui(cui)) {
    throw new AnafError("CUI-ul nu pare valid — verifică cifrele.", 400)
  }

  const hit = cache.get(cui)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  // Peste câțiva clienți care caută simultan, coada ar întârzia mai mult decât
  // completarea manuală; mai bine spunem pe loc că e aglomerat.
  if (waiting > 4) {
    throw new AnafError(
      "Prea multe verificări în acest moment. Încearcă din nou în câteva secunde.",
      429
    )
  }

  waiting++
  const run = queue.then(async () => {
    const since = Date.now() - lastCallAt
    if (since < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - since)
    lastCallAt = Date.now()
    return callAnaf(cui)
  })
  // Coada trebuie să avanseze și când cererea curentă eșuează.
  queue = run.catch(() => {})

  let found: Record<string, any> | null
  try {
    found = await run
  } finally {
    waiting--
  }

  const details = found ? toDetails(cui, found) : null
  cache.set(cui, { at: Date.now(), value: details })
  return details
}

const toDetails = (
  cui: string,
  found: Record<string, any>
): CompanyDetails => {
  const general = found.date_generale ?? {}
  const inactiv = found.stare_inactiv ?? {}

  return {
    cui,
    name: clean(general.denumire),
    regCom: clean(general.nrRegCom),
    vatPayer: found.inregistrare_scop_Tva?.scpTVA === true,
    vatOnCollection:
      found.inregistrare_RTVAI?.statusTvaIncasare === true,
    eInvoice: general.statusRO_e_Factura === true,
    inactive:
      inactiv.statusInactivi === true || Boolean(clean(inactiv.dataRadiere)),
    address: resolveAddress(found),
  }
}
