import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  getTbiClient,
  tbiPromo,
  TbiError,
  type TbiOrderPayload,
} from "../../modules/tbi-pay/client"

/**
 * Trimiterea cererii de credit la TBI (Finalize), dintr-un singur loc.
 *
 * O cheamă trei surse, pe aceeași comandă:
 *   - subscriber-ul `order.placed` — garanția: cererea pleacă și dacă
 *     storefront-ul pică între plasarea comenzii și redirect;
 *   - `/store/tbi/session` — storefront-ul are nevoie de URL-ul TBI pe loc,
 *     ca să redirecționeze clientul;
 *   - job-ul `tbi-submit-retry` — reîncearcă eșecurile trecătoare.
 *
 * Toate trec prin același lacăt per comandă (îl ia și anularea, vezi
 * `withTbiOrderLock`), iar înăuntru verificăm întâi ce s-a întâmplat deja. Două
 * cereri cu același order_id ar însemna două dosare de credit pentru un client,
 * așa că regula e: la orice dubiu, NU retrimitem — alertăm un om.
 *
 * Stările din `metadata.tbi.status` scrise aici:
 *   - `submitting`       — marcaj pus ÎNAINTE de apelul la TBI. Dacă îl găsim
 *                          la următorul apel, cel dinainte a murit pe drum (sau
 *                          n-a putut salva linkul) și nu știm dacă cererea
 *                          există → o tratăm ca `submit_uncertain`;
 *   - `pending`          — cererea există, `redirect_url` e salvat;
 *   - `submit_failed`    — sigur n-a ajuns la TBI; `retriable` spune dacă
 *                          job-ul o mai încearcă;
 *   - `submit_uncertain` — timeout sau conexiune ruptă după trimitere: poate
 *                          există la TBI. Nu reîncercăm; cineva verifică în
 *                          platforma TBI.
 *
 * Alertele pe email (ADMIN_ORDER_NOTIFICATION_EMAIL) pleacă după eliberarea
 * lacătului, ca un Resend lent să nu țină comanda blocată.
 */

/** Încercări rapide în același apel (checkout, subscriber). */
export const ATTEMPTS_PER_CALL = 3
const RETRY_DELAYS_MS = [1_000, 3_000]
/**
 * După atâta timp nu mai începem o încercare nouă în același apel. Cu
 * timeout-ul de 20 s al clientului, un apel ține cel mult ~50 s — sub
 * expirarea lacătului, deci nu intră nimeni peste noi.
 */
const CALL_DEADLINE_MS = 30_000
/** Plafonul total, cu tot cu reîncercările din job. */
export const MAX_TOTAL_ATTEMPTS = 9
/**
 * Expirarea lacătului = și cât așteaptă al doilea apelant. Trebuie să
 * depășească cu mult un apel întreg (vezi CALL_DEADLINE_MS): dacă expiră cât
 * lucrăm, al doilea intră peste noi.
 */
const LOCK_TIMEOUT_S = 90

export type SubmitSource = "storefront" | "subscriber" | "job"

export type SubmitResult =
  | { status: "submitted"; redirect_url: string; already: boolean }
  | { status: "failed"; error: string; retriable: boolean; gave_up: boolean }
  | { status: "uncertain"; error: string }
  | { status: "skipped"; reason: string }

/** Ce facem cu o eroare de la Finalize. */
export type ErrorKind =
  /** Sigur n-a ajuns (sau TBI indisponibil) — se poate reîncerca. */
  | "retriable"
  /** Poate a creat cererea — nu retrimitem. */
  | "uncertain"
  /** Nu se repară singură (credențiale, config, date respinse). */
  | "fatal"

type Deps = {
  finalize: (payload: TbiOrderPayload) => Promise<string>
  sleep: (ms: number) => Promise<void>
  now: () => Date
}

const defaultDeps = (): Deps => ({
  finalize: (payload) => getTbiClient().finalize(payload),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => new Date(),
})

