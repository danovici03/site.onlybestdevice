import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import path from "path"

/**
 * Mută pozele de pe WordPress-ul vechi (onlybestdevice.ro/wp-content/uploads)
 * în bucket-ul S3-compatibil configurat prin env (Hetzner Object Storage) și
 * rescrie toate URL-urile din baza de date.
 *
 * Cheia în bucket păstrează calea din WordPress, ca să fie idempotent:
 *   https://onlybestdevice.ro/wp-content/uploads/2025/08/tableta-x.jpeg
 *   → media/2025/08/tableta-x.jpeg
 * La re-rulare un HeadObject sare peste fișierele deja urcate, deci scriptul
 * se poate opri și relua fără să dubleze nimic.
 *
 * Coloanele rescrise (scanate cu `like '%wp-content%'` pe toate tabelele):
 *   product.thumbnail, image.url, product.metadata (phone_siblings),
 *   hero_slide.image_url, cart_line_item.thumbnail, order_line_item.thumbnail
 *
 * Run:
 *   yarn medusa exec ./src/scripts/migrate-images-to-s3.ts
 *   DRY_RUN=1 yarn medusa exec ./src/scripts/migrate-images-to-s3.ts   # doar raport
 *   ONLY_UPLOAD=1 ...   # urcă în bucket, nu atinge baza de date
 *   ONLY_REWRITE=1 ...  # doar rescrie baza (fișierele sunt deja în bucket)
 *
 * Env necesare (aceleași pe care le citește medusa-config.ts):
 *   S3_BUCKET, S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_FILE_URL
 * Opțional:
 *   SOURCE_HOSTS (implicit onlybestdevice.ro,www.onlybestdevice.ro)
 *   KEY_PREFIX   (implicit media/)
 *   CONCURRENCY  (implicit 8)
 */

type Target = {
  table: string
  column: string
  /** cheia primară, pentru update pe rând */
  idColumn: string
  /** jsonb serializat ca text (metadata) în loc de URL simplu */
  isJson?: boolean
}

const TARGETS: Target[] = [
  { table: "product", column: "thumbnail", idColumn: "id" },
  { table: "image", column: "url", idColumn: "id" },
  { table: "product", column: "metadata", idColumn: "id", isJson: true },
  { table: "hero_slide", column: "image_url", idColumn: "id" },
  { table: "cart_line_item", column: "thumbnail", idColumn: "id" },
  { table: "order_line_item", column: "thumbnail", idColumn: "id" },
]

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Rulează `worker` peste `items` cu cel mult `limit` în paralel. */
async function pool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const i = cursor++
        results[i] = await worker(items[i], i)
      }
    })(),
  )

  await Promise.all(runners)
  return results
}

