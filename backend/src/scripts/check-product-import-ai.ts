import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { readFileSync } from "fs"

import { extractProduct, mergeAiExtraction } from "../lib/product-import"
import { aiExtract, aiExtractionEnabled, isThinExtraction } from "../lib/product-import/ai"
import { fetchPage } from "../lib/product-import/fetch-page"

/**
 * Rulează importul pe o pagină, fără să scrie nimic în catalog.
 *
 * E felul în care se probează stratul de AI înainte să-l vadă un operator:
 * arată ce scoate euristica singură, dacă pragurile cheamă modelul, ce a
 * adăugat el, cât a costat și — cel mai important — ce i s-a aruncat la
 * verificare.
 *
 * Run:
 *   URL=https://exemplu.ro/produs yarn medusa exec ./src/scripts/check-product-import-ai.ts
 *   URL=… HTML=./pagina.html yarn medusa exec ./src/scripts/check-product-import-ai.ts
 *   URL=… FORCE=1 yarn medusa exec ./src/scripts/check-product-import-ai.ts
 *
 * `HTML` e sursa salvată din browser (vezi bookmarkletul din Admin), pentru
 * site-urile care refuză cererile din server. `FORCE=1` cheamă modelul chiar
 * dacă euristica a scos destul — util ca să compari cele două.
 */

/** Prețuri de listă, $/1M tokeni. Doar pentru estimarea afișată aici. */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
}

export default async function checkProductImportAi({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const url = process.env.URL
  if (!url) {
    logger.error("Lipsește URL=… (linkul paginii de produs).")
    return
  }

  const html = process.env.HTML
    ? readFileSync(process.env.HTML, "utf-8")
    : (await fetchPage(url)).html

  logger.info(`Sursă: ${process.env.HTML ?? url} (${Math.round(html.length / 1024)} KB)`)

  const base = extractProduct(html, url)
  logger.info(
    `Euristica (${base.sourceLabel}): ${base.specs.length} specificații, ` +
      `${base.images.length} poze, descriere ${base.descriptionHtml.length} caractere.`
  )

  const thin = isThinExtraction(base)
  logger.info(thin ? "Prea puțin — modelul ar fi chemat." : "Destul — modelul NU ar fi chemat.")

  if (!aiExtractionEnabled()) {
    logger.warn("ANTHROPIC_API_KEY lipsește (sau PRODUCT_IMPORT_AI=off) — restul se oprește aici.")
    return
  }
  if (!thin && process.env.FORCE !== "1") {
    logger.info("Pune FORCE=1 dacă vrei să vezi oricum ce ar scoate modelul.")
    return
  }

  const started = Date.now()
  const ai = await aiExtract(html, url)
  if (!ai) {
    logger.error("Modelul n-a întors un răspuns utilizabil.")
    return
  }

  const price = PRICES[ai.model.replace(/-\d{8}$/, "")]
  const cost = price
    ? (ai.usage.input * price.input + ai.usage.output * price.output) / 1_000_000
    : null

  logger.info(
    `Model ${ai.model}: ${ai.specs.length} specificații, ${ai.images.length} poze, ` +
      `descriere ${ai.descriptionHtml?.length ?? 0} caractere, în ${Math.round((Date.now() - started) / 1000)}s.`
  )
  logger.info(
    `Tokeni: ${ai.usage.input} intrare / ${ai.usage.output} ieșire` +
      (cost !== null ? ` ≈ $${cost.toFixed(4)}` : " (model fără preț în tabelul din script)")
  )

  // Notele conțin și ce s-a aruncat la verificare — partea care spune dacă
  // modelul a inventat. O fișă „bogată" cu multe aruncări e un semnal, nu un
  // succes.
  for (const note of ai.notes) logger.warn(`  · ${note}`)

  const merged = mergeAiExtraction(base, ai)
  logger.info(
    `După contopire: ${merged.specs.length} specificații, ${merged.images.length} poze, ` +
      `descriere ${merged.descriptionHtml.length} caractere.`
  )
  for (const spec of merged.specs.slice(0, 15)) {
    logger.info(`    ${spec.label}: ${spec.value}`)
  }
}
