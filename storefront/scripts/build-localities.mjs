/**
 * Generează `src/lib/localities/data.json` din nomenclatorul SIRUTA publicat de
 * catalin87/baza-de-date-localitati-romania (derivat din data.gov.ro).
 *
 * Se rulează manual, la nevoie (`node scripts/build-localities.mjs`), nu la
 * build: lista se schimbă o dată la câțiva ani, iar un fetch în pipeline-ul de
 * deploy ar lega un site de producție de disponibilitatea GitHub-ului.
 *
 * Sursa are trei probleme pe care le reparăm aici:
 *  1. diacriticele sunt cu sedilă (ş, ţ) în loc de virgulă dedesubt (ș, ț);
 *  2. codurile poștale sunt numere, deci cele care încep cu 0 au pierdut-o;
 *  3. județele n-au diacritice („Bistrita-Nasaud"), dar au codul auto — pe care
 *     îl aducem la numele canonic din `@lib/util/counties`.
 */

const SOURCE =
  "https://raw.githubusercontent.com/catalin87/baza-de-date-localitati-romania/master/date/localitati.json"

/** Aceeași ordine ca `RO_COUNTIES` — indexul ajunge în fișierul generat. */
const COUNTIES = [
  "Alba", "Arad", "Argeș", "Bacău", "Bihor", "Bistrița-Năsăud", "Botoșani",
  "Brașov", "Brăila", "București", "Buzău", "Caraș-Severin", "Călărași",
  "Cluj", "Constanța", "Covasna", "Dâmbovița", "Dolj", "Galați", "Giurgiu",
  "Gorj", "Harghita", "Hunedoara", "Ialomița", "Iași", "Ilfov", "Maramureș",
  "Mehedinți", "Mureș", "Neamț", "Olt", "Prahova", "Satu Mare", "Sălaj",
  "Sibiu", "Suceava", "Teleorman", "Timiș", "Tulcea", "Vaslui", "Vâlcea",
  "Vrancea",
]

const BY_CODE = {
  ab: "Alba", ar: "Arad", ag: "Argeș", bc: "Bacău", bh: "Bihor",
  bn: "Bistrița-Năsăud", bt: "Botoșani", bv: "Brașov", br: "Brăila",
  b: "București", bz: "Buzău", cs: "Caraș-Severin", cl: "Călărași", cj: "Cluj",
  ct: "Constanța", cv: "Covasna", db: "Dâmbovița", dj: "Dolj", gl: "Galați",
  gr: "Giurgiu", gj: "Gorj", hr: "Harghita", hd: "Hunedoara", il: "Ialomița",
  is: "Iași", if: "Ilfov", mm: "Maramureș", mh: "Mehedinți", ms: "Mureș",
  nt: "Neamț", ot: "Olt", ph: "Prahova", sm: "Satu Mare", sj: "Sălaj",
  sb: "Sibiu", sv: "Suceava", tr: "Teleorman", tm: "Timiș", tl: "Tulcea",
  vs: "Vaslui", vl: "Vâlcea", vn: "Vrancea",
}

/**
 * Peste acest prag localitatea are sigur mai multe coduri poștale (unul pe
 * stradă sau pe grup de străzi), iar cel din nomenclator e doar al centrului.
 * Sub prag codul e unic pe localitate, deci îl putem completa automat fără să
 * riscăm o factură cu date greșite.
 */
const SINGLE_ZIP_MAX_POP = 10000

/** Sedila (ş/ţ) e forma veche; standardul românesc cere virgulă dedesubt. */
const commaBelow = (s) =>
  s.replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/Ş/g, "Ș").replace(/Ţ/g, "Ț")

const res = await fetch(SOURCE)
if (!res.ok) {
  console.error(`Sursa a răspuns ${res.status}`)
  process.exit(1)
}
const raw = await res.json()

const countyIndex = new Map(COUNTIES.map((c, i) => [c, i]))
const rows = []
const skipped = []

for (const item of raw) {
  const county = BY_CODE[String(item.auto ?? "").toLowerCase()]
  const idx = county === undefined ? undefined : countyIndex.get(county)
  const name = commaBelow(String(item.diacritice || item.nume || "").trim())

  if (!name || idx === undefined) {
    skipped.push(item)
    continue
  }

  // Capitala vine cu populația 0 din sursă; fără corecție ar cădea la coada
  // listei, sub satele omonime.
  const pop =
    name === "București" ? 2_000_000 : Number(item.populatie) || 0
  const zip =
    pop > 0 && pop < SINGLE_ZIP_MAX_POP && item.zip
      ? String(item.zip).padStart(6, "0")
      : ""

  rows.push([name, idx, zip, pop])
}

// Sectoarele Bucureștiului lipsesc din nomenclatorul de localități, dar sunt
// exact ce cere curierul la „localitate" pentru o adresă din capitală.
// Le punem cu populație mare ca să iasă imediat sub „București" în listă.
for (let s = 1; s <= 6; s++) {
  rows.push([`Sectorul ${s}`, countyIndex.get("București"), "", 1_500_000 - s])
}

// Ordinea din fișier e ordinea de afișare: localitățile mari primele, ca
// „Iași" municipiul să bată satul „Iași" din Brașov la aceeași căutare.
rows.sort((a, b) => b[3] - a[3] || a[0].localeCompare(b[0], "ro"))

const out = {
  counties: COUNTIES,
  // [nume, index județ, cod poștal ("" dacă e ambiguu)]
  localities: rows.map(([name, idx, zip]) => [name, idx, zip]),
}

const target = new URL("../src/lib/localities/data.json", import.meta.url)
const { writeFileSync } = await import("node:fs")
writeFileSync(target, JSON.stringify(out))

const withZip = out.localities.filter((l) => l[2]).length
console.log(
  `${out.localities.length} localități (${withZip} cu cod poștal unic), ` +
    `${skipped.length} ignorate → ${target.pathname}`
)
