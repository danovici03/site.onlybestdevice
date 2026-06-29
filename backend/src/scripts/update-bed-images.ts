import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Rewrites bed-product images to point at the clean handle-based filenames
 * uploaded to the Hetzner Object Storage bucket (`set-<handle>.jpeg`,
 * `set-<handle>-2.jpeg`, …).
 *
 * Background: products imported by `import-astin.ts` reference the original
 * WhatsApp/UUID filenames from the source CSV. Those files were replaced in
 * the bucket with clean handle-based names but the product records still
 * point at the old (now 403) URLs.
 *
 * For each handle the script probes the bucket for `<handle>.jpeg`,
 * `<handle>-2.jpeg`, … up to `<handle>-10.jpeg`. The first existing file
 * becomes the thumbnail; all existing files (in order) become the `images`.
 * Products with no main `<handle>.jpeg` in the bucket are skipped.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/update-bed-images.ts
 *   DRY_RUN=true yarn medusa exec ./src/scripts/update-bed-images.ts
 *
 * Override the bucket base URL with S3_FILE_URL (defaults to production).
 */

const HANDLES = [
  "set-lux-amore",
  "set-lux-cappy",
  "set-lux-kuvars",
  "set-lux-latte",
  "set-lux-leon",
  "set-lux-linda",
  "set-lux-line",
  "set-lux-picasso",
  "set-lux-piyano",
  "set-lux-platinium",
  "set-lux-smeraldo",
  "set-lux-sultan",
  "set-lux-vita",
  "set-grand",
  "set-camelli",
  "set-luna-matrimoniale",
  "set-odessa-matrimoniale",
  "set-kristal-matrimoniale",
  "set-perla-matrimoniale",
  "set-duke-singolo",
  "set-rose-singolo",
  "set-latte-singolo",
  "set-kristal-singolo",
  "set-luna-singolo",
  "set-odessa-singolo",
  "set-perla-singolo",
]

const BASE_URL = (
  process.env.S3_FILE_URL || "https://hel1.your-objectstorage.com/arredo-uploads"
).replace(/\/$/, "")

const MAX_EXTRA = 10
const DRY_RUN = process.env.DRY_RUN === "true"

const headOk = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { method: "HEAD" })
    return res.status === 200
  } catch {
    return false
  }
}

const collectUrlsForHandle = async (handle: string): Promise<string[]> => {
  const main = `${BASE_URL}/${handle}.jpeg`
  if (!(await headOk(main))) return []
  const urls = [main]
  for (let i = 2; i <= MAX_EXTRA; i++) {
    const u = `${BASE_URL}/${handle}-${i}.jpeg`
    if (!(await headOk(u))) break
    urls.push(u)
  }
  return urls
}

export default async function updateBedImages({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info(`Probing ${BASE_URL} for ${HANDLES.length} bed handles. DRY_RUN=${DRY_RUN}`)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "thumbnail", "images.url"],
    filters: { handle: HANDLES },
  })
  const byHandle = new Map<string, any>(
    (products as any[]).map((p) => [p.handle, p])
  )

  const missingInDb = HANDLES.filter((h) => !byHandle.has(h))
  if (missingInDb.length) {
    logger.warn(
      `${missingInDb.length} handles not found in DB (skipped): ${missingInDb.join(", ")}`
    )
  }

  type Plan = {
    id: string
    handle: string
    current_thumb: string | null
    current_images: string[]
    next_thumb: string
    next_images: string[]
  }
  const plans: Plan[] = []
  const missingInBucket: string[] = []
  const alreadyCorrect: string[] = []

  const probed = await Promise.all(
    HANDLES.filter((h) => byHandle.has(h)).map(async (handle) => ({
      handle,
      urls: await collectUrlsForHandle(handle),
    }))
  )

  for (const { handle, urls } of probed) {
    const product = byHandle.get(handle)!

    if (!urls.length) {
      missingInBucket.push(handle)
      continue
    }

    const currentImages = (product.images ?? []).map((i: any) => i.url)
    const sameImages =
      currentImages.length === urls.length &&
      currentImages.every((u: string, i: number) => u === urls[i])
    if (product.thumbnail === urls[0] && sameImages) {
      alreadyCorrect.push(handle)
      continue
    }

    plans.push({
      id: product.id,
      handle,
      current_thumb: product.thumbnail ?? null,
      current_images: currentImages,
      next_thumb: urls[0],
      next_images: urls,
    })
  }

  logger.info(
    `Found in bucket: ${HANDLES.length - missingInBucket.length}/${HANDLES.length}. ` +
      `Already correct: ${alreadyCorrect.length}. To update: ${plans.length}.`
  )
  if (missingInBucket.length) {
    logger.warn(`No <handle>.jpeg in bucket: ${missingInBucket.join(", ")}`)
  }

  if (!plans.length) {
    logger.info("Nothing to update.")
    return
  }

  for (const p of plans) {
    logger.info(
      `  ${p.handle}: thumb ${p.current_thumb?.split("/").pop() ?? "—"} → ` +
        `${p.next_thumb.split("/").pop()} (${p.next_images.length} images)`
    )
  }

  if (DRY_RUN) {
    logger.info("DRY_RUN=true — not writing.")
    return
  }

  for (const p of plans) {
    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: p.id },
        update: {
          thumbnail: p.next_thumb,
          images: p.next_images.map((url) => ({ url })),
        },
      },
    })
  }

  logger.info(`✓ Updated ${plans.length} products.`)
}
