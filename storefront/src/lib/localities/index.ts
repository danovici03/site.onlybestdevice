/**
 * Căutare în nomenclatorul localităților din România (SIRUTA).
 *
 * ATENȚIE: se folosește **doar pe server** (route handler / server component).
 * `data.json` are ~360 KB; importat într-un client component ar ajunge întreg
 * în bundle-ul de checkout. Clientul îl interoghează prin `/api/localities`.
 *
 * Fișierul se regenerează cu `node scripts/build-localities.mjs`.
 */

import { RO_COUNTIES } from "@lib/util/counties"
import data from "./data.json"

export type Locality = {
  name: string
  county: string
  /** Doar unde e neambiguu (sub 10.000 de locuitori); altfel șir gol. */
  postalCode: string
}

type Row = [name: string, countyIndex: number, postalCode: string]

const ROWS = data.localities as Row[]

// Indexul din fișier trimite în `data.counties`, care e o copie a listei
// canonice. Dacă cele două ies din sincron (s-a editat una fără să se
// regenereze cealaltă), județele s-ar decala tăcut cu o poziție.
if (process.env.NODE_ENV !== "production") {
  const mismatch = data.counties.findIndex((c, i) => c !== RO_COUNTIES[i])
  if (mismatch !== -1 || data.counties.length !== RO_COUNTIES.length) {
    throw new Error(
      "lib/localities: data.json e generat cu altă listă de județe decât " +
        "RO_COUNTIES. Rulează `node scripts/build-localities.mjs`."
    )
  }
}

/** Fără diacritice, litere mici, doar alfanumerice — ca la județe. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Formele normalizate, calculate o singură dată la primul import. 13.857 de
 * `normalize` la fiecare cerere ar fi ~10 ms irosiți pe un endpoint pe care
 * clientul îl lovește la fiecare tastă.
 */
const NORMALIZED = ROWS.map((row) => normalize(row[0]))

/** `RO_COUNTIES` e un tuplu readonly; `indexOf` are nevoie de `string[]`. */
const COUNTY_INDEX: readonly string[] = RO_COUNTIES

const toLocality = (row: Row): Locality => ({
  name: row[0],
  county: RO_COUNTIES[row[1]],
  postalCode: row[2],
})

/**
 * Localitățile care conțin `query`, cele mai populate primele (ordinea din
 * fișier). Potrivirile de la începutul numelui trec înaintea celor din
 * interior, ca „Iași" să nu fie împins de „Belcești" la căutarea „ies".
 *
 * `county` nu filtrează, ci doar avantajează: dacă județul din formular e
 * greșit, un filtru dur ar face localitatea corectă să pară inexistentă.
 */
export function searchLocalities(
  query: string,
  { county, limit = 12 }: { county?: string; limit?: number } = {}
): Locality[] {
  const q = normalize(query)
  if (!q) return []

  const countyIndex = county ? COUNTY_INDEX.indexOf(county) : -1

  const buckets: number[][] = [[], [], [], []]
  const topBucket = countyIndex === -1 ? 2 : 0

  for (let i = 0; i < NORMALIZED.length; i++) {
    const at = NORMALIZED[i].indexOf(q)
    if (at === -1) continue

    const sameCounty = countyIndex !== -1 && ROWS[i][1] === countyIndex
    // 0: județul cerut + început de nume, 1: județul cerut, 2: început de
    // nume, 3: restul.
    const bucket = (sameCounty ? 0 : 2) + (at === 0 ? 0 : 1)
    buckets[bucket].push(i)

    // Bucket-ul de top e deja cel mai bun rezultat posibil; când s-a umplut,
    // restul fișierului n-ar mai schimba ce afișăm.
    if (buckets[topBucket].length >= limit) break
  }

  const picked: number[] = []
  for (const bucket of buckets) {
    for (const i of bucket) {
      if (picked.length >= limit) break
      picked.push(i)
    }
  }

  return picked.map((i) => toLocality(ROWS[i]))
}

/**
 * Localitatea cu numele dat, pentru aducerea la forma canonică a unei valori
 * venite din altă parte (antetul de geolocalizare Vercel dă „Bucharest",
 * „Cluj-Napoca", fără diacritice). Întoarce `null` dacă nu recunoaște nimic.
 */
export function findLocality(
  name?: string | null,
  county?: string | null
): Locality | null {
  if (!name) return null

  const n = normalize(name)
  if (!n) return null

  const countyIndex = county ? COUNTY_INDEX.indexOf(county) : -1

  let fallback: Row | null = null

  for (let i = 0; i < NORMALIZED.length; i++) {
    if (NORMALIZED[i] !== n) continue
    if (countyIndex === -1 || ROWS[i][1] === countyIndex) {
      return toLocality(ROWS[i])
    }
    // Nume corect, județ care nu se potrivește: îl ținem doar dacă nu apare
    // nimic mai bun. Ordinea din fișier ne dă oricum localitatea cea mai mare.
    fallback = fallback ?? ROWS[i]
  }

  return fallback ? toLocality(fallback) : null
}
