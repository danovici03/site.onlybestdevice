/**
 * Culege perechile etichetă/valoare dintr-o pagină de produs.
 *
 * Diferența față de `extract-product-specs.ts`: acolo fișa venea ca linii de
 * text alternante, fără nicio structură, și trebuia ghicită. Aici avem pagina
 * originală, unde fișa e chiar un tabel (sau un `dl`), deci nu ghicim nimic —
 * ne apărăm doar de ce NU e fișă tehnică:
 *  - tabele de layout (o singură celulă pe rând, sau celule cu poze);
 *  - antetele de grup din fișele eMAG („Ecran", „Camera") — rânduri cu o
 *    singură celulă, adesea `colspan=2`; vocabularul nostru e plat, deci le
 *    sărim în loc să prefixăm etichetele cu ele;
 *  - copy de marketing prins într-un tabel pe două coloane.
 *
 * Ordinea din sursă se păstrează: panoul „Specificații" din storefront o
 * folosește ca ordine implicită (vezi `SPEC_PRIORITY` din product-tabs).
 */
import { children, findAll, isElement, text, type ElementNode, type Node } from "./html"

export type SpecPair = {
  label: string
  value: string
  /** Antetul de grup sub care stătea în sursă („Ecran"), pur informativ. */
  group?: string
}

/** Cheie de comparație: fără diacritice, fără punctuație, litere mici. */
export const specKey = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Ș/Ț cu virgulă (U+0218/U+021A) nu se descompun în NFD — le mapăm explicit.
    .replace(/[șş]/gi, "s")
    .replace(/[țţ]/gi, "t")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/^[\s:•\-–—]+|[\s:]+$/g, "")
    .trim()

/**
 * Eticheta plauzibilă de fișă tehnică.
 *
 * Pragurile sunt calibrate pe vocabularul existent din baza noastră: cea mai
 * lungă etichetă folosită e „Clasa eficienta energetica" (27 caractere, 4
 * cuvinte), iar cea mai scurtă „Tip" (3). Marja de mai jos lasă loc de creștere
 * fără să accepte o frază.
 */
const isLabelLike = (s: string) =>
  s.length >= 2 &&
  s.length <= 64 &&
  s.split(/\s+/).length <= 8 &&
  !/[.!?]$/.test(s) &&
  // O etichetă nu e o propoziție cu verb la persoana a doua („Alege modelul…").
  !/\b(click|vezi|afla|apasa|cumpara|comanda)\b/i.test(s)

const isValueLike = (s: string) => s.length >= 1 && s.length <= 400

/** Celulă care conține o poză/iconiță și nimic util ca text. */
const isMediaCell = (el: ElementNode) =>
  !text(el) && findAll(el, { tag: "img" }).length > 0

/**
 * Perechile dintr-un tabel, dacă tabelul e o fișă tehnică.
 *
 * Întoarce `[]` pentru tabelele de layout — cele în care majoritatea rândurilor
 * n-au exact două celule cu text. Pragul de 60% e ales ca antetele de grup
 * (rânduri cu o celulă) să nu descalifice o fișă reală: la eMAG o fișă de 30 de
 * rânduri are tipic 5-6 antete, adică ~80% rânduri bune.
 */
function pairsFromTable(table: ElementNode): SpecPair[] {
  const rows = findAll(table, { tag: "tr" })
  if (!rows.length) return []

  const out: SpecPair[] = []
  let group: string | undefined
  let good = 0

  for (const row of rows) {
    const cells = children(row).filter((c) => c.tag === "td" || c.tag === "th")
    if (!cells.length) continue

    if (cells.length === 1) {
      const header = clean(text(cells[0]))
      if (header && isLabelLike(header)) group = header
      continue
    }
    if (cells.length > 2) continue
    if (cells.some(isMediaCell)) continue

    const label = clean(text(cells[0]))
    const value = clean(text(cells[1]))
    if (!label || !value || specKey(label) === specKey(value)) continue
    if (!isLabelLike(label) || !isValueLike(value)) continue

    good++
    out.push(group ? { label, value, group } : { label, value })
  }

  const contentRows = rows.filter(
    (r) => children(r).filter((c) => c.tag === "td" || c.tag === "th").length > 1
  ).length

  if (!contentRows || good / contentRows < 0.6) return []
  return out
}

/** `<dl><dt>Etichetă</dt><dd>Valoare</dd></dl>` — folosit de site-urile de producător. */
function pairsFromDefinitionList(dl: ElementNode): SpecPair[] {
  const out: SpecPair[] = []
  let pendingLabel: string | null = null

  for (const child of children(dl)) {
    if (child.tag === "dt") {
      pendingLabel = clean(text(child))
      continue
    }
    if (child.tag === "dd" && pendingLabel) {
      const value = clean(text(child))
      if (value && isLabelLike(pendingLabel) && isValueLike(value)) {
        out.push({ label: pendingLabel, value })
      }
      pendingLabel = null
    }
  }
  return out
}

/**
 * Fișele făcute din `div`-uri (Altex, PC Garage, teme moderne de shop).
 *
 * Tiparul e mereu același: un rând cu exact doi copii-element, primul
 * eticheta, al doilea valoarea. Îl acceptăm doar când același părinte are cel
 * puțin 3 rânduri de forma asta — două rânduri se nimeresc oriunde în pagină.
 */
function pairsFromDivGrid(root: Node): SpecPair[] {
  const best: { parent: ElementNode; pairs: SpecPair[] }[] = []

  for (const parent of findAll(root, {})) {
    const rows = children(parent).filter((c) => c.tag === "div" || c.tag === "li")
    if (rows.length < 3) continue

    const pairs: SpecPair[] = []
    for (const row of rows) {
      const cols = children(row)
      if (cols.length !== 2) continue
      if (cols.some(isMediaCell)) continue
      const label = clean(text(cols[0]))
      const value = clean(text(cols[1]))
      if (!label || !value || specKey(label) === specKey(value)) continue
      if (!isLabelLike(label) || !isValueLike(value)) continue
      pairs.push({ label, value })
    }

    if (pairs.length >= 3 && pairs.length / rows.length >= 0.6) {
      best.push({ parent, pairs })
    }
  }

  if (!best.length) return []

  // Grilele se imbrică (wrapper → secțiune → rânduri): păstrăm doar blocurile
  // care nu sunt strămoșii altui bloc găsit, ca să nu dublăm aceleași perechi.
  const isAncestorOf = (a: ElementNode, b: ElementNode) => {
    for (let n = b.parent; n; n = n.parent) if (n === a) return true
    return false
  }
  const leaves = best.filter((x) => !best.some((y) => y !== x && isAncestorOf(x.parent, y.parent)))
  return leaves.flatMap((x) => x.pairs)
}

/**
 * Toate perechile din pagină (sau dintr-o secțiune), în ordinea documentului.
 *
 * Prima apariție a unei etichete câștigă: fișa tehnică stă înaintea blocurilor
 * de „produse similare", care repetă aceleași etichete cu alte valori.
 */
export function extractSpecPairs(root: Node): SpecPair[] {
  const collected: SpecPair[] = []

  for (const node of findAll(root, {})) {
    if (!isElement(node)) continue
    if (node.tag === "table") collected.push(...pairsFromTable(node))
    else if (node.tag === "dl") collected.push(...pairsFromDefinitionList(node))
  }

  if (collected.length < 3) collected.push(...pairsFromDivGrid(root))

  const seen = new Set<string>()
  const out: SpecPair[] = []
  for (const pair of collected) {
    const key = specKey(pair.label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(pair)
  }
  return out
}
