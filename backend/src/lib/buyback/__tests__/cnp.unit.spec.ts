import { isValidCnp } from "../cnp"

describe("isValidCnp", () => {
  it("acceptă CNP-uri valide", () => {
    expect(isValidCnp("1800101420010")).toBe(true)
    expect(isValidCnp("1800 1014 2001 0")).toBe(true)
  })
  it("respinge cifra de control greșită, data imposibilă și formatul", () => {
    expect(isValidCnp("1800101420011")).toBe(false)
    expect(isValidCnp("1800230420018")).toBe(false) // 30 februarie, cifra de control corectă
    expect(isValidCnp("123")).toBe(false)
    expect(isValidCnp("0800101420010")).toBe(false)
  })
})
