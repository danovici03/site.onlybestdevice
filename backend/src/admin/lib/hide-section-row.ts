/**
 * Ascunde un rând din secțiunile de detaliu ale dashboard-ului.
 *
 * Medusa nu are zonă de widget care să ÎNLOCUIASCĂ un câmp, doar zone în care
 * poți adăuga. Descrierile fiind HTML cu poze, rândul nativ „Descriere" umple
 * ecranul cu markup brut, iar editorul nostru l-ar dubla — deci îl scoatem din
 * pagină din DOM.
 *
 * Hack-ul stă închis aici, într-un singur fișier, fiindcă depinde de markup-ul
 * dashboard-ului (`SectionRow` randează `div.grid.w-full.grid-cols-2` cu
 * eticheta în primul copil și valoarea în al doilea). Dacă Medusa îl schimbă,
 * NU se rupe nimic: rândul rămâne vizibil și primim un `console.warn`. De aceea
 * potrivirea se face pe eticheta tradusă + textul valorii, nu pe poziție.
 */

/** Cât așteptăm rândul să apară înainte să ne dăm bătuți (react-query întârzie). */
const GIVE_UP_AFTER_MS = 2_000

const ROW_SELECTOR = "div.grid.w-full.grid-cols-2"

export function hideSectionRow(
  /** Eticheta rândului; mai multe variante, dacă traducerea nu e sigură. */
  label: string | string[],
  matchValue: (text: string) => boolean
): () => void {
  const labels = new Set(
    (Array.isArray(label) ? label : [label]).map((l) => l.trim())
  )
  const hidden = new Set<HTMLElement>()
  let found = false

  const apply = () => {
    document.querySelectorAll<HTMLElement>(ROW_SELECTOR).forEach((row) => {
      if (hidden.has(row)) {
        // Re-randarea poate reseta stilul inline pe același nod.
        row.style.display = "none"
        return
      }
      const children = row.children
      if (children.length < 2) return
      if (!labels.has(children[0]?.textContent?.trim() ?? "")) return
      if (!matchValue(children[1]?.textContent ?? "")) return

      row.style.display = "none"
      hidden.add(row)
      found = true
    })
  }

  apply()

  // Rândul se re-randează după fiecare refetch al produsului, deci nu e de
  // ajuns să-l ascundem o dată. Ne uităm doar la `childList`/`subtree`: cu
  // `attributes` am reintra în observer la propria noastră scriere de stil.
  const root = document.getElementById("medusa") ?? document.body
  const observer = new MutationObserver(apply)
  observer.observe(root, { childList: true, subtree: true })

  const timer = window.setTimeout(() => {
    if (!found) {
      console.warn(
        `[admin] Nu am găsit rândul „${[...labels].join("/")}” ca să-l ascund — ` +
          "probabil s-a schimbat markup-ul dashboard-ului. Rămâne vizibil."
      )
    }
  }, GIVE_UP_AFTER_MS)

  return () => {
    window.clearTimeout(timer)
    observer.disconnect()
    hidden.forEach((row) => {
      row.style.removeProperty("display")
    })
    hidden.clear()
  }
}