export const TBI_ORDER_FIELDS = [
  "id",
  "display_id",
  "email",
  "status",
  "canceled_at",
  "currency_code",
  "total",
  "shipping_total",
  "metadata",
  // `items.*`, nu sub-câmpuri punctuale: totalurile comenzii se calculează
  // doar când linia e cerută întreagă. Cu `items.quantity`/`items.unit_price`
  // enumerate, `order.total` și `shipping_total` ies 0 — adică am fi trimis
  // la TBI o cerere de credit pe 0,00 lei.
  "items.*",
  "shipping_methods.*",
  "shipping_address.first_name",
  "shipping_address.last_name",
  "shipping_address.phone",
  "shipping_address.address_1",
  "shipping_address.city",
  "shipping_address.province",
  "billing_address.address_1",
  "billing_address.city",
  "billing_address.province",
  "payment_collections.payment_sessions.provider_id",
  "payment_collections.payment_sessions.data",
]

const tbiSession = (order: any) =>
  (order?.payment_collections ?? [])
    .flatMap((pc: any) => pc?.payment_sessions ?? [])
    .find((ps: any) => ps?.provider_id?.includes("_tbi_"))

/** Comanda are plata „Rate prin TBI Bank"? Cere `payment_collections.payment_sessions.provider_id`. */
export const isTbiOrder = (order: any) => Boolean(tbiSession(order))

/**
 * Rulează `job` sub lacătul TBI al comenzii. Îl iau trimiterea și retragerea
 * cererii (anularea comenzii), ca o anulare venită în timpul trimiterii să
 * vadă cererea deja salvată și s-o retragă.
 */
export const withTbiOrderLock = <T>(
  container: any,
  orderId: string,
  job: () => Promise<T>
): Promise<T> =>
  container
    .resolve(Modules.LOCKING)
    .execute(`tbi-submit:${orderId}`, job, { timeout: LOCK_TIMEOUT_S })

/** Payload-ul pentru Finalize, conform „eCommerce API Documentation" §4. */
export const buildTbiPayload = (
  order: any,
  { backendUrl, callbackToken }: { backendUrl: string; callbackToken?: string }
): TbiOrderPayload => {
  const session = tbiSession(order)
  const instalments = String(Number(session?.data?.credit_period) || 12)
  // Medusa v2 ține sumele ca zecimale în moneda regiunii, deci `total` e deja
  // în lei — TBI așteaptă tot lei (exemplele din documentație: 2500, 2199.99).
  const orderTotal = Number(order.total ?? 0)

  const items = (order.items ?? []).map((item: any) => ({
    name: item?.product_title || item?.title || "Produs",
    qty: Number(item?.quantity ?? 1).toFixed(4),
    price: Number(item?.unit_price ?? 0),
    category: "2",
    sku: item?.variant_sku ?? "",
    ImageLink: item?.thumbnail ?? "",
  }))

  // Transportul intră în valoarea finanțată, ca suma articolelor trimise la
  // TBI să fie exact `order_total` (care îl include). Fără linia asta, TBI
  // primește un coș mai mic decât totalul cerut. Vezi și ruta UniCredit.
  const shippingTotal = Number(order.shipping_total ?? 0)
  if (shippingTotal > 0) {
    items.push({
      name: "Transport",
      qty: "1.0000",
      price: shippingTotal,
      category: "2",
      sku: "TRANSPORT",
      ImageLink: "",
    })
  }

  const base = backendUrl.replace(/\/$/, "")
  return {
    // TBI cere order_id numeric unic — folosim display_id; callback-ul
    // găsește comanda tot după el.
    order_id: String(order.display_id),
    back_ref: `${base}/hooks/tbi${callbackToken ? `?token=${callbackToken}` : ""}`,
    order_total: orderTotal.toFixed(2),
    customer: {
      fname: order.shipping_address?.first_name ?? "",
      lname: order.shipping_address?.last_name ?? "",
      cnp: "",
      email: order.email ?? "",
      phone: order.shipping_address?.phone ?? "",
      billing_address: order.billing_address?.address_1 ?? "",
      billing_city: order.billing_address?.city ?? "",
      billing_county: order.billing_address?.province ?? "",
      shipping_address: order.shipping_address?.address_1 ?? "",
      shipping_city: order.shipping_address?.city ?? "",
      shipping_county: order.shipping_address?.province ?? "",
      instalments,
      promo: tbiPromo(orderTotal),
    },
    items,
  }
}

