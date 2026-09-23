import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { TbiError } from "../../../modules/tbi-pay/client"
import {
  MAX_TOTAL_ATTEMPTS,
  buildTbiPayload,
  classifyError,
  submitTbiApplication,
} from "../submit-application"

const tbiOrder = (metadata: Record<string, any> = {}) => ({
  id: "order_1",
  display_id: 42,
  email: "ion@example.com",
  status: "pending",
  canceled_at: null,
  currency_code: "ron",
  total: 2337,
  shipping_total: 38,
  metadata,
  items: [
    {
      product_title: "iPhone 16e",
      quantity: 1,
      unit_price: 2299,
      variant_sku: "IP16E",
      thumbnail: "https://x/img.jpg",
    },
  ],
  shipping_address: {
    first_name: "Ion",
    last_name: "Popescu",
    phone: "0722123456",
    address_1: "Str. A 1",
    city: "Cluj-Napoca",
    province: "Cluj",
  },
  billing_address: { address_1: "Str. A 1", city: "Cluj-Napoca", province: "Cluj" },
  payment_collections: [
    { payment_sessions: [{ provider_id: "pp_tbi_tbi", data: { credit_period: 24 } }] },
  ],
})

/**
 * Container minim: query.graph citește comanda curentă, updateOrders face
 * merge pe primul nivel (ca Medusa), locking serializează apelurile pe cheie.
 */
const makeContainer = (initial: any) => {
  const state = { order: initial }
  const notifications: any[] = []
  const locks = new Map<string, Promise<unknown>>()
  const services: Record<string, any> = {
    [ContainerRegistrationKeys.LOGGER]: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    [ContainerRegistrationKeys.QUERY]: {
      graph: async () => ({ data: [structuredClone(state.order)] }),
    },
    [Modules.ORDER]: {
      updateOrders: async (_id: string, { metadata }: any) => {
        state.order = {
          ...state.order,
          metadata: { ...state.order.metadata, ...metadata },
        }
      },
    },
    [Modules.NOTIFICATION]: {
      createNotifications: async (n: any) => {
        notifications.push(n)
      },
    },
    [Modules.LOCKING]: {
      execute: async (key: string, job: () => Promise<unknown>) => {
        const prev = locks.get(key) ?? Promise.resolve()
        const run = prev.then(job, job)
        locks.set(key, run.catch(() => undefined))
        return run
      },
    },
  }
  return {
    container: { resolve: (k: string) => services[k] },
    state,
    notifications,
  }
}

const deps = (finalize: jest.Mock) => ({
  finalize,
  sleep: async () => undefined,
  now: () => new Date("2026-09-23T12:00:00Z"),
})

beforeEach(() => {
  process.env.ADMIN_ORDER_NOTIFICATION_EMAIL = "office@example.com"
  process.env.MEDUSA_BACKEND_URL = "https://api.example.ro"
  process.env.TBI_CALLBACK_TOKEN = "tok"
})

describe("buildTbiPayload", () => {
  it("include transportul, ca suma liniilor să fie order_total", () => {
    const p = buildTbiPayload(tbiOrder(), {
      backendUrl: "https://api.example.ro/",
      callbackToken: "tok",
    })
    expect(p.order_id).toBe("42")
    expect(p.order_total).toBe("2337.00")
    expect(p.back_ref).toBe("https://api.example.ro/hooks/tbi?token=tok")
    expect(p.customer.instalments).toBe("24")
    expect(p.customer.promo).toBe(0)
    expect(p.items.map((i) => i.price)).toEqual([2299, 38])
  })
})

const connRefused = () =>
  Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } })
const timeout = () => Object.assign(new Error("aborted"), { name: "TimeoutError" })

describe("classifyError", () => {
  it("reîncearcă doar ce sigur n-a ajuns la TBI", () => {
    expect(classifyError(connRefused())).toBe("retriable")
    expect(classifyError(new TbiError("x", 503))).toBe("retriable")
    expect(classifyError(new TbiError("x", 429))).toBe("retriable")
  })
  it("timeout, conexiune ruptă, 500/504 → incert (poate a creat cererea)", () => {
    expect(classifyError(timeout())).toBe("uncertain")
    expect(
      classifyError(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }))
    ).toBe("uncertain")
    expect(classifyError(new TbiError("x", 500))).toBe("uncertain")
    expect(classifyError(new TbiError("x", 504))).toBe("uncertain")
  })
  it("401, 4xx și config lipsă → fatal", () => {
    expect(classifyError(new TbiError("x", 401))).toBe("fatal")
    expect(classifyError(new TbiError("x", 400))).toBe("fatal")
    expect(classifyError(new TbiError("config lipsă"))).toBe("fatal")
  })
})

