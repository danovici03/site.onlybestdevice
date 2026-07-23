/**
 * Client pentru TBI Bank eCommerce (rate online).
 * Documentație: „eCommerce API Documentation" (tbibank.ro, iunie 2024).
 *
 * Fluxul: construim JSON-ul comenzii → îl criptăm RSA (cheia publică SFTL_
 * primită de la TBI, chunk-uri de (bits/8 − 11) cu padding PKCS#1) → base64 →
 * POST form-urlencoded {order_data, providerCode} la /Finalize → răspunsul
 * are în header-ul Location URL-ul unde redirecționăm clientul. Statusurile
 * vin pe `back_ref`, criptate cu cheia publică a comerciantului — le
 * decriptăm cu cheia noastră privată.
 */

import { constants, privateDecrypt, publicEncrypt } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'

export type TbiClientOptions = {
  /** 'live' sau 'uat'. */
  env: string
  /** store_id / providerCode — codul comerciantului în platforma TBI. */
  storeId: string
  username: string
  password: string
  /** Cheia publică SFTL_ (PEM) pentru criptarea cererilor. */
  publicKeyPath: string
  /** Cheia privată a comerciantului (PEM) pentru decriptarea statusurilor. */
  privateKeyPath: string
  /** Parola cheii private, dacă are. */
  privateKeyPassphrase?: string
}

const ENDPOINTS = {
  live: {
    finalize: 'https://ecommerce.tbibank.ro/Api/LoanApplication/Finalize',
    cancel:
      'https://ecommerce.tbibank.ro/Api/LoanApplication/CanceledByCustomer',
  },
  uat: {
    finalize:
      'https://vmrouatftos01.westeurope.cloudapp.azure.com/LoanApplication/Finalize',
    cancel:
      'https://vmrouatftos01.westeurope.cloudapp.azure.com/LoanApplication/CanceledByCustomer',
  },
}

export type TbiOrderPayload = {
  order_id: string
  back_ref: string
  order_total: string
  customer: {
    fname: string
    lname: string
    cnp: string
    email: string
    phone: string
    billing_address: string
    billing_city: string
    billing_county: string
    shipping_address: string
    shipping_city: string
    shipping_county: string
    instalments: string
    promo: 0 | 1
  }
  items: {
    name: string
    qty: string
    price: number
    category: string
    sku: string
    ImageLink: string
  }[]
}

/**
 * Unpadding PKCS#1 v1.5 (block type 2): 0x00 0x02 <≥8 octeți random ≠0>
 * 0x00 <mesaj>. Cu NO_PADDING, rezultatul decriptării are lungimea cheii,
 * eventual fără zeroul inițial.
 */
function pkcs1v15Unpad(raw: Buffer): Buffer {
  let i = 0
  if (raw[i] === 0x00) i++
  if (raw[i] !== 0x02) {
    throw new TbiError('Padding PKCS#1 invalid în callback-ul TBI')
  }
  i++
  while (i < raw.length && raw[i] !== 0x00) i++
  if (i >= raw.length) {
    throw new TbiError('Padding PKCS#1 fără terminator în callback-ul TBI')
  }
  return raw.subarray(i + 1)
}

export class TbiError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message)
    this.name = 'TbiError'
  }
}

export class TbiClient {
  constructor(private readonly options: TbiClientOptions) {}

  private endpoints() {
    return this.options.env === 'live' ? ENDPOINTS.live : ENDPOINTS.uat
  }

  private publicKey(): string {
    return readFileSync(path.resolve(process.cwd(), this.options.publicKeyPath), 'utf8')
  }

