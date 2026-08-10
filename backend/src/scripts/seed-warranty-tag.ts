/**
 * Pune tagul `garantie-extinsa` pe produsele care pot primi garanție extinsă.
 *
 * Migrare unică: garanția se oferea până acum pe TOT catalogul, iar de la bifa
 * din admin încoace se oferă doar pe produsele tagate. Fără scriptul ăsta,
 * cardul ar dispărea de peste tot până la prima bifă manuală. Scriptul face
 * selecția inițială după categorii — telefoane, tablete, laptopuri, TV/audio,
 * smartwatch, PC & periferice, console — și sare peste accesorii.
 *
 * Pe lângă categorii, produsele sub `WARRANTY_MIN_PRICE` nu se tagează deloc.
 * Categoriile singure nu sunt de ajuns: „Desktop PC & Periferice" ține un
 * mini-PC de 4.000 lei lângă un mouse de 35 lei, iar sub „Casti" stau și căști
 * Sony de 50 lei. O garanție de 99 lei pe un produs de 50 lei e o vânzare pe
 * care n-o vrem, indiferent din ce categorie vine.
 *
 * Ce NU decide singur: produsele din „Diverse" și cele fără nicio categorie.
 * „Diverse" ține la un loc PS5-uri și mini-PC-uri cu mouse-uri și coolere, deci
 * nu există regulă corectă — le listează la final ca să le bifezi din Admin.
 *
 * Idempotent și, implicit, nedistructiv: păstrează celelalte taguri, sare peste
 * produsele care au deja tagul și nu scoate niciodată tagul de pe cineva.
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/seed-warranty-tag.ts
 *   DRY_RUN=1              doar raport, fără scriere
 *   PRUNE=1                scoate tagul de pe produsele care NU mai califică
 *                          (accesorii sau sub prag). Necesar o singură dată,
 *                          ca să repare o rulare anterioară prea permisivă;
 *                          șterge și bifele manuale puse pe astfel de produse.
 *   WARRANTY_MIN_PRICE=400 pragul, în lei
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { applyTagToProducts } from "./lib/product-tag-migration"

const WARRANTY_TAG = "garantie-extinsa"

/**
 * Sub pragul ăsta nu se oferă garanție, oricât de potrivită ar fi categoria.
 * 400 lei ține garanția de 1 an (99 lei) la cel mult un sfert din prețul
 * produsului. E și plasa de siguranță pentru orice categorie viitoare adăugată
 * din greșeală în `ELIGIBLE_ROOTS`.
 *
 * Trebuie să rămână aliniat cu `WARRANTY_MIN_PRICE` din storefront
 * (`lib/util/warranty.ts`), care face aceeași verificare la afișare.
 */
const MIN_PRICE = Number(process.env.WARRANTY_MIN_PRICE || 400)
const CURRENCY = (process.env.WARRANTY_CURRENCY || "ron").toLowerCase()

/**
 * Categoriile ai căror produse primesc garanție, cu tot cu subcategorii.
 * Sunt rădăcini: `Telefoane mobile` acoperă și `Apple`, `Samsung`, `iPhone 16`.
 */
const ELIGIBLE_ROOTS = [
  "telefoane-mobile",
  "tablete",
  "laptop",
  "tv-audio-video-si-foto",
  "smartwatch-wearables",
  "smartatch-si-wearables", // duplicat scris greșit, rămas din import
  "desktop-pc-periferice",
  "console-jocuri",
]

/**
 * Accesoriile, care nu primesc garanție niciodată. Bat lista de mai sus: de
 * exemplu `Incarcatoare si cabluri` atârnă sub `Console, Jocuri`, iar produsele
 * stau adesea și în părinte, și în copil.
 */
const EXCLUDED_ROOTS = [
  "huse-telefoane",
  "folii-de-protectie",
  "incarcatoare-accesorii",
  "incarcatoare-acccesorii", // duplicat scris greșit, rămas din import
  "incarcatoare-si-cabluri",
  "suporturi-auto",
]

/** Produsul de serviciu însuși — el nu poate avea garanție pe el. */
const WARRANTY_HANDLE = "garantie-extinsa"

const flag = (name: string) =>
  /^(1|true|yes)$/i.test(process.env[name] ?? "")

const DRY_RUN = flag("DRY_RUN")
const PRUNE = flag("PRUNE")

