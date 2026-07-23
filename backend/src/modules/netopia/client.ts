/**
 * Client pentru Netopia mobilPay (plata cu cardul, API-ul clasic cu
 * env_key + data). Se potrivește cu pachetul de chei primit de la Netopia:
 * semnătura POS (XXXX-XXXX-…), certificatul public (.cer, folosit la
 * „sigilarea" cheii simetrice) și cheia privată (.key, folosită la
 * decriptarea IPN-urilor).
 *
 * Fluxul:
 *  1. construim XML-ul comenzii (<order type="card">…)
 *  2. generăm o cheie RC4 aleatoare, criptăm XML-ul cu ea, apoi criptăm
 *     cheia cu certificatul public (openssl_seal-style) → {env_key, data}
 *  3. storefront-ul trimite un <form> POST cu env_key + data către mobilPay,
 *     unde clientul introduce cardul
 *  4. Netopia trimite IPN-uri POST (env_key + data, criptate la fel) pe
 *     URL-ul de confirm — le decriptăm cu cheia privată și confirmăm plata.
 */

import {
  X509Certificate,
  constants,
  createDecipheriv,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

export type NetopiaOptions = {
  /** 'sandbox' sau 'live'. */
  env: string
  signature: string
  publicCerPath: string
  privateKeyPath: string
}

const PAYMENT_URLS = {
  live: 'https://secure.mobilpay.ro',
  sandbox: 'https://sandboxsecure.mobilpay.ro',
}

export class NetopiaError extends Error {
  constructor(message: string, readonly detail?: unknown) {
    super(message)
    this.name = 'NetopiaError'
  }
}

/** RC4 pur — OpenSSL 3 l-a mutat în provider-ul legacy, deci îl facem noi. */
function rc4(key: Buffer, input: Buffer): Buffer {
  const S = new Uint8Array(256)
  for (let i = 0; i < 256; i++) S[i] = i
  let j = 0
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xff
    ;[S[i], S[j]] = [S[j], S[i]]
  }
  const out = Buffer.alloc(input.length)
  let i = 0
  j = 0
  for (let k = 0; k < input.length; k++) {
    i = (i + 1) & 0xff
    j = (j + S[i]) & 0xff
    ;[S[i], S[j]] = [S[j], S[i]]
    out[k] = input[k] ^ S[(S[i] + S[j]) & 0xff]
  }
  return out
}

/**
 * Unpadding PKCS#1 v1.5 manual — Node ≥20 a blocat privateDecrypt cu
 * RSA_PKCS1_PADDING (CVE-2023-46809), dar mobilPay folosește exact acest
 * padding la sigilarea cheii simetrice.
 */
function pkcs1v15Unpad(raw: Buffer): Buffer {
  let i = 0
  if (raw[i] === 0x00) i++
  if (raw[i] !== 0x02) {
    throw new NetopiaError('Padding PKCS#1 invalid în IPN-ul Netopia')
  }
  i++
  while (i < raw.length && raw[i] !== 0x00) i++
  if (i >= raw.length) {
    throw new NetopiaError('Padding PKCS#1 fără terminator în IPN-ul Netopia')
  }
  return raw.subarray(i + 1)
}

export const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export type NetopiaPaymentRequest = {
  orderId: string
  /** Suma în lei, cu 2 zecimale. */
  amount: string
  currency: string
  details: string
  confirmUrl: string
  returnUrl: string
  billing: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
  }
}

export class NetopiaClient {
  constructor(private readonly options: NetopiaOptions) {}

  paymentUrl(): string {
    return this.options.env === 'live' ? PAYMENT_URLS.live : PAYMENT_URLS.sandbox
  }