describe("submitTbiApplication", () => {
  it("trimite o dată și salvează linkul", async () => {
    const { container, state, notifications } = makeContainer(tbiOrder())
    const finalize = jest.fn().mockResolvedValue("https://tbi/app/1")

    const r = await submitTbiApplication(container, "order_1", { source: "subscriber" }, deps(finalize))

    expect(r).toEqual({ status: "submitted", redirect_url: "https://tbi/app/1", already: false })
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(state.order.metadata.tbi).toMatchObject({
      status: "pending",
      redirect_url: "https://tbi/app/1",
      submitted_via: "subscriber",
      attempts: 1,
    })
    expect(notifications).toHaveLength(0)
  })

  it("subscriber-ul și storefront-ul în paralel → o singură cerere la TBI", async () => {
    const { container } = makeContainer(tbiOrder())
    const finalize = jest.fn().mockResolvedValue("https://tbi/app/1")

    const [a, b] = await Promise.all([
      submitTbiApplication(container, "order_1", { source: "subscriber" }, deps(finalize)),
      submitTbiApplication(container, "order_1", { source: "storefront" }, deps(finalize)),
    ])

    expect(finalize).toHaveBeenCalledTimes(1)
    expect(a).toMatchObject({ status: "submitted", redirect_url: "https://tbi/app/1" })
    expect(b).toMatchObject({ status: "submitted", redirect_url: "https://tbi/app/1", already: true })
  })

  it("reîncearcă eroarea trecătoare în același apel", async () => {
    const { container, state } = makeContainer(tbiOrder())
    const finalize = jest
      .fn()
      .mockRejectedValueOnce(connRefused())
      .mockResolvedValueOnce("https://tbi/app/1")

    const r = await submitTbiApplication(container, "order_1", { source: "storefront" }, deps(finalize))

    expect(r.status).toBe("submitted")
    expect(finalize).toHaveBeenCalledTimes(2)
    expect(state.order.metadata.tbi.attempts).toBe(2)
  })

  it("eșec trecător: consemnează, alertează o dată, lasă job-ul să reîncerce", async () => {
    const { container, state, notifications } = makeContainer(tbiOrder({ emails: { x: 1 } }))
    const finalize = jest.fn().mockRejectedValue(new TbiError("down", 503, "Service Unavailable"))

    const r = await submitTbiApplication(container, "order_1", { source: "subscriber" }, deps(finalize))

    expect(r).toMatchObject({ status: "failed", retriable: true, gave_up: false })
    expect(finalize).toHaveBeenCalledTimes(3)
    expect(state.order.metadata.emails).toEqual({ x: 1 }) // restul metadata rămâne
    expect(state.order.metadata.tbi).toMatchObject({
      status: "submit_failed",
      attempts: 3,
      retriable: true,
      alerted_at: "2026-09-23T12:00:00.000Z",
    })
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      to: "office@example.com",
      template: "tbi-submit-alert-admin",
      data: { kind: "failed" },
    })

    // A doua rundă eșuată (job) nu mai trimite încă o alertă.
    await submitTbiApplication(container, "order_1", { source: "job", attempts: 1 }, deps(finalize))
    expect(notifications).toHaveLength(1)
    expect(state.order.metadata.tbi.attempts).toBe(4)
  })

  it("401 nu se reîncearcă: renunță pe loc", async () => {
    const { container, state, notifications } = makeContainer(tbiOrder())
    const finalize = jest.fn().mockRejectedValue(new TbiError("Credențiale TBI invalide", 401))

    const r = await submitTbiApplication(container, "order_1", { source: "storefront" }, deps(finalize))

    expect(r).toMatchObject({ status: "failed", retriable: false, gave_up: true })
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(state.order.metadata.tbi.gave_up_at).toBeDefined()
    expect(notifications.map((n) => n.data.kind)).toEqual(["gave_up"])

    // Abandonată: niciun apel nou la TBI.
    await submitTbiApplication(container, "order_1", { source: "job", attempts: 1 }, deps(finalize))
    expect(finalize).toHaveBeenCalledTimes(1)
  })

  it("la plafon renunță și trimite alerta finală", async () => {
    const { container, notifications } = makeContainer(
      tbiOrder({
        tbi: {
          status: "submit_failed",
          attempts: MAX_TOTAL_ATTEMPTS - 1,
          retriable: true,
          alerted_at: "2026-09-23T11:00:00.000Z",
        },
      })
    )
    const finalize = jest.fn().mockRejectedValue(connRefused())

    const r = await submitTbiApplication(container, "order_1", { source: "job", attempts: 1 }, deps(finalize))

    expect(r).toMatchObject({ status: "failed", gave_up: true })
    expect(notifications.map((n) => n.data.kind)).toEqual(["gave_up"])
  })

  it("reușita după alertă trimite linkul pentru client", async () => {
    const { container, notifications } = makeContainer(
      tbiOrder({
        tbi: {
          status: "submit_failed",
          attempts: 3,
          retriable: true,
          alerted_at: "2026-09-23T11:00:00.000Z",
        },
      })
    )
    const finalize = jest.fn().mockResolvedValue("https://tbi/app/9")

    await submitTbiApplication(container, "order_1", { source: "job", attempts: 1 }, deps(finalize))

    expect(notifications).toHaveLength(1)
    expect(notifications[0].data).toMatchObject({
      kind: "recovered",
      redirect_url: "https://tbi/app/9",
    })
  })

  it("nu retrimite comenzi anulate, ne-TBI sau cu status de la TBI", async () => {
    const finalize = jest.fn()
    const cases = [
      { ...tbiOrder(), status: "canceled" },
      { ...tbiOrder(), payment_collections: [{ payment_sessions: [{ provider_id: "pp_cod_cod" }] }] },
      tbiOrder({ tbi: { status: "approved" } }),
    ]
    for (const order of cases) {
      const { container } = makeContainer(order)
      const r = await submitTbiApplication(container, "order_1", { source: "job" }, deps(finalize))
      expect(r.status).toBe("skipped")
    }
    expect(finalize).not.toHaveBeenCalled()
  })

  it("timeout: nu retrimite, marchează incert și alertează", async () => {
    const { container, state, notifications } = makeContainer(tbiOrder())
    const finalize = jest.fn().mockRejectedValue(timeout())

    const r = await submitTbiApplication(container, "order_1", { source: "subscriber" }, deps(finalize))
    expect(r.status).toBe("uncertain")
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(state.order.metadata.tbi.status).toBe("submit_uncertain")
    expect(notifications.map((n) => n.data.kind)).toEqual(["uncertain"])

    // Nici storefront-ul, nici job-ul nu mai trimit.
    await submitTbiApplication(container, "order_1", { source: "storefront" }, deps(finalize))
    await submitTbiApplication(container, "order_1", { source: "job", attempts: 1 }, deps(finalize))
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(notifications).toHaveLength(1)
  })

  it("linkul nesalvat: marcajul `submitting` oprește retrimiterea", async () => {
    const { container, state, notifications } = makeContainer(tbiOrder())
    const orderModule = container.resolve(Modules.ORDER)
    const realUpdate = orderModule.updateOrders
    orderModule.updateOrders = async (id: string, data: any) => {
      if (data.metadata.tbi.status === "pending") throw new Error("pool timeout")
      return realUpdate(id, data)
    }
    const finalize = jest.fn().mockResolvedValue("https://tbi/app/1")

    await expect(
      submitTbiApplication(container, "order_1", { source: "subscriber" }, deps(finalize))
    ).rejects.toThrow("pool timeout")
    expect(state.order.metadata.tbi.status).toBe("submitting")

    orderModule.updateOrders = realUpdate
    const r = await submitTbiApplication(container, "order_1", { source: "storefront" }, deps(finalize))
    expect(r.status).toBe("uncertain")
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(state.order.metadata.tbi.status).toBe("submit_uncertain")
    expect(notifications.map((n) => n.data.kind)).toEqual(["uncertain"])
  })

  it("storefront-ul nu reîncearcă imediat după eșecul subscriber-ului", async () => {
    const { container } = makeContainer(tbiOrder())
    const finalize = jest.fn().mockRejectedValue(connRefused())

    await submitTbiApplication(container, "order_1", { source: "subscriber" }, deps(finalize))
    expect(finalize).toHaveBeenCalledTimes(3)
    const r = await submitTbiApplication(container, "order_1", { source: "storefront" }, deps(finalize))
    expect(r).toMatchObject({ status: "failed", retriable: true })
    expect(finalize).toHaveBeenCalledTimes(3)
  })

  it("reușita din subscriber după alertă nu trimite „recuperat”", async () => {
    const { container, notifications } = makeContainer(
      tbiOrder({ tbi: { status: "submit_failed", attempts: 3, retriable: true, alerted_at: "x" } })
    )
    const finalize = jest.fn().mockResolvedValue("https://tbi/app/1")
    await submitTbiApplication(container, "order_1", { source: "subscriber" }, deps(finalize))
    expect(notifications).toHaveLength(0)
  })

  it("comanda anulată nu mai întoarce linkul vechi", async () => {
    const { container } = makeContainer({
      ...tbiOrder({ tbi: { status: "cancelled", redirect_url: "https://tbi/app/1" } }),
      status: "canceled",
    })
    const r = await submitTbiApplication(container, "order_1", { source: "storefront" }, deps(jest.fn()))
    expect(r.status).toBe("skipped")
  })

  it("cererea respinsă de TBI nu mai întoarce linkul vechi", async () => {
    const { container } = makeContainer(
      tbiOrder({ tbi: { status: "rejected", redirect_url: "https://tbi/app/1" } })
    )
    const r = await submitTbiApplication(container, "order_1", { source: "storefront" }, deps(jest.fn()))
    expect(r.status).toBe("skipped")
  })
})
