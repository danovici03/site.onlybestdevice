/**
 * Extrage tabelul de specificații lipit în `product.description` și îl mută în
 * `product.metadata.specs` (obiect { "Etichetă": "valoare" }, în ordinea sursei).
 *
 * De ce e nevoie de euristici: descrierile importate conțin fișe de specificații
 * ca linii ALTERNANTE etichetă/valoare, fără separator:
 *
 *     Caracteristici tehnice   <- titlu de secțiune (decalează alternanța!)
 *     Conectare
 *     Bluetooth
 *     Putere totala
 *     4.2 W
 *
 * Titlurile de secțiune schimbă paritatea, iar copy-ul de marketing în linii
 * scurte (stil Apple) se împerechează la fel de bine ca un tabel real. De aceea:
 *   1. construim un dicționar de etichete sigure (cele urmate des de „Da”/„12 GB”);
 *   2. la fiecare pas alegem alinierea cu scor mai bun (etichete pe poziții pare,
 *      valori pe impare) — „sari o linie” înseamnă titlu de secțiune;
 *   3. păstrăm doar secvențele ancorate în etichete cunoscute.
 *
 * Rulare (implicit NU scrie nimic — produce doar raportul CSV):
 *   cd backend && yarn medusa exec ./src/scripts/extract-product-specs.ts
 *   APPLY=1 ...                 scrie în metadata
 *   APPLY=1 CLEAN_DESCRIPTION=1 golește descrierea acolo unde e STRICT tabel
 *
 * Idempotent: re-rularea produce același rezultat.
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import fs from "fs"
import path from "path"

const APPLY = !!process.env.APPLY
const CLEAN_DESCRIPTION = !!process.env.CLEAN_DESCRIPTION

type DbProduct = {
  id: string
  handle: string
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ")
const lc = (s: string) => norm(s).toLowerCase()

/** „Da”, „12 GB”, „4.2 W”, „9.4 x 7.8 x 4.2 cm” — apar doar ca valoare. */
const valueLike = (s: string) =>
  /^(da|nu|n\/a)$/i.test(s) ||
  /^[\d.,]+\s*(gb|tb|mb|mah|w|hz|khz|ghz|mm|cm|kg|g|mp|mpx|ore|h|inch|"|%|bit|fps|v|a)?$/i.test(
    s
  ) ||
  /^\d+(\.\d+)?\s*x\s*\d/i.test(s)

/** Frază de marketing, nu celulă de tabel. */
const looksProse = (s: string) =>
  s.length > 90 || (/[.!?]$/.test(s) && s.split(/\s+/).length > 8)

const linesOf = (d: string | null) =>
  (d || "").split(/\n/).map(norm).filter(Boolean)

/**
 * Titluri de secțiune: nu au valoare proprie, doar deschid un bloc și decalează
 * alternanța. Lista e derivată din date — sunt singurele linii frecvente urmate
 * mereu de o altă etichetă (ex. „Specificatii” → „Caracteristici tehnice”).
 * Atenție: „Conectivitate”, „Senzori”, „Functii”, „Tip” NU sunt aici — acelea
 * sunt etichete reale, cu liste drept valoare.
 */
const SECTION_HEADERS = new Set([
  "specificatii",
  "specificatii tehnice",
  "caracteristici generale",
  "caracteristici tehnice",
  "caracteristici",
  "general",
  "descriere",
])

/** Etichete sigure: linii urmate frecvent de o valoare, pe tot catalogul. */
function buildLabelDict(products: DbProduct[]): Set<string> {
  const st = new Map<string, { n: number; val: number }>()
  for (const p of products) {
    const L = linesOf(p.description)
    for (let i = 0; i < L.length - 1; i++) {
      const k = lc(L[i])
      if (k.length > 40 || looksProse(L[i])) continue
      if (!st.has(k)) st.set(k, { n: 0, val: 0 })
      const s = st.get(k)!
      s.n++
      if (valueLike(L[i + 1])) s.val++
    }
  }
  const dict = new Set<string>()
  for (const [k, s] of st) {
    if (s.n >= 4 && s.val / s.n >= 0.3 && !valueLike(k)) dict.add(k)
  }
  return dict
}