export default async function migrateImagesToS3({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex: any = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const dryRun = process.env.DRY_RUN === "1"
  const onlyUpload = process.env.ONLY_UPLOAD === "1"
  const onlyRewrite = process.env.ONLY_REWRITE === "1"
  const concurrency = Number(process.env.CONCURRENCY || 8)
  const keyPrefix = (process.env.KEY_PREFIX ?? "media/").replace(/^\/+/, "")

  const bucket = process.env.S3_BUCKET
  const fileUrl = (process.env.S3_FILE_URL || "").replace(/\/$/, "")

  if (!bucket || !fileUrl) {
    logger.error(
      "Lipsesc S3_BUCKET și/sau S3_FILE_URL. Completează .env înainte de rulare.",
    )
    return
  }

  const sourceHosts = (
    process.env.SOURCE_HOSTS || "onlybestdevice.ro,www.onlybestdevice.ro"
  )
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)

  const client = new S3Client({
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  })

  // ── 1. Adună toate URL-urile sursă din baza de date ───────────────────────
  const urlRe = /https?:\/\/[^\s"'<>\\)]+/g

  const isSource = (url: string) => {
    try {
      const u = new URL(url)
      return sourceHosts.includes(u.hostname.toLowerCase())
    } catch {
      return false
    }
  }

  const sourceUrls = new Set<string>()

  for (const t of TARGETS) {
    const rows = await knex(t.table)
      .select(t.idColumn, t.column)
      .whereRaw(`${t.column}::text like ?`, ["%wp-content%"])

    for (const row of rows) {
      const raw = row[t.column]
      if (raw == null) {
        continue
      }
      const text = typeof raw === "string" ? raw : JSON.stringify(raw)
      for (const found of text.match(urlRe) || []) {
        // JSON scapă slash-urile rar, dar ghilimelele de final ajung în match
        const clean = found.replace(/["'\\]+$/, "")
        if (isSource(clean)) {
          sourceUrls.add(clean)
        }
      }
    }

    logger.info(`${t.table}.${t.column}: ${rows.length} rânduri de rescris`)
  }

  const limit = Number(process.env.LIMIT || 0)
  const all = [...sourceUrls].sort()
  // LIMIT taie doar upload-ul (probă pe câteva poze); rescrierea bazei se face
  // oricum întreagă, altfel ar rămâne URL-uri către fișiere care nu există.
  const urls = limit > 0 ? all.slice(0, limit) : all
  logger.info(
    `${all.length} URL-uri distincte pe ${sourceHosts.join(", ")}` +
      (limit > 0 ? ` — LIMIT=${limit}, urc doar primele ${urls.length}` : ""),
  )

  if (limit > 0 && !onlyUpload) {
    logger.error("LIMIT se folosește doar cu ONLY_UPLOAD=1.")
    return
  }

  if (!urls.length) {
    logger.info("Nimic de migrat.")
    return
  }

  // ── 2. old url → cheie în bucket → url nou ────────────────────────────────
  const keyFor = (url: string) => {
    const pathname = decodeURIComponent(new URL(url).pathname)
    // /wp-content/uploads/2025/08/poza.jpeg → 2025/08/poza.jpeg
    const rel = pathname
      .replace(/^\/+/, "")
      .replace(/^wp-content\/uploads\//, "")
    // spațiile și caracterele care ar cere encoding în URL-ul final
    const safe = rel.replace(/[^a-zA-Z0-9!\-_.*'()/]/g, "-")
    return `${keyPrefix}${safe}`
  }

  const mapping = new Map<string, { key: string; newUrl: string }>()
  const keySeen = new Map<string, string>()

  for (const url of urls) {
    let key = keyFor(url)
    const collision = keySeen.get(key)
    if (collision && collision !== url) {
      // două URL-uri sursă diferite ar ateriza pe aceeași cheie — sufixăm
      const parsed = path.parse(key)
      const dir = parsed.dir ? `${parsed.dir}/` : ""
      let n = 2
      while (keySeen.has(`${dir}${parsed.name}-${n}${parsed.ext}`)) {
        n++
      }
      key = `${dir}${parsed.name}-${n}${parsed.ext}`
      logger.warn(`Coliziune de cheie pentru ${url} → ${key}`)
    }
    keySeen.set(key, url)
    mapping.set(url, { key, newUrl: `${fileUrl}/${key}` })
  }

  if (dryRun) {
    const sample = urls.slice(0, 5)
    logger.info("DRY_RUN=1 — nu se urcă și nu se scrie nimic. Exemple:")
    for (const u of sample) {
      logger.info(`  ${u}\n    → ${mapping.get(u)!.newUrl}`)
    }
    return
  }

  // ── 3. Descarcă de pe WordPress și urcă în bucket ─────────────────────────
  const failed: { url: string; error: string }[] = []
  let uploaded = 0
  let skipped = 0

  if (!onlyRewrite) {
    await pool(urls, concurrency, async (url, i) => {
      const { key } = mapping.get(url)!

      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        skipped++
        return
      } catch {
        // lipsește în bucket — îl urcăm
      }

      const ext = path.extname(key).toLowerCase()
      let lastError = ""

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const res = await fetch(url, {
            headers: { "user-agent": "obd-image-migration" },
          })
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          }
          const body = Buffer.from(await res.arrayBuffer())
          if (!body.length) {
            throw new Error("fișier gol")
          }

          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: body,
              ACL: "public-read",
              ContentType:
                res.headers.get("content-type")?.split(";")[0] ||
                MIME_BY_EXT[ext] ||
                "application/octet-stream",
              CacheControl: "public, max-age=31536000, immutable",
            }),
          )

          uploaded++
          if (uploaded % 50 === 0) {
            logger.info(
              `  urcate ${uploaded}, sărite ${skipped} / ${urls.length}`,
            )
          }
          return
        } catch (e: any) {
          lastError = e?.message || String(e)
          await sleep(attempt * 1000)
        }
      }

      failed.push({ url, error: lastError })
      logger.warn(`Eșec pe ${url}: ${lastError}`)
    })

    logger.info(
      `Upload gata: ${uploaded} urcate, ${skipped} deja existente, ${failed.length} eșuate.`,
    )
  }

  if (failed.length) {
    logger.error(
      "Nu rescriu baza de date cât timp există fișiere eșuate — reia scriptul " +
        "(sare peste ce e deja urcat) sau șterge manual URL-urile moarte.",
    )
    for (const f of failed.slice(0, 20)) {
      logger.error(`  ${f.url} — ${f.error}`)
    }
    return
  }

  if (onlyUpload) {
    logger.info("ONLY_UPLOAD=1 — baza de date rămâne neatinsă.")
    return
  }

  // ── 4. Rescrie URL-urile în baza de date ──────────────────────────────────
  const replaceAll = (text: string) => {
    let out = text
    for (const [oldUrl, { newUrl }] of mapping) {
      if (out.includes(oldUrl)) {
        out = out.split(oldUrl).join(newUrl)
      }
    }
    return out
  }

  await knex.transaction(async (trx: any) => {
    for (const t of TARGETS) {
      const rows = await trx(t.table)
        .select(t.idColumn, t.column)
        .whereRaw(`${t.column}::text like ?`, ["%wp-content%"])

      let updated = 0
      for (const row of rows) {
        const raw = row[t.column]
        if (raw == null) {
          continue
        }

        if (t.isJson) {
          const before = JSON.stringify(raw)
          const after = replaceAll(before)
          if (after === before) {
            continue
          }
          await trx(t.table)
            .where(t.idColumn, row[t.idColumn])
            .update({ [t.column]: JSON.parse(after) })
        } else {
          const after = replaceAll(String(raw))
          if (after === raw) {
            continue
          }
          await trx(t.table)
            .where(t.idColumn, row[t.idColumn])
            .update({ [t.column]: after })
        }
        updated++
      }

      logger.info(`${t.table}.${t.column}: ${updated} rânduri actualizate`)
    }
  })

  logger.info(
    "Gata. Setează S3_HOSTNAME + S3_PATHNAME în storefront și redeployează, " +
      "altfel next/image respinge noul host.",
  )
}
