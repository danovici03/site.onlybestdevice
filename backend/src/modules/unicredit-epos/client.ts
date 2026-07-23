/**
 * Client minimal pentru API-ul UniCredit ePOS (Credit Online UCFin).
 * Documentație: https://epos.unicredit.ro/docs/guides/
 *
 * Fluxul: login (Bearer, valabil ~1 an) → POST /api/online/offers cu produsele
 * din comandă → POST /api/online/selectOffer → `sessionUrl` unde redirecționăm
 * clientul ca să parcurgă creditarea la distanță.
 */

export type EposClientOptions = {
  /** Fără slash final. Staging: https://epos.unicredit.ro/TestOnline */
  baseUrl: string
  email: string
  password: string
}

export type EposProduct = {
  name: string
  price: number
  quantity: number
}

export type EposOffersPayload = {
  products: EposProduct[]
  gdpr: boolean
  /** ID-ul comenzii noastre — se întoarce în callback ca referință. */
  external_id: string
  /** Perioada de creditare dorită, în luni. */
  credit_period?: number
  email_address?: string
  phone_number?: string
  first_name?: string
  last_name?: string
  /** Unde se întoarce clientul după parcurgerea platformei ePOS. */
  redirect_url?: string
  /** Endpoint-ul nostru care primește statusurile cererii. */
  callback_url?: string
}

export type EposOffer = {
  id: number
  name: string
  installment: number
  dae: number
  credit_period_months: number
}

export type EposOffersResponse = {
  offers: EposOffer[]
  sessionID: string
}

export class EposError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown
  ) {
    super(message)
    this.name = 'EposError'
  }
}

export class EposClient {
  private accessToken: string | null = null
  private refreshToken: string | null = null

  constructor(private readonly options: EposClientOptions) {}

  private url(path: string): string {
    return `${this.options.baseUrl.replace(/\/$/, '')}${path}`
  }

  private async login(): Promise<void> {
    const res = await fetch(this.url('/api/online/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: this.options.email,
        password: this.options.password,
      }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.access_token) {
      throw new EposError('Autentificarea la UniCredit ePOS a eșuat', res.status, body)
    }
    this.accessToken = body.access_token
    this.refreshToken = body.refresh_token ?? null
  }

  /**
   * POST autenticat, cu un singur retry: la 401 re-face login (tokenul ține
   * ~1 an, dar poate fi invalidat oricând de bancă) și reia cererea.
   */
  private async post<T>(path: string, payload: unknown, retried = false): Promise<T> {
    if (!this.accessToken) {
      await this.login()
    }
    const res = await fetch(this.url(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    })
    if (res.status === 401 && !retried) {
      this.accessToken = null
      return this.post<T>(path, payload, true)
    }
    const body = await res.json().catch(() => null)
    if (!res.ok || body?.success === false) {
      throw new EposError(`Cererea către ePOS ${path} a eșuat`, res.status, body)
    }
    return (body?.data ?? body) as T
  }

  async getOffers(payload: EposOffersPayload): Promise<EposOffersResponse> {
    return this.post<EposOffersResponse>('/api/online/offers', payload)
  }

  async selectOffer(input: {
    sessionID: string
    offer_id: number
    email_address: string
  }): Promise<{ sessionUrl: string }> {
    return this.post<{ sessionUrl: string }>('/api/online/selectOffer', input)
  }
}

let singleton: EposClient | null = null

/** Clientul ePOS configurat din env — folosit de rutele API. */
export function getEposClient(): EposClient {
  if (!singleton) {
    const email = process.env.UNICREDIT_EPOS_EMAIL
    const password = process.env.UNICREDIT_EPOS_PASSWORD
    if (!email || !password) {
      throw new EposError('UNICREDIT_EPOS_EMAIL / UNICREDIT_EPOS_PASSWORD lipsesc din env')
    }
    singleton = new EposClient({
      baseUrl:
        process.env.UNICREDIT_EPOS_BASE_URL ||
        'https://epos.unicredit.ro/TestOnline',
      email,
      password,
    })
  }
  return singleton
}
