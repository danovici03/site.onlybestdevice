/**
 * Clientul HTTP catre ERP-ul din Laravel (aplicatia de gestiune).
 *
 * Semnatura e identica cu cea folosita de WooCommerce, ca partea de Laravel sa
 * verifice la fel pe ambele canale: base64(HMAC-SHA256(body brut, secret)),
 * trimisa in `X-OBD-Signature`. Corpul semnat trebuie sa fie EXACT string-ul
 * trimis, de aceea serializam o singura data si trimitem string-ul, nu obiectul.
 */

export type ErpPostResult = {
  ok: boolean
  status: number
  body?: unknown
  error?: string
}

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = [500, 2000]

export const isErpConfigured = (): boolean =>
  !!process.env.ERP_WEBHOOK_URL && !!process.env.ERP_WEBHOOK_SECRET

/**
 * Trimite un payload catre ERP. Reincearca la erori de retea si la 5xx —
 * un 4xx (semnatura gresita, payload invalid) nu se repara prin reincercare.
 */
export const postToErp = async (
  event: string,
  payload: Record<string, unknown>,
  logger?: { info: (m: string) => void; warn: (m: string) => void },
): Promise<ErpPostResult> => {
  const url = process.env.ERP_WEBHOOK_URL
  const secret = process.env.ERP_WEBHOOK_SECRET

  if (!url || !secret) {
    logger?.info(
      "[erp] ERP_WEBHOOK_URL / ERP_WEBHOOK_SECRET nesetate — sincronizarea cu Laravel e oprita.",
    )
    return { ok: false, status: 0, error: "not_configured" }
  }

  // Import lenes: `crypto` e built-in, dar il tinem local ca fisierul sa poata fi
  // importat si din contexte care nu-l au (teste unitare pe payload).
  const { createHmac } = await import("node:crypto")

  const body = JSON.stringify(payload)
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64")

  let lastError = ""

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OBD-Signature": signature,
          "X-OBD-Event": event,
        },
        body,
        signal: AbortSignal.timeout(20_000),
      })

      const text = await res.text().catch(() => "")

      if (res.ok) {
        logger?.info(`[erp] ${event} → ${res.status} ${text.slice(0, 200)}`)
        return { ok: true, status: res.status, body: safeJson(text) }
      }

      // 4xx: payload sau semnatura gresite — reincercarea da acelasi rezultat.
      if (res.status >= 400 && res.status < 500) {
        logger?.warn(`[erp] ${event} respins cu ${res.status}: ${text.slice(0, 300)}`)
        return { ok: false, status: res.status, body: safeJson(text) }
      }

      lastError = `${res.status}: ${text.slice(0, 200)}`
    } catch (e) {
      lastError = (e as Error).message
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS[attempt] ?? 2000))
    }
  }

  logger?.warn(`[erp] ${event} esuat dupa ${MAX_ATTEMPTS} incercari: ${lastError}`)
  return { ok: false, status: 0, error: lastError }
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
