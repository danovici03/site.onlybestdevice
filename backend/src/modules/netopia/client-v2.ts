/**
 * Client pentru Netopia Payments API v2 (JSON + apiKey).
 *
 * Diferența față de v1 (`client.ts`): nu mai criptăm nimic. Trimitem un JSON
 * la `/payment/card/start` cu cheia API în headerul `Authorization`, iar
 * Netopia ne întoarce `payment.paymentURL` — pagina lor de plată, unde apar
 * și Apple Pay / Google Pay / Click to Pay (activate pe cont, nu din cod).
 *
 * Confirmarea vine tot prin IPN pe `/hooks/netopia`, dar altfel:
 *  - body JSON (nu env_key + data criptate)
 *  - header `Verification-token` = JWT semnat RSA de Netopia
 *  - `sub` din JWT = base64(sha512(body-ul RAW)) — de aici nevoia de
 *    `preserveRawBody` în `src/api/middlewares.ts`; un `JSON.stringify` peste
 *    body-ul parsat dă alt hash și IPN-ul ar pica.
 *
 * Contract verificat pe SDK-ul oficial (github.com/netopiapayments/go-sdk),
 * pluginul WooCommerce oficial și OpenAPI-ul servit de ei la
 * https://secure.sandbox.netopia-payments.com/spec
 */

import { X509Certificate, createHash, createVerify } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { NetopiaError } from './client'

const BASE_URLS = {
  live: 'https://secure.mobilpay.ro/pay',
  sandbox: 'https://secure.sandbox.netopia-payments.com',
}

/** Statusurile de plată Netopia (aceleași în v1 și v2). */
export const NETOPIA_STATUS = {
  NEW: 1,
  OPENED: 2,
  PAID: 3,
  CANCELED: 4,
  CONFIRMED: 5,
  PENDING: 6,
  SCHEDULED: 7,
  CREDIT: 8,
  CHARGEBACK_INIT: 9,
  CHARGEBACK_ACCEPT: 10,
  ERROR: 11,
  DECLINED: 12,
  FRAUD: 13,
  PENDING_AUTH: 14,
  THREE_D_AUTH: 15,
  CHARGEBACK_REPRESENTMENT: 16,
  REVERSED: 17,
  PENDING_ANY: 18,
  PROGRAMMED_RECURRENT: 19,
  CANCELED_PROGRAMMED: 20,
  TRIAL_PENDING: 21,
  TRIAL: 22,
  EXPIRED: 23,
} as const

/**
 * Traducem statusul numeric în vocabularul folosit deja de v1 în
 * `order.metadata.netopia.status`, ca restul codului (și comenzile vechi) să
 * nu simtă diferența.
 */
export function statusToAction(status: number): string {
  switch (status) {
    case NETOPIA_STATUS.PAID:
    case NETOPIA_STATUS.CONFIRMED:
      return 'confirmed'
    case NETOPIA_STATUS.CANCELED:
    case NETOPIA_STATUS.EXPIRED:
      return 'canceled'
    case NETOPIA_STATUS.CREDIT:
      return 'credit'
    case NETOPIA_STATUS.ERROR:
    case NETOPIA_STATUS.DECLINED:
      return 'error'
    case NETOPIA_STATUS.FRAUD:
      return 'fraud'
    default:
      return 'paid_pending'
  }
}

export type NetopiaV2Options = {
  /** 'sandbox' sau 'live'. */
  env: string
  apiKey: string
  signature: string
  publicCerPath: string
}

export type NetopiaV2Address = {
  email: string
  phone: string
  firstName: string
  lastName: string
  city: string
  /** Cod ISO 3166-1 numeric (România = 642). */
  country: number
  countryName: string
  state: string
  postalCode: string
  details: string
}

export type NetopiaV2StartRequest = {
  orderId: string
  /** Suma în unități întregi de monedă (lei), nu bani. */
  amount: number
  currency: string
  description: string
  notifyUrl: string
  redirectUrl: string
  cancelUrl: string
  billing: NetopiaV2Address
  shipping: NetopiaV2Address
  products: Array<{
    name: string
    code: string
    category: string
    price: number
    vat: number
  }>
}

