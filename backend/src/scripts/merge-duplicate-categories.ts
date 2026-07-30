/**
 * Unește categoriile duplicate rămase din cele două valuri de import și
 * normalizează handle-urile.
 *
 * Catalogul a fost populat în doi pași — seed-ul RO (`seed-onlybestdevice.ts`,
 * 11 categorii scrise de mână) și importul din WooCommerce
 * (`import-woocommerce.ts`, 54 categorii). Cele care existau în ambele au
 * ajuns duplicate, cu o împărțire nefericită:
 *
 *   - rândul din SEED are numele corect („TV, Audio-Video **și** Foto",
 *     „Smartwatch") dar zero produse;
 *   - rândul din IMPORT are toate produsele, dar numele venit din slug-ul
 *     WooCommerce, uneori cu typo („Smartatch si Wearables", „Incarcatoare &
 *     acccesorii").
 *
 * Ca să nu mutăm produse între categorii (operație grea și greu de verificat),
 * păstrăm rândul cu produsele și îi **corectăm numele**; rândul gol din seed e
 * retras prin soft-delete. Handle-ul devine `slugify(name)` — indexul unique pe
 * handle e parțial (`WHERE deleted_at IS NULL`), deci soft-delete-ul eliberează
 * handle-ul vechi înainte ca altcineva să-l poată lua.
 *
 * Handle-urile retrase trebuie să rămână în `RETIRED_CATEGORY_HANDLES` din
 * `storefront/src/middleware.ts`, ca vechile URL-uri să dea 308, nu 404.
 *
 * Idempotent: recitește starea la fiecare rulare și sare peste ce e deja la zi,
 * deci se poate rula de câte ori vrei (local, apoi pe producție).
 *
 * Rulare:  cd backend && yarn medusa exec ./src/scripts/merge-duplicate-categories.ts
 *   Opțional: DRY_RUN=1 (doar raport, fără scriere)
 */
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Trebuie să rămână identică cu `categorySlug` din
 * `storefront/src/lib/util/category-slug.ts`: storefront-ul rezolvă segmentele
 * de URL pe slug-ul numelui, deci cele două definiții nu au voie să divergă.
 */
const categorySlug = (name: string): string =>
  name
    // `ș`/`ț` (U+0219/U+021B) se descompun în s/t + virgulă combinată, la fel
    // ca ă/â/î — deci NFD + tăierea semnelor combinate le acoperă pe toate.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

/**
 * Perechile de unit, identificate prin handle.
 *
 * `keep` = rândul care are produsele; `retire` = duplicatul gol din seed;
 * `name` = numele corect, care se scrie pe `keep` (de acolo iese handle-ul).
 */
const MERGES: { keep: string; retire: string; name: string }[] = [
  { keep: "console-jocuri", retire: "console,-jocuri", name: "Console, Jocuri" },
  {
    keep: "tv-audio-video-si-foto",
    retire: "tv,-audio-video-și-foto",
    name: "TV, Audio-Video și Foto",
  },
  {
    keep: "folii-de-protectie",
    retire: "folii-de-protecție",
    name: "Folii de protecție",
  },
  {
    keep: "desktop-pc-periferice",
    retire: "desktop-pc-&-periferice",
    name: "Desktop PC & Periferice",
  },
  {
    keep: "incarcatoare-acccesorii",
    retire: "încărcătoare-&-accesorii",
    name: "Încărcătoare & accesorii",
  },
  {
    keep: "smartatch-si-wearables",
    retire: "smartwatch-&-wearables",
    name: "Smartwatch & Wearables",
  },
  // `honor-2` e o categorie de top rămasă goală; cea reală stă sub Telefoane.
  { keep: "honor", retire: "honor-2", name: "Honor" },
]

/**
 * Categorii retrase fără fuziune — n-au un echivalent în care să curgă.
 *
 * „Fără categorie" e pubela pe care WooCommerce o pune automat pe produsele
 * necategorizate; nu e o categorie de navigat. Produsele NU se șterg și rămân
 * în catalog (`/store` filtrează pe canalul de vânzare, nu pe categorie) — își
 * pierd doar această etichetă.
 *
 * `import-woocommerce.ts` oglindește categoriile din WC, deci un re-import o
 * poate recrea; de aceea `CATEGORY_FACET_BLOCKLIST` din
 * `src/api/store/catalog/route.ts` o ține oricum în afara fațetelor.
 */
const RETIRE_ONLY = ["fara-categorie"]

type Row = {
  id: string
  handle: string
  name: string
  parent_category_id: string | null
}

