import { createHash, createSign } from 'crypto'
import { execFileSync } from 'child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { NetopiaV2Client, statusToAction } from '../client-v2'

/**
 * Verificarea IPN-urilor v2 e singura bucată pe care nu o putem proba end-to-end
 * înainte de a merge pe live (n-avem cum să semnăm noi un IPN cu cheia
 * Netopia). O testăm cu un certificat self-signed generat la runtime: dacă
 * logica de JWT + hash e corectă aici, e corectă și cu certificatul lor.
 */

const POS = 'TEST-POS-SIGNATURE'

let cerPath: string
let keyPem: string

beforeAll(() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'netopia-test-'))
  cerPath = path.join(dir, 'test.cer')
  const keyPath = path.join(dir, 'test.key')
  execFileSync('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyPath,
    '-out',
    cerPath,
    '-days',
    '2',
    '-subj',
    '/CN=netopia-test',
  ])
  keyPem = readFileSync(keyPath, 'utf8')
})

const client = () =>
  new NetopiaV2Client({
    env: 'sandbox',
    apiKey: 'irrelevant',
    signature: POS,
    publicCerPath: cerPath,
  })

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64url')

/** Construiește un JWT RS512 ca al lor: sub = base64(sha512(body)). */
const sign = (
  body: string,
  overrides: Record<string, unknown> = {},
  digest = 'RSA-SHA512'
) => {
  const header = b64url(JSON.stringify({ alg: 'RS512', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: 'NETOPIA Payments',
    aud: POS,
    sub: createHash('sha512').update(body).digest('base64'),
    iat: now,
    exp: now + 300,
    ...overrides,
  }
  const payload = b64url(JSON.stringify(claims))
  const signature = createSign(digest)
    .update(`${header}.${payload}`)
    .sign(keyPem)
  return `${header}.${payload}.${b64url(signature)}`
}

const BODY = JSON.stringify({
  order: { orderID: 'order_01ABC' },
  payment: { ntpID: '123', status: 3, amount: 199.99, currency: 'RON' },
})

describe('NetopiaV2Client.verifyIpn', () => {
  it('acceptă un IPN semnat corect și întoarce payload-ul', () => {
    const ipn = client().verifyIpn(sign(BODY), Buffer.from(BODY))
    expect(ipn.order?.orderID).toBe('order_01ABC')
    expect(ipn.payment?.status).toBe(3)
  })

  it('respinge un body modificat după semnare', () => {
    const token = sign(BODY)
    const tampered = BODY.replace('199.99', '1.99')
    expect(() => client().verifyIpn(token, Buffer.from(tampered))).toThrow(
      /nu corespunde/
    )
  })

  it('respinge un IPN emis pentru alt POS', () => {
    expect(() =>
      client().verifyIpn(sign(BODY, { aud: 'ALT-POS' }), Buffer.from(BODY))
    ).toThrow(/alt POS/)
  })

  it('respinge un emitent străin', () => {
    expect(() =>
      client().verifyIpn(sign(BODY, { iss: 'cineva' }), Buffer.from(BODY))
    ).toThrow(/Emitent/)
  })

  it('respinge un token expirat', () => {
    const past = Math.floor(Date.now() / 1000) - 3600
    expect(() =>
      client().verifyIpn(
        sign(BODY, { iat: past, exp: past + 60 }),
        Buffer.from(BODY)
      )
    ).toThrow(/expirat/)
  })

  it('respinge o semnătură făcută cu altă cheie', () => {
    const token = sign(BODY)
    const [h, p] = token.split('.')
    const fake = `${h}.${p}.${b64url(Buffer.alloc(256, 7))}`
    expect(() => client().verifyIpn(fake, Buffer.from(BODY))).toThrow(
      /nu se verifică/
    )
  })

  it('respinge un token malformat', () => {
    expect(() => client().verifyIpn('nu-e-jwt', Buffer.from(BODY))).toThrow(
      /malformat/
    )
  })
})

describe('statusToAction', () => {
  it('mapează statusurile finale peste vocabularul v1', () => {
    expect(statusToAction(3)).toBe('confirmed')
    expect(statusToAction(5)).toBe('confirmed')
    expect(statusToAction(4)).toBe('canceled')
    expect(statusToAction(8)).toBe('credit')
    expect(statusToAction(12)).toBe('error')
    expect(statusToAction(13)).toBe('fraud')
    expect(statusToAction(15)).toBe('paid_pending')
  })
})
