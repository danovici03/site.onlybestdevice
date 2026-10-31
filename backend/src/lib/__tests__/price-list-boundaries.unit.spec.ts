import { BOUNDARY_WINDOW_MS, crossedBoundaries } from "../price-list-boundaries"

const NOW = new Date("2026-11-27T00:00:00+02:00").getTime()
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

const list = (overrides = {}) => ({
  title: "Black Friday",
  status: "active",
  starts_at: null,
  ends_at: null,
  ...overrides,
})

describe("crossedBoundaries", () => {
  it("startul exact la ora rulării contează", () => {
    expect(crossedBoundaries([list({ starts_at: at(0) })], NOW)).toEqual([
      "start „Black Friday”",
    ])
  })

  it("prinde și finalul listei", () => {
    expect(crossedBoundaries([list({ ends_at: at(-1000) })], NOW)).toEqual([
      "final „Black Friday”",
    ])
  })

  it("repetă marginea în fereastră, ca o rulare ratată să se recupereze", () => {
    const lists = [list({ starts_at: at(-BOUNDARY_WINDOW_MS + 1000) })]
    expect(crossedBoundaries(lists, NOW)).toHaveLength(1)
  })

  it("ignoră marginile viitoare și pe cele ieșite din fereastră", () => {
    const lists = [
      list({ starts_at: at(1000) }),
      list({ ends_at: at(-BOUNDARY_WINDOW_MS) }),
    ]
    expect(crossedBoundaries(lists, NOW)).toEqual([])
  })

  it("ignoră listele fără date și pe cele draft", () => {
    const lists = [list(), list({ status: "draft", starts_at: at(0) })]
    expect(crossedBoundaries(lists, NOW)).toEqual([])
  })
})