  private buildXml(req: NetopiaPaymentRequest): string {
    const ts = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14)
    const b = req.billing
    const person = `
        <first_name>${xmlEscape(b.firstName)}</first_name>
        <last_name>${xmlEscape(b.lastName)}</last_name>
        <address>${xmlEscape(b.address)}</address>
        <email>${xmlEscape(b.email)}</email>
        <mobile_phone>${xmlEscape(b.phone)}</mobile_phone>`
    return `<?xml version="1.0" encoding="utf-8"?>
<order type="card" id="${xmlEscape(req.orderId)}" timestamp="${ts}">
  <signature>${this.options.signature}</signature>
  <invoice currency="${req.currency}" amount="${req.amount}">
    <details>${xmlEscape(req.details)}</details>
    <contact_info>
      <billing type="person">${person}
      </billing>
      <shipping type="person">${person}
      </shipping>
    </contact_info>
  </invoice>
  <url>
    <confirm>${xmlEscape(req.confirmUrl)}</confirm>
    <return>${xmlEscape(req.returnUrl)}</return>
  </url>
</order>`
  }

  /**
   * Criptarea „openssl_seal" cu RC4: cheie simetrică aleatoare → data,
   * cheia sigilată cu certificatul public → env_key. Ambele base64.
   */
  encrypt(req: NetopiaPaymentRequest): { envKey: string; data: string } {
    const xml = this.buildXml(req)
    const cerPem = readFileSync(
      path.resolve(process.cwd(), this.options.publicCerPath),
      'utf8'
    )
    const publicKey = new X509Certificate(cerPem).publicKey
    const symKey = randomBytes(16)
    const data = rc4(symKey, Buffer.from(xml, 'utf8'))
    const envKey = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
      symKey
    )
    return {
      envKey: envKey.toString('base64'),
      data: data.toString('base64'),
    }
  }

  /**
   * Decriptează un IPN: env_key (cheia sigilată) + data. mobilPay poate
   * folosi RC4 (implicit) sau AES-256-CBC (parametrii `cipher` + `iv`).
   */
  decryptIpn(
    envKeyB64: string,
    dataB64: string,
    cipher?: string,
    ivB64?: string
  ): string {
    const keyPem = readFileSync(
      path.resolve(process.cwd(), this.options.privateKeyPath),
      'utf8'
    )
    const sealed = Buffer.from(envKeyB64, 'base64')
    const raw = privateDecrypt(
      { key: keyPem, padding: constants.RSA_NO_PADDING },
      sealed
    )
    const symKey = pkcs1v15Unpad(raw)
    const data = Buffer.from(dataB64, 'base64')

    if (cipher && /aes/i.test(cipher)) {
      const iv = Buffer.from(ivB64 ?? '', 'base64')
      const d = createDecipheriv('aes-256-cbc', symKey, iv)
      return Buffer.concat([d.update(data), d.final()]).toString('utf8')
    }
    return rc4(symKey, data).toString('utf8')
  }
}

export type NetopiaIpn = {
  orderId: string | null
  action: string | null
  errorCode: string | null
  processedAmount: string | null
}

/** Extrage câmpurile relevante din XML-ul IPN, fără dependențe de parser. */
export function parseIpnXml(xml: string): NetopiaIpn {
  const attr = (re: RegExp) => xml.match(re)?.[1] ?? null
  return {
    orderId: attr(/<order[^>]*\sid="([^"]*)"/),
    action: attr(/<action>([^<]*)<\/action>/),
    errorCode: attr(/<error[^>]*\scode="([^"]*)"/),
    processedAmount: attr(/<processed_amount>([^<]*)<\/processed_amount>/),
  }
}

/** Răspunsul XML pe care mobilPay îl așteaptă la IPN. */
export const ipnResponse = (ok: boolean, message = 'OK'): string =>
  ok
    ? `<?xml version="1.0" encoding="utf-8"?><crc>${xmlEscape(message)}</crc>`
    : `<?xml version="1.0" encoding="utf-8"?><crc error_type="2" error_code="1">${xmlEscape(message)}</crc>`

let singleton: NetopiaClient | null = null

/** Clientul Netopia configurat din env — folosit de rutele API. */
export function getNetopiaClient(): NetopiaClient {
  if (!singleton) {
    const signature = process.env.NETOPIA_POS_SIGNATURE
    const publicCerPath = process.env.NETOPIA_PUBLIC_CER_PATH
    const privateKeyPath = process.env.NETOPIA_PRIVATE_KEY_PATH
    if (!signature || !publicCerPath || !privateKeyPath) {
      throw new NetopiaError(
        'Config Netopia incompletă — vezi NETOPIA_* în backend/.env'
      )
    }
    singleton = new NetopiaClient({
      env: process.env.NETOPIA_ENV || 'sandbox',
      signature,
      publicCerPath,
      privateKeyPath,
    })
  }
  return singleton
}