  /**
   * Criptarea din spec: chunk = bits/8 − 11, PKCS#1 v1.5, concatenat, base64.
   */
  encrypt(plaintext: string): string {
    const keyPem = this.publicKey()
    // Mărimea cheii: derivăm din lungimea unui bloc criptat (keyBytes).
    const probe = publicEncrypt(
      { key: keyPem, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from('x')
    )
    const keyBytes = probe.length
    const chunkSize = keyBytes - 11
    const data = Buffer.from(plaintext, 'utf8')
    const out: Buffer[] = []
    for (let i = 0; i < data.length; i += chunkSize) {
      out.push(
        publicEncrypt(
          { key: keyPem, padding: constants.RSA_PKCS1_PADDING },
          data.subarray(i, i + chunkSize)
        )
      )
    }
    return Buffer.concat(out).toString('base64')
  }

  /**
   * Decriptarea statusurilor: base64 → chunk-uri de keyBytes → PKCS#1 v1.5.
   *
   * Node ≥20.12 a dezactivat privateDecrypt cu RSA_PKCS1_PADDING
   * (CVE-2023-46809), dar spec-ul TBI cere exact acest padding — așa că
   * decriptăm cu NO_PADDING și facem unpadding-ul PKCS#1 v1.5 manual
   * (0x00 0x02 <random> 0x00 <mesaj>).
   */
  decrypt(base64: string): string {
    const keyPem = readFileSync(
      path.resolve(process.cwd(), this.options.privateKeyPath),
      'utf8'
    )
    const key = {
      key: keyPem,
      padding: constants.RSA_NO_PADDING,
      ...(this.options.privateKeyPassphrase
        ? { passphrase: this.options.privateKeyPassphrase }
        : {}),
    }
    const data = Buffer.from(base64, 'base64')
    // keyBytes = mărimea unui bloc criptat; încercăm mărimile uzuale de chei.
    for (const keyBytes of [256, 384, 512, 128]) {
      if (data.length === 0 || data.length % keyBytes !== 0) continue
      try {
        const out: Buffer[] = []
        for (let i = 0; i < data.length; i += keyBytes) {
          const raw = privateDecrypt(key, data.subarray(i, i + keyBytes))
          out.push(pkcs1v15Unpad(raw))
        }
        return Buffer.concat(out).toString('utf8')
      } catch {
        // mărime greșită — încercăm următoarea
      }
    }
    throw new TbiError('Decriptarea callback-ului TBI a eșuat')
  }

  /**
   * Creează cererea de credit și întoarce URL-ul de redirect pentru client.
   */
  async finalize(payload: TbiOrderPayload): Promise<string> {
    const body = {
      store_id: this.options.storeId,
      username: this.options.username,
      password: this.options.password,
      ...payload,
    }
    const orderData = this.encrypt(JSON.stringify(body))

    const form = new URLSearchParams()
    form.set('order_data', orderData)
    form.set('providerCode', this.options.storeId)

    const res = await fetch(this.endpoints().finalize, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      redirect: 'manual', // URL-ul de client vine în header-ul Location
      signal: AbortSignal.timeout(20_000),
    })

    const location = res.headers.get('location')
    if (res.status === 401) {
      throw new TbiError('Credențiale TBI invalide', 401)
    }
    if (!location) {
      const text = await res.text().catch(() => '')
      throw new TbiError('TBI nu a întors URL de redirect', res.status, text)
    }
    return location
  }

  /** Anulare de către client — permisă doar înainte de aprobare. */
  async cancelByCustomer(orderId: string): Promise<void> {
    const orderData = this.encrypt(
      JSON.stringify({
        orderId,
        statusId: '1',
        username: this.options.username,
        password: this.options.password,
      })
    )
    const form = new URLSearchParams()
    form.set('orderData', orderData)
    form.set('encryptCode', this.options.storeId)

    const res = await fetch(this.endpoints().cancel, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(20_000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || body?.isSuccess === false) {
      throw new TbiError('Anularea cererii TBI a eșuat', res.status, body)
    }
  }
}

let singleton: TbiClient | null = null

/** Clientul TBI configurat din env — folosit de rutele API. */
export function getTbiClient(): TbiClient {
  if (!singleton) {
    const storeId = process.env.TBI_STORE_ID
    const username = process.env.TBI_USERNAME
    const password = process.env.TBI_PASSWORD
    const publicKeyPath = process.env.TBI_PUBLIC_KEY_PATH
    const privateKeyPath = process.env.TBI_PRIVATE_KEY_PATH
    if (!storeId || !username || !password || !publicKeyPath || !privateKeyPath) {
      throw new TbiError(
        'Config TBI incompletă — vezi TBI_* în backend/.env (store id, user, parolă, căi chei)'
      )
    }
    singleton = new TbiClient({
      env: process.env.TBI_ENV || 'uat',
      storeId,
      username,
      password,
      publicKeyPath,
      privateKeyPath,
      privateKeyPassphrase: process.env.TBI_PRIVATE_KEY_PASSPHRASE,
    })
  }
  return singleton
}