export type NetopiaV2StartResult = {
  paymentUrl: string
  ntpId?: string
  status?: number
}

/** Payload-ul IPN-ului v2, doar câmpurile care ne interesează. */
export type NetopiaV2Ipn = {
  order?: { orderID?: string; posSignature?: string }
  payment?: {
    ntpID?: string
    status?: number
    amount?: number
    currency?: string
    method?: string
    code?: string
    message?: string
  }
}

const ALG_TO_DIGEST: Record<string, string> = {
  RS256: 'RSA-SHA256',
  RS384: 'RSA-SHA384',
  RS512: 'RSA-SHA512',
}

const b64url = (s: string): Buffer => Buffer.from(s, 'base64url')

export class NetopiaV2Client {
  constructor(private readonly options: NetopiaV2Options) {}

  baseUrl(): string {
    return this.options.env === 'live' ? BASE_URLS.live : BASE_URLS.sandbox
  }

  private cert(): X509Certificate {
    const pem = readFileSync(
      path.resolve(process.cwd(), this.options.publicCerPath),
      'utf8'
    )
    return new X509Certificate(pem)
  }

  /**
   * Deschide plata și întoarce URL-ul paginii Netopia. Nu trimitem date de
   * card (`instrument.type = 'card'` și atât), deci rămânem în afara PCI —
   * clientul le introduce la ei, unde are și wallet-urile.
   */
  async startCardPayment(
    req: NetopiaV2StartRequest
  ): Promise<NetopiaV2StartResult> {
    const body = {
      config: {
        emailTemplate: 'confirm',
        emailSubject: '',
        notifyUrl: req.notifyUrl,
        redirectUrl: req.redirectUrl,
        cancelUrl: req.cancelUrl,
        language: 'ro',
      },
      payment: {
        options: { installments: 0, bonus: 0 },
        instrument: { type: 'card' },
        data: {},
      },
      order: {
        ntpID: '',
        posSignature: this.options.signature,
        dateTime: new Date().toISOString(),
        description: req.description,
        orderID: req.orderId,
        amount: req.amount,
        currency: req.currency,
        billing: req.billing,
        shipping: req.shipping,
        products: req.products,
        installments: { selected: 0, available: [0] },
        data: {},
      },
    }

    let res: Response
    try {
      res = await fetch(`${this.baseUrl()}/payment/card/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.options.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (e: any) {
      throw new NetopiaError(`Netopia nu răspunde: ${e?.message}`, e)
    }

    const text = await res.text()
    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      throw new NetopiaError(
        `Răspuns Netopia neparsabil (HTTP ${res.status})`,
        text.slice(0, 500)
      )
    }

    if (!res.ok) {
      throw new NetopiaError(
        `Netopia a respins cererea (HTTP ${res.status}): ${
          json?.error?.message ?? json?.message ?? 'fără detalii'
        }`,
        json
      )
    }

    const paymentUrl: string | undefined =
      json?.payment?.paymentURL || json?.customerAction?.url
    if (!paymentUrl) {
      throw new NetopiaError(
        `Netopia nu a întors URL de plată: ${
          json?.error?.message ?? json?.message ?? 'fără detalii'
        }`,
        json
      )
    }

    return {
      paymentUrl,
      ntpId: json?.payment?.ntpID,
      status: json?.payment?.status,
    }
  }

  /**
   * Verifică JWT-ul din headerul `Verification-token` și întoarce IPN-ul
   * parsat. Aruncă dacă semnătura, emitentul, POS-ul sau hash-ul body-ului nu
   * corespund — adică dacă cineva încearcă să ne confirme singur o comandă.
   */
  verifyIpn(token: string, rawBody: Buffer): NetopiaV2Ipn {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new NetopiaError('Verification-token malformat')
    }
    const [headerB64, payloadB64, signatureB64] = parts

    let header: any
    let claims: any
    try {
      header = JSON.parse(b64url(headerB64).toString('utf8'))
      claims = JSON.parse(b64url(payloadB64).toString('utf8'))
    } catch {
      throw new NetopiaError('Verification-token neparsabil')
    }

    const digest = ALG_TO_DIGEST[header?.alg]
    if (!digest) {
      throw new NetopiaError(`Algoritm JWT nesuportat: ${header?.alg}`)
    }

    const ok = createVerify(digest)
      .update(`${headerB64}.${payloadB64}`)
      .verify(this.cert().publicKey, b64url(signatureB64))
    if (!ok) {
      throw new NetopiaError('Semnătura IPN-ului nu se verifică')
    }

    if (claims.iss !== 'NETOPIA Payments') {
      throw new NetopiaError(`Emitent IPN neașteptat: ${claims.iss}`)
    }

    const aud = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud
    if (aud !== this.options.signature) {
      throw new NetopiaError('IPN-ul e pentru alt POS')
    }

    // 60s toleranță pentru decalajul de ceas dintre serverele lor și al nostru.
    const now = Math.floor(Date.now() / 1000)
    if (typeof claims.exp === 'number' && now > claims.exp + 60) {
      throw new NetopiaError('Verification-token expirat')
    }
    if (typeof claims.nbf === 'number' && now + 60 < claims.nbf) {
      throw new NetopiaError('Verification-token încă nevalid')
    }

    const hash = createHash('sha512').update(rawBody).digest('base64')
    if (hash !== claims.sub) {
      throw new NetopiaError('Body-ul IPN-ului nu corespunde cu hash-ul semnat')
    }

    try {
      return JSON.parse(rawBody.toString('utf8')) as NetopiaV2Ipn
    } catch {
      throw new NetopiaError('Body IPN neparsabil')
    }
  }
}

let singleton: NetopiaV2Client | null = null

/** True când e configurat API-ul v2 (adică avem cheie de la Netopia). */
export const isNetopiaV2Enabled = (): boolean =>
  Boolean(
    process.env.NETOPIA_API_KEY &&
      process.env.NETOPIA_POS_SIGNATURE &&
      process.env.NETOPIA_PUBLIC_CER_PATH
  )

export function getNetopiaV2Client(): NetopiaV2Client {
  if (!singleton) {
    const apiKey = process.env.NETOPIA_API_KEY
    const signature = process.env.NETOPIA_POS_SIGNATURE
    const publicCerPath = process.env.NETOPIA_PUBLIC_CER_PATH
    if (!apiKey || !signature || !publicCerPath) {
      throw new NetopiaError(
        'Config Netopia v2 incompletă — vezi NETOPIA_API_KEY / NETOPIA_POS_SIGNATURE / NETOPIA_PUBLIC_CER_PATH'
      )
    }
    singleton = new NetopiaV2Client({
      env: process.env.NETOPIA_ENV || 'sandbox',
      apiKey,
      signature,
      publicCerPath,
    })
  }
  return singleton
}

/**
 * Cod ISO 3166-1 numeric pentru țările din care primim comenzi. Netopia cere
 * numărul, nu codul de 2 litere. Fallback pe România.
 */
const COUNTRY_NUMERIC: Record<string, number> = {
  ro: 642,
  md: 498,
  bg: 100,
  hu: 348,
  gr: 300,
  it: 380,
  de: 276,
  at: 40,
  fr: 250,
  es: 724,
  nl: 528,
  be: 56,
  pl: 616,
  cz: 203,
  sk: 703,
  gb: 826,
  ie: 372,
  pt: 620,
  se: 752,
  dk: 208,
  fi: 246,
  us: 840,
}

export const countryNumeric = (code?: string | null): number =>
  COUNTRY_NUMERIC[(code ?? '').toLowerCase()] ?? COUNTRY_NUMERIC.ro