export default async function mergeDuplicateCategories({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const dryRun = process.env.DRY_RUN === "1"

  if (dryRun) {
    logger.info("DRY_RUN=1 — doar raport, nu se scrie nimic.")
  }

  const load = async (): Promise<Row[]> =>
    knex("product_category")
      .select("id", "handle", "name", "parent_category_id")
      .whereNull("deleted_at")

  let rows = await load()
  const byHandle = () => new Map(rows.map((r) => [r.handle, r]))

  let merged = 0
  let renamed = 0
  let moved = 0
  const skipped: string[] = []

  for (const m of MERGES) {
    const map = byHandle()
    const keep = map.get(m.keep)
    const retire = map.get(m.retire)
    const targetHandle = categorySlug(m.name)

    // Rândul păstrat poate fi găsit și după handle-ul deja normalizat, dacă
    // scriptul a rulat o dată.
    const kept = keep ?? map.get(targetHandle)

    if (!kept) {
      skipped.push(
        `${m.keep} → lipsește rândul de păstrat (nici ca "${targetHandle}")`
      )
      continue
    }

    /* ---- 1. Ce atârnă de duplicat se mută pe rândul păstrat ---- */

    if (retire) {
      // Produsele: `ON CONFLICT DO NOTHING` acoperă produsele care sunt deja în
      // ambele categorii, altfel cheia (categorie, produs) ar exploda.
      const productsMoved = dryRun
        ? await knex("product_category_product")
            .where({ product_category_id: retire.id })
            .count("* as n")
            .then((r: any[]) => Number(r[0]?.n ?? 0))
        : await knex
            .raw(
              `INSERT INTO product_category_product (product_category_id, product_id)
               SELECT :keep, product_id FROM product_category_product
               WHERE product_category_id = :retire
               ON CONFLICT DO NOTHING`,
              { keep: kept.id, retire: retire.id }
            )
            .then((r: any) => r.rowCount ?? 0)

      if (productsMoved) {
        moved += productsMoved
        logger.info(
          `  ${m.retire}: ${productsMoved} produs(e) legate la ${kept.handle}`
        )
      }

      if (!dryRun) {
        await knex("product_category_product")
          .where({ product_category_id: retire.id })
          .del()

        // Sub-categoriile duplicatului devin copii ai rândului păstrat.
        const kidsMoved = await knex("product_category")
          .where({ parent_category_id: retire.id })
          .whereNull("deleted_at")
          .update({ parent_category_id: kept.id })
        if (kidsMoved) {
          logger.info(`  ${m.retire}: ${kidsMoved} sub-categorie(i) re-legate`)
        }

        /* ---- 2. Duplicatul iese din scenă (eliberează handle-ul) ---- */
        await knex("product_category")
          .where({ id: retire.id })
          .update({ deleted_at: knex.fn.now() })
      }

      merged++
      logger.info(`✔ retras ${m.retire} → ${kept.handle}`)
      rows = await load()
    }

    /* ---- 3. Numele corect + handle-ul normalizat pe rândul păstrat ---- */

    const needsName = kept.name !== m.name
    const needsHandle = kept.handle !== targetHandle

    if (needsHandle) {
      // Handle-ul țintă trebuie să fie liber: dacă îl ține altcineva viu,
      // ne oprim în loc să încălcăm indexul unique.
      const holder = byHandle().get(targetHandle)
      if (holder && holder.id !== kept.id) {
        skipped.push(
          `${kept.handle} → handle-ul "${targetHandle}" e ocupat de ${holder.id}`
        )
        continue
      }
    }

    if (needsName || needsHandle) {
      if (!dryRun) {
        await knex("product_category")
          .where({ id: kept.id })
          .update({ name: m.name, handle: targetHandle })
      }
      renamed++
      logger.info(
        `✔ ${kept.handle} → handle="${targetHandle}" name="${m.name}"` +
          (needsName ? ` (era "${kept.name}")` : "")
      )
      rows = await load()
    }
  }

  /* ---- 4. Categoriile retrase fără fuziune ---- */

  let retiredOnly = 0
  for (const handle of RETIRE_ONLY) {
    const row = byHandle().get(handle)
    if (!row) {
      continue
    }

    const kids = await knex("product_category")
      .where({ parent_category_id: row.id })
      .whereNull("deleted_at")
      .count("* as n")
      .then((r: any[]) => Number(r[0]?.n ?? 0))
    if (kids) {
      // Sub-categoriile ar rămâne orfane; mai bine ne oprim și raportăm.
      skipped.push(`${handle} → are ${kids} sub-categorie(i), nu o retrag`)
      continue
    }

    const links = await knex("product_category_product")
      .where({ product_category_id: row.id })
      .count("* as n")
      .then((r: any[]) => Number(r[0]?.n ?? 0))

    if (!dryRun) {
      // Doar legătura produs↔categorie cade; produsele rămân în catalog.
      await knex("product_category_product")
        .where({ product_category_id: row.id })
        .del()
      await knex("product_category")
        .where({ id: row.id })
        .update({ deleted_at: knex.fn.now() })
    }

    retiredOnly++
    logger.info(
      `✔ retras ${handle} (fără fuziune) — ${links} produs(e) rămân în catalog, fără categorie`
    )
    rows = await load()
  }

  /* ---- 5. Verificare: slug-urile trebuie să fie unice între frați ---- */

  const siblings = new Map<string, Map<string, string[]>>()
  for (const r of rows) {
    const parent = r.parent_category_id ?? "(top)"
    const slug = categorySlug(r.name)
    const bucket = siblings.get(parent) ?? new Map<string, string[]>()
    bucket.set(slug, [...(bucket.get(slug) ?? []), r.handle])
    siblings.set(parent, bucket)
  }

  const clashes: string[] = []
  for (const [parent, bucket] of siblings) {
    for (const [slug, handles] of bucket) {
      if (handles.length > 1) {
        clashes.push(`parent=${parent} slug="${slug}" ← ${handles.join(", ")}`)
      }
    }
  }

  logger.info(
    `\nGata: ${merged} duplicat(e) retrase, ${renamed} redenumite, ${moved} produs(e) re-legate, ${retiredOnly} retrase fără fuziune.`
  )
  if (skipped.length) {
    logger.warn(`Sărite (${skipped.length}):`)
    skipped.forEach((s) => logger.warn(`  ${s}`))
  }
  if (clashes.length) {
    // Storefront-ul rezolvă URL-urile ierarhice pe slug-ul numelui, deci două
    // surori cu același slug ar face o categorie inaccesibilă.
    logger.error(
      `ATENȚIE: ${clashes.length} slug-uri se ciocnesc între frați — URL-urile ierarhice devin ambigue:`
    )
    clashes.forEach((c) => logger.error(`  ${c}`))
  } else {
    logger.info("Slug-uri unice între frați ✔")
  }
}