function parsePairs(
  description: string | null,
  dict: Set<string>
): [string, string][] {
  const L = linesOf(description)
  const pairs: [string, string][] = []
  const isLabelish = (s: string) =>
    dict.has(lc(s)) ||
    (!valueLike(s) && !looksProse(s) && s.length <= 40 && s.split(/\s+/).length <= 6)

  let i = 0
  while (i < L.length - 1) {
    if (looksProse(L[i]) || SECTION_HEADERS.has(lc(L[i]))) {
      i++ // titlul de secțiune se sare — altfel decalează toată alternanța
      continue
    }
    // Aliniere corectă = etichete pe poziții pare, valori pe impare.
    const score = (off: number) => {
      let s = 0
      for (let k = 0; k + off < 12 && i + off + k < L.length; k++) {
        const line = L[i + off + k]
        const labelPos = k % 2 === 0
        if (dict.has(lc(line))) s += labelPos ? 1 : -1
        if (valueLike(line)) s += labelPos ? -1 : 1
      }
      return s
    }
    if (score(1) > score(0)) {
      i++ // titlu de secțiune sau valoare orfană
      continue
    }
    const a = L[i]
    const b = L[i + 1]
    if (isLabelish(a) && !looksProse(b) && lc(a) !== lc(b)) {
      pairs.push([a, b])
      i += 2
    } else {
      i++
    }
  }
  return pairs
}

/** Etichete „ancoră” pentru care avem o cheie canonică (folosite la sortare/filtre). */
const CANON: [RegExp, string][] = [
  [/^(diagonal[aă]( display| ecran)?|dimensiune ecran|diagonala \(inch\))$/i, "display_size"],
  [/^(tip display|tehnologie display|tip ecran)$/i, "display_type"],
  [/^(rezolutie( display| ecran)?|rezolutie \(pixeli\))$/i, "display_resolution"],
  [/^(rat[aă] (de )?(refresh|improspatare))$/i, "display_refresh"],
  [/^(model procesor|procesor|chipset)$/i, "cpu"],
  [/^(num[aă]r nuclee)$/i, "cpu_cores"],
  [/^(memorie ram|capacitate memorie ram)$/i, "ram"],
  [/^(memorie interna|capacitate stocare|capacitate memorie)$/i, "storage"],
  [/^(sistem de operare|versiune sistem operare)$/i, "os"],
  [/^(capacitate acumulator|capacitate baterie|tip (baterie|acumulator))$/i, "battery"],
  [/^(autonomie|autonomie (acumulator|baterie))$/i, "battery_life"],
  [/^(rezolutie camera principala)$/i, "camera_main"],
  [/^(rezolutie camera frontala)$/i, "camera_front"],
  [/^(rezolutie video)$/i, "video"],
  [/^(versiune bluetooth|bluetooth)$/i, "bluetooth"],
  [/^(standard wi-?fi|wi-?fi)$/i, "wifi"],
  [/^(sloturi sim|dual sim|tip sim)$/i, "sim"],
  [/^(culoare)$/i, "color"],
  [/^(greutate|greutate \(kg\))$/i, "weight"],
  [/^(dimensiuni)$/i, "dimensions"],
  [/^(sar \(w\/kg\))$/i, "sar"],
  [/^(an aparitie)$/i, "year"],
  [/^(ean|barcode)$/i, "ean"],
  [/^(porturi|conectori)$/i, "ports"],
  [/^(protectie|rezistent la apa)$/i, "protection"],
  [/^(tehnologie)$/i, "network"],
  [/^(material)$/i, "material"],
]

const canon = (label: string): string | null => {
  const l = lc(label)
  for (const [re, key] of CANON) if (re.test(l)) return key
  return null
}

/**
 * Păstrează doar perechile ancorate în etichete cunoscute: în orice fereastră de
 * 4 perechi consecutive trebuie să existe măcar una recunoscută. Fără asta,
 * copy-ul de marketing în linii scurte trece drept tabel.
 */
function confidentPairs(
  pairs: [string, string][],
  dict: Set<string>
): [string, string][] {
  /* eslint-disable no-param-reassign */
  // O „valoare” care e ea însăși etichetă cunoscută înseamnă că am împerecheat
  // două rânduri de titlu (ex. „Caracteristici generale” = „Continut pachet”).
  pairs = pairs.filter(
    ([, v]) => !SECTION_HEADERS.has(lc(v)) && !dict.has(lc(v)) && canon(v) === null
  )
  // Sub-titluri prinse drept valoare: „Procesor” = „Tip procesor”. O valoare
  // reală aproape mereu conține o cifră sau nu începe cu un cuvânt de etichetă.
  pairs = pairs.filter(
    ([, v]) =>
      /\d/.test(v) ||
      !/^(tip|model|rezolutie|capacitate|numar|versiune|memorie|dimensiune|camera|standard)\b/i.test(
        v
      )
  )
  const known = pairs.map(
    ([l, v]) => dict.has(lc(l)) || canon(l) !== null || valueLike(v)
  )
  const kept = pairs.filter((_, i) => {
    for (let j = Math.max(0, i - 3); j < Math.min(pairs.length, i + 4); j++) {
      if (known[j]) return true
    }
    return false
  })
  const anchors = kept.filter(([l]) => dict.has(lc(l)) || canon(l) !== null).length
  return anchors >= 3 && kept.length >= 5 ? kept : []
}