/** Erori de conectare: cererea n-a plecat din mașina noastră. */
const NOT_SENT_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
])

/**
 * Reîncercăm doar când e sigur că TBI n-a creat cererea: conexiunea n-a
 * pornit, sau TBI a zis explicit că e indisponibil (502/503/429/408).
 * Timeout-ul, conexiunea ruptă, 500 și 504 pot veni DUPĂ ce cererea s-a
 * înregistrat — acolo o retrimitere ar deschide un al doilea dosar de credit.
 */
export const classifyError = (err: unknown): ErrorKind => {
  if (err instanceof TbiError) {
    const status = err.status
    if (status === undefined || status === 401) return "fatal"
    if ([408, 429, 502, 503].includes(status)) return "retriable"
    // Azure răspunde 403 „Web App - Unavailable" („This web app is stopped")
    // când aplicația TBI e oprită sau repornește: cererea nu a fost procesată.
    // Văzut pe 23.09.2026 — un minut mai târziu, aceeași cerere a trecut.
    if (status === 403 && /Web App - Unavailable|web app is stopped/i.test(String(err.body ?? ""))) {
      return "retriable"
    }
    if (status >= 500) return "uncertain"
    return "fatal"
  }
  const code = (err as any)?.cause?.code ?? (err as any)?.code
  return code && NOT_SENT_CODES.has(code) ? "retriable" : "uncertain"
}

const describeError = (err: unknown): string => {
  if (err instanceof TbiError) {
    const raw = typeof err.body === "string" ? err.body : err.body ? JSON.stringify(err.body) : ""
    const body = raw.slice(0, 300)
    return [err.message, err.status ? `HTTP ${err.status}` : "", body]
      .filter(Boolean)
      .join(" — ")
  }
  const e = err as any
  return e?.name === "TimeoutError" || e?.name === "AbortError"
    ? "TBI nu a răspuns în 20 de secunde"
    : e?.cause?.code
      ? `${e?.message} (${e.cause.code})`
      : e?.message ?? String(err)
}

/** Scrie doar cheia `tbi`: Medusa face merge pe primul nivel al metadata. */
const saveTbi = async (container: any, orderId: string, tbi: Record<string, unknown>) => {
  const orderModule = container.resolve(Modules.ORDER)
  await orderModule.updateOrders(orderId, { metadata: { tbi } })
}

type AlertKind = "failed" | "gave_up" | "uncertain" | "recovered"

type Alert = {
  kind: AlertKind
  order: any
  details: { error?: string; retriable?: boolean; attempts: number; redirect_url?: string }
}

const sendAlert = async (container: any, { kind, order, details }: Alert) => {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const to = process.env.ADMIN_ORDER_NOTIFICATION_EMAIL
  if (!to) {
    logger.error(
      `[tbi] Alertă „${kind}" pentru comanda #${order.display_id} netrimisă: ADMIN_ORDER_NOTIFICATION_EMAIL nu e setat.`
    )
    return
  }
  try {
    const notification = container.resolve(Modules.NOTIFICATION)
    await notification.createNotifications({
      to,
      channel: "email",
      template: "tbi-submit-alert-admin",
      data: {
        kind,
        order,
        ...details,
        admin_url: process.env.MEDUSA_BACKEND_URL || process.env.ADMIN_URL,
        storefront_url: process.env.STOREFRONT_URL,
      },
    })
  } catch (e: any) {
    // Fără provider de notificări (sau Resend căzut) rămâne măcar logul.
    logger.error(`[tbi] Alerta „${kind}" pentru comanda #${order.display_id} a eșuat: ${e?.message}`)
  }
}