export default async function seedWarrantyTag({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "handle", "parent_category_id"],
  })

  const byId = new Map<string, any>(categories.map((c: any) => [c.id, c]))

  const knownHandles = new Set(categories.map((c: any) => c.handle))
  for (const h of [...ELIGIBLE_ROOTS, ...EXCLUDED_ROOTS]) {
    if (!knownHandles.has(h)) {
      logger.warn(
        `Handle-ul „${h}" nu există printre categorii — regula lui nu face nimic.`
      )
    }
  }

  /** Handle-urile de pe lanțul unei categorii, de la ea până la rădăcină. */
  const ancestry = (id: string): string[] => {
    const chain: string[] = []
    // Ciclurile n-ar trebui să existe, dar un părinte greșit ar bloca scriptul.
    const seen = new Set<string>()
    let node = byId.get(id)
    while (node && !seen.has(node.id)) {
      seen.add(node.id)
      chain.push(node.handle)
      node = node.parent_category_id
        ? byId.get(node.parent_category_id)
        : undefined
    }
    return chain
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "handle",
      "title",
      "tags.id",
      "tags.value",
      "categories.id",
      "categories.handle",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
  })

  /** Cel mai mic preț al produsului în moneda noastră, dacă are vreunul. */
  const lowestPrice = (p: any): number | null => {
    const amounts = (p.variants ?? []).flatMap((v: any) =>
      (v.prices ?? [])
        .filter((pr: any) => (pr.currency_code ?? "").toLowerCase() === CURRENCY)
        .map((pr: any) => Number(pr.amount))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    )
    return amounts.length ? Math.min(...amounts) : null
  }

  const eligible: any[] = []
  const excluded: any[] = []
  const belowThreshold: any[] = []
  const overlap: any[] = []
  const unresolved: any[] = []

  for (const p of products as any[]) {
    if (p.handle === WARRANTY_HANDLE) continue

    const chains = (p.categories ?? []).flatMap((c: any) => ancestry(c.id))
    const isExcluded = chains.some((h) => EXCLUDED_ROOTS.includes(h))
    const isEligible = chains.some((h) => ELIGIBLE_ROOTS.includes(h))

    if (isExcluded) {
      excluded.push(p)
      // Un produs care pică în ambele liste e fie greșit încadrat, fie un
      // produs real pierdut printre accesorii — oricum, merită văzut.
      if (isEligible) overlap.push(p)
      continue
    }
    if (!isEligible) {
      unresolved.push(p)
      continue
    }

    const price = lowestPrice(p)
    // Fără preț în moneda noastră nu putem judeca raportul, deci nu tagăm.
    if (price === null || price < MIN_PRICE) {
      belowThreshold.push({ ...p, _price: price })
      continue
    }

    eligible.push(p)
  }

  const hasTag = (p: any) =>
    (p.tags ?? []).some(
      (t: any) => (t.value ?? "").toLowerCase() === WARRANTY_TAG
    )

  const needsTag = eligible.filter((p) => !hasTag(p))
  // Tagate cândva, dar care azi nu mai califică — accesorii sau sub prag.
  const stale = [...excluded, ...belowThreshold].filter(hasTag)

  logger.info(
    `${products.length} produse: ${eligible.length} cu garanție, ` +
      `${excluded.length} accesorii, ${belowThreshold.length} sub ${MIN_PRICE} lei, ` +
      `${unresolved.length} de decis manual.`
  )
  logger.info(
    `${needsTag.length} de tagat (${eligible.length - needsTag.length} au deja tagul).`
  )
  if (stale.length) {
    logger.warn(
      `${stale.length} produse poartă tagul deși nu mai califică` +
        (PRUNE ? " — le curăț (PRUNE=1)." : " — rulează cu PRUNE=1 ca să le cureți.")
    )
    for (const p of stale.slice(0, 20)) {
      const price = lowestPrice(p)
      logger.warn(`  ${price ?? "?"} lei  ${p.title}`)
    }
    if (stale.length > 20) logger.warn(`  … și încă ${stale.length - 20}`)
  }

  if (DRY_RUN) {
    for (const p of needsTag) logger.info(`  [dry-run] ${p.title}`)
  } else {
    if (needsTag.length) {
      const n = await applyTagToProducts(container, {
        productIds: needsTag.map((p) => p.id),
        tagValue: WARRANTY_TAG,
        mode: "add",
        onProgress: (done, total) => logger.info(`  … ${done}/${total} tagate`),
      })
      logger.info(`Gata: ${n} produse marcate.`)
    }

    if (PRUNE && stale.length) {
      const n = await applyTagToProducts(container, {
        productIds: stale.map((p) => p.id),
        tagValue: WARRANTY_TAG,
        mode: "remove",
        onProgress: (done, total) => logger.info(`  … ${done}/${total} curățate`),
      })
      logger.info(`Curățat: ${n} produse și-au pierdut tagul.`)
    }
  }

  if (overlap.length) {
    logger.info("")
    logger.info(`── Și accesoriu, și produs bun (${overlap.length}) ──────────`)
    logger.info(
      "Stau într-o categorie eligibilă ȘI într-una de accesorii; au fost tratate ca accesorii:"
    )
    for (const p of overlap) {
      const cats = (p.categories ?? []).map((c: any) => c.handle).join(", ")
      logger.info(`  ${p.title}  [${cats}]`)
    }
  }

  if (unresolved.length) {
    logger.info("")
    logger.info(
      `── De decis manual (${unresolved.length}) ─────────────────────────`
    )
    logger.info(
      "Categoriile lor nu spun dacă merită garanție. Bifează-le din Admin:"
    )
    for (const p of unresolved) {
      const cats = (p.categories ?? []).map((c: any) => c.handle).join(", ")
      const price = lowestPrice(p)
      logger.info(`  ${price ?? "?"} lei  ${p.title}  [${cats || "fără categorie"}]`)
    }
  }
}