const csvCell = (v: string) => `"${String(v).replace(/"/g, '""')}"`

export default async function extractProductSpecs({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: all } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "description", "metadata"],
    pagination: { take: 5000, skip: 0 },
  } as any)

  const products = all as DbProduct[]

  // Dicționarul-sămânță prinde doar etichetele urmate de valori scurte („Da”,
  // „12 GB”); cele cu liste drept valoare („Senzori: Accelerometru Giroscop…”)
  // îi scapă, iar un dicționar rar face detecția de paritate nesigură pe
  // produsele cu multe sub-secțiuni. Îl densificăm cu etichetele extrase din
  // produsele parsate cu încredere mare, apoi re-parsăm tot.
  const dict = buildLabelDict(products)
  const seedSize = dict.size

  const labelHits = new Map<string, number>()
  for (const p of products) {
    const kept = confidentPairs(parsePairs(p.description, dict), dict)
    if (kept.length < 8) continue
    const anchors = kept.filter(([l]) => dict.has(lc(l)) || canon(l) !== null).length
    if (anchors / kept.length < 0.5) continue // parsare prea nesigură ca sursă
    for (const [label] of kept) {
      const k = lc(label)
      labelHits.set(k, (labelHits.get(k) ?? 0) + 1)
    }
  }
  for (const [label, n] of labelHits) {
    if (n >= 3 && !valueLike(label) && !SECTION_HEADERS.has(label)) dict.add(label)
  }
  logger.info(
    `Dicționar de etichete: ${seedSize} (sămânță) → ${dict.size} (după densificare).`
  )

  const rows: string[] = [
    "incredere,handle,eticheta,cheie_canonica,valoare,descriere_golita",
  ]
  let withSpecs = 0
  let pairCount = 0
  let cleaned = 0
  let updated = 0
  let unchanged = 0

  for (const p of products) {
    const pairs = confidentPairs(parsePairs(p.description, dict), dict)
    if (!pairs.length) continue

    withSpecs++
    pairCount += pairs.length

    // Descrierea e STRICT tabel dacă nu rămâne proză după extragere.
    const proseLines = linesOf(p.description).filter(looksProse).length
    const strictTable = proseLines <= 1

    const specs: Record<string, string> = {}
    for (const [label, value] of pairs) {
      // Etichete duplicate (aceeași etichetă în două secțiuni): păstrăm prima.
      if (!(label in specs)) specs[label] = value
    }

    // Proporția de etichete recunoscute — produsele cu scor mic au sub-secțiuni
    // imbricate și sunt cele care merită revizuite manual întâi.
    const anchors = pairs.filter(([l]) => dict.has(lc(l)) || canon(l) !== null).length
    const confidence = (anchors / pairs.length).toFixed(2)

    for (const [label, value] of Object.entries(specs)) {
      rows.push(
        [
          confidence,
          csvCell(p.handle),
          csvCell(label),
          csvCell(canon(label) ?? ""),
          csvCell(value),
          strictTable && CLEAN_DESCRIPTION ? "DA" : "",
        ].join(",")
      )
    }
    if (strictTable) cleaned++

    const prev = (p.metadata ?? {}) as Record<string, unknown>
    const next: Record<string, unknown> = { ...prev, specs }
    const specsChanged = JSON.stringify(prev.specs) !== JSON.stringify(specs)

    const update: Record<string, unknown> = { metadata: next }
    if (CLEAN_DESCRIPTION && strictTable) update.description = ""

    if (!specsChanged && !(CLEAN_DESCRIPTION && strictTable && p.description)) {
      unchanged++
      continue
    }
    if (!APPLY) {
      updated++
      continue
    }
    await updateProductsWorkflow(container).run({
      input: { selector: { id: p.id }, update: update as any },
    })
    updated++
  }

  const out = path.join(process.cwd(), "specs-report.csv")
  fs.writeFileSync(out, rows.join("\n"), "utf8")

  logger.info(
    `${APPLY ? "" : "[DRY-RUN] "}Produse cu specificații: ${withSpecs}/${products.length}, perechi: ${pairCount}.`
  )
  logger.info(
    `De actualizat: ${updated}, neschimbate: ${unchanged}. Descrieri strict-tabel: ${cleaned}${
      CLEAN_DESCRIPTION ? " (se golesc)" : " (NU se ating; folosește CLEAN_DESCRIPTION=1)"
    }.`
  )
  logger.info(`Raport CSV: ${out}`)
  if (!APPLY) logger.info("Nu s-a scris nimic în DB. Rulează cu APPLY=1 după ce verifici CSV-ul.")
}