export async function submitTbiApplication(
  container: any,
  orderId: string,
  {
    source,
    attempts: attemptsThisCall = ATTEMPTS_PER_CALL,
  }: { source: SubmitSource; attempts?: number },
  deps: Deps = defaultDeps()
): Promise<SubmitResult> {
  const { result, alert } = await withTbiOrderLock(container, orderId, () =>
    submitLocked(container, orderId, source, attemptsThisCall, deps)
  )
  if (alert) await sendAlert(container, alert)
  return result
}

async function submitLocked(
  container: any,
  orderId: string,
  source: SubmitSource,
  attemptsThisCall: number,
  deps: Deps
): Promise<{ result: SubmitResult; alert?: Alert }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  // Citit abia după ce avem lacătul: dacă altcineva tocmai a trimis cererea,
  // vedem linkul lui, nu starea de dinainte.
  const { data: orders } = await query.graph({
    entity: "order",
    fields: TBI_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = orders?.[0]
  const skip = (reason: string) => ({ result: { status: "skipped" as const, reason } })
  if (!order) return skip("Comanda nu există")
  if (!isTbiOrder(order)) return skip("Comanda nu are plata în rate TBI")
  if (order.status === "canceled" || order.canceled_at) return skip("Comanda e anulată")

  const prev = ((order.metadata as any)?.tbi ?? {}) as Record<string, any>
  const nowIso = () => deps.now().toISOString()

  if (prev.status === "pending" && prev.redirect_url) {
    return {
      result: { status: "submitted", redirect_url: prev.redirect_url, already: true },
    }
  }

  // Marcajul de dinainte de Finalize a rămas: apelul anterior a murit între
  // trimitere și salvare. Cererea poate exista la TBI — nu o dublăm.
  if (prev.status === "submitting" || prev.status === "submit_uncertain") {
    const error =
      prev.last_error ?? "Trimiterea anterioară s-a întrerupt înainte să salvăm răspunsul TBI"
    let alert: Alert | undefined
    if (prev.status === "submitting") {
      await saveTbi(container, order.id, {
        ...prev,
        status: "submit_uncertain",
        last_error: error,
        alerted_at: prev.alerted_at ?? nowIso(),
      })
      if (!prev.alerted_at) {
        alert = { kind: "uncertain", order, details: { error, attempts: Number(prev.attempts ?? 0) } }
      }
    }
    return { result: { status: "uncertain", error }, alert }
  }

  // Alte statusuri (aprobat/respins/retras de TBI, comenzi de dinainte de
  // `redirect_url`): cererea a existat — nu o recreăm.
  if (prev.status && prev.status !== "submit_failed") {
    return skip(`Cererea TBI e deja în starea „${prev.status}"`)
  }

  if (prev.status === "submit_failed" && (prev.gave_up_at || source === "storefront")) {
    // Checkout-ul nu mai reîncearcă după ce subscriber-ul a eșuat chiar acum:
    // clientul ar aștepta încă un rând de timeout-uri. Reia job-ul.
    return {
      result: {
        status: "failed",
        error: prev.last_error ?? "Trimiterea a eșuat",
        retriable: Boolean(prev.retriable) && !prev.gave_up_at,
        gave_up: Boolean(prev.gave_up_at),
      },
    }
  }

  const payload = buildTbiPayload(order, {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
    callbackToken: process.env.TBI_CALLBACK_TOKEN,
  })
  const base = {
    order_id: payload.order_id,
    instalments: payload.customer.instalments,
    ...(prev.alerted_at ? { alerted_at: prev.alerted_at } : {}),
  }

  let attempts = Number(prev.attempts ?? 0)
  let lastErr: unknown = null
  let kind: ErrorKind = "retriable"
  const budget = Math.max(0, Math.min(attemptsThisCall, MAX_TOTAL_ATTEMPTS - attempts))
  const startedAt = Date.now()

  for (let i = 0; i < budget; i++) {
    if (i > 0 && Date.now() - startedAt > CALL_DEADLINE_MS) break
    attempts++
    await saveTbi(container, order.id, {
      ...base,
      status: "submitting",
      submitting_at: nowIso(),
      submitted_via: source,
      attempts,
    })

    let redirectUrl: string
    try {
      redirectUrl = await deps.finalize(payload)
    } catch (err) {
      lastErr = err
      kind = classifyError(err)
      logger.warn(
        `[tbi] Încercarea ${attempts} pentru comanda #${order.display_id} a eșuat (${source}, ${kind}): ${describeError(err)}`
      )
      if (kind !== "retriable") break
      if (i < budget - 1) await deps.sleep(RETRY_DELAYS_MS[i] ?? 3_000)
      continue
    }

    // Cererea există la TBI. Dacă salvarea pică, marcajul `submitting` rămâne
    // și următorul apel NU retrimite; linkul ajunge măcar în log.
    try {
      await saveTbi(container, order.id, {
        ...base,
        status: "pending",
        redirect_url: redirectUrl,
        requested_at: nowIso(),
        submitted_via: source,
        attempts,
      })
    } catch (e: any) {
      logger.error(
        `[tbi] Cererea pentru comanda #${order.display_id} E CREATĂ la TBI, dar n-am putut salva linkul (${e?.message}). Link: ${redirectUrl}`
      )
      throw e
    }
    logger.info(
      `[tbi] Cerere de credit creată pentru comanda #${order.display_id} (${source}, încercarea ${attempts}).`
    )
    // Doar job-ul are nevoie de alerta „recuperat": checkout-ul și subscriber-ul
    // sunt încă în fluxul clientului, care e redirecționat de storefront.
    const alert: Alert | undefined =
      prev.alerted_at && source === "job"
        ? { kind: "recovered", order, details: { attempts, redirect_url: redirectUrl } }
        : undefined
    return { result: { status: "submitted", redirect_url: redirectUrl, already: false }, alert }
  }

  const error = lastErr ? describeError(lastErr) : "Plafonul de încercări a fost atins"

  if (lastErr && kind === "uncertain") {
    await saveTbi(container, order.id, {
      ...base,
      status: "submit_uncertain",
      attempts,
      last_error: error,
      last_attempt_at: nowIso(),
      alerted_at: prev.alerted_at ?? nowIso(),
    })
    logger.error(
      `[tbi] Nu știm dacă cererea pentru comanda #${order.display_id} a fost creată: ${error} — nu retrimitem, de verificat în platforma TBI.`
    )
    return {
      result: { status: "uncertain", error },
      alert: prev.alerted_at ? undefined : { kind: "uncertain", order, details: { error, attempts } },
    }
  }

  const retriable = Boolean(lastErr) && kind === "retriable"
  const gaveUp = !retriable || attempts >= MAX_TOTAL_ATTEMPTS

  let alert: Alert | undefined
  if (!prev.alerted_at) {
    alert = { kind: gaveUp ? "gave_up" : "failed", order, details: { error, retriable, attempts } }
  } else if (gaveUp && !prev.gave_up_alert_at) {
    alert = { kind: "gave_up", order, details: { error, retriable, attempts } }
  }

  await saveTbi(container, order.id, {
    ...base,
    status: "submit_failed",
    attempts,
    retriable,
    last_error: error,
    last_attempt_at: nowIso(),
    alerted_at: prev.alerted_at ?? nowIso(),
    ...(gaveUp ? { gave_up_at: nowIso(), gave_up_alert_at: prev.gave_up_alert_at ?? nowIso() } : {}),
  })
  logger.error(
    `[tbi] Cererea pentru comanda #${order.display_id} NU a fost creată după ${attempts} încercări: ${error}${gaveUp ? " — renunțăm." : " — reîncercăm din job."}`
  )
  return { result: { status: "failed", error, retriable, gave_up: gaveUp }, alert }
}
