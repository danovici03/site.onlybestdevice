import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

/**
 * Verifică bucket-ul S3-compatibil înainte de migrarea pozelor: credențiale,
 * drept de scriere, ACL public-read și citire anonimă prin S3_FILE_URL.
 *
 * Citirea anonimă e testul care contează — Medusa marchează fiecare obiect cu
 * `ACL: public-read`, dar dacă bucket-ul refuză ACL-urile per obiect, upload-ul
 * reușește și pozele tot dau 403 în browser.
 *
 * Run:
 *   yarn medusa exec ./src/scripts/check-s3.ts
 *   KEEP=1 yarn medusa exec ./src/scripts/check-s3.ts   # nu șterge fișierul de test
 */

// PNG 1x1 roșu, ca să testăm un content-type real de imagine.
const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
)

export default async function checkS3({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const bucket = process.env.S3_BUCKET
  const endpoint = process.env.S3_ENDPOINT
  const region = process.env.S3_REGION
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const fileUrl = (process.env.S3_FILE_URL || "").replace(/\/$/, "")

  const missing = Object.entries({
    S3_BUCKET: bucket,
    S3_ENDPOINT: endpoint,
    S3_REGION: region,
    S3_ACCESS_KEY_ID: accessKeyId,
    S3_SECRET_ACCESS_KEY: secretAccessKey,
    S3_FILE_URL: fileUrl,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (missing.length) {
    logger.error(`Lipsesc din .env: ${missing.join(", ")}`)
    return
  }

  logger.info(`Bucket:   ${bucket}`)
  logger.info(`Endpoint: ${endpoint} (region ${region})`)
  logger.info(`URL public: ${fileUrl}`)

  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    forcePathStyle: true,
  })

  const key = `_check/test-${process.pid}-${Date.now()}.png`
  const publicUrl = `${fileUrl}/${key}`
  let uploaded = false

  try {
    // 1. Credențiale + bucket există
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }),
    )
    logger.info(
      `✓ Conexiune OK — bucket-ul are ${listed.KeyCount ?? 0} obiecte (primele 5 listate).`,
    )

    // 2. Scriere cu ACL public-read
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: TEST_PNG,
        ACL: "public-read",
        ContentType: "image/png",
        CacheControl: "public, max-age=60",
      }),
    )
    uploaded = true
    logger.info(`✓ Upload OK — ${key}`)

    // 3. Obiectul e acolo
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    )
    logger.info(
      `✓ HeadObject OK — ${head.ContentLength} bytes, ${head.ContentType}`,
    )

    // 4. Citire anonimă, fără semnătură — testul care contează
    const res = await fetch(publicUrl)
    if (res.ok) {
      const bytes = Buffer.from(await res.arrayBuffer())
      logger.info(
        `✓ Citire publică OK — ${res.status}, ${bytes.length} bytes, ` +
          `content-type ${res.headers.get("content-type")}`,
      )
      if (!bytes.equals(TEST_PNG)) {
        logger.warn("⚠ Conținutul citit diferă de cel urcat.")
      }
      logger.info(`\nTestează și în browser: ${publicUrl}`)
    } else {
      logger.error(
        `✗ Citire publică EȘUATĂ — HTTP ${res.status}. Upload-ul merge, dar ` +
          `pozele vor da ${res.status} în browser.`,
      )
      logger.error(
        "  Fie bucket-ul ignoră ACL-urile per obiect (pune o bucket policy " +
          "de public read), fie S3_FILE_URL nu e URL-ul public corect al bucket-ului.",
      )
      logger.error(`  URL testat: ${publicUrl}`)
    }
  } catch (e: any) {
    logger.error(`✗ ${e?.name || "Eroare"}: ${e?.message || e}`)
    if (e?.$metadata?.httpStatusCode) {
      logger.error(`  HTTP ${e.$metadata.httpStatusCode}`)
    }
    logger.error(
      "  Verifică access key / secret / numele bucket-ului și că S3_ENDPOINT " +
        "corespunde locației (hel1 / fsn1 / nbg1).",
    )
  } finally {
    if (uploaded && process.env.KEEP !== "1") {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        logger.info("✓ Fișierul de test a fost șters.")
      } catch {
        logger.warn(`Nu am putut șterge ${key} — șterge-l manual.`)
      }
    }
  }
}
