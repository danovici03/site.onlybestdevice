import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

const cancelByCustomer = jest.fn().mockResolvedValue(undefined)
jest.mock("../../modules/tbi-pay/client", () => {
  const actual = jest.requireActual("../../modules/tbi-pay/client")
  return { ...actual, getTbiClient: () => ({ cancelByCustomer }) }
})

import handler from "../tbi-cancel-application"
import { submitTbiApplication } from "../../lib/tbi/submit-application"

const makeContainer = (order: any) => {
  const state = { order }
  const locks = new Map<string, Promise<unknown>>()
  const services: Record<string, any> = {
    [ContainerRegistrationKeys.LOGGER]: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    [ContainerRegistrationKeys.QUERY]: {
      graph: async () => ({ data: [structuredClone(state.order)] }),
    },
    [Modules.ORDER]: {
      updateOrders: async (_id: string, { metadata }: any) => {
        state.order = { ...state.order, metadata: { ...state.order.metadata, ...metadata } }
      },
    },
    [Modules.NOTIFICATION]: { createNotifications: jest.fn() },
    [Modules.LOCKING]: {
      execute: async (key: string, job: () => Promise<unknown>) => {
        const prev = locks.get(key) ?? Promise.resolve()
        const run = prev.then(job, job)
        locks.set(key, run.catch(() => undefined))
        return run
      },
    },
  }
  return { container: { resolve: (k: string) => services[k] } as any, state }
}

const order = {
  id: "order_1",
  display_id: 42,
  status: "pending",
  metadata: {},
  items: [],
  payment_collections: [{ payment_sessions: [{ provider_id: "pp_tbi_tbi", data: {} }] }],
}

beforeEach(() => cancelByCustomer.mockClear())

it("anularea venită în timpul trimiterii retrage cererea după ce se salvează", async () => {
  const { container, state } = makeContainer(order)
  let release!: (url: string) => void
  const finalize = jest.fn(() => new Promise<string>((r) => (release = r)))

  const submitting = submitTbiApplication(
    container,
    "order_1",
    { source: "subscriber" },
    { finalize, sleep: async () => undefined, now: () => new Date() }
  )
  // Anularea pornește cât Finalize e încă în drum spre TBI.
  const canceling = handler({ event: { data: { id: "order_1" } }, container } as any)
  await new Promise((r) => setImmediate(r))
  expect(cancelByCustomer).not.toHaveBeenCalled()

  release("https://tbi/app/1")
  await Promise.all([submitting, canceling])

  expect(cancelByCustomer).toHaveBeenCalledWith("42")
  expect(state.order.metadata.tbi).toMatchObject({ status: "cancelled" })
})

it("cererea incertă se retrage și ea", async () => {
  const { container } = makeContainer({ ...order, metadata: { tbi: { status: "submit_uncertain" } } })
  await handler({ event: { data: { id: "order_1" } }, container } as any)
  expect(cancelByCustomer).toHaveBeenCalledWith("42")
})

it("cererea respinsă de TBI nu se mai retrage", async () => {
  const { container } = makeContainer({ ...order, metadata: { tbi: { status: "rejected" } } })
  await handler({ event: { data: { id: "order_1" } }, container } as any)
  expect(cancelByCustomer).not.toHaveBeenCalled()
})
