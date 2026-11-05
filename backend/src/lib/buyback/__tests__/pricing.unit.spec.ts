import type { Answers, Rule } from "../catalog"
import { computeQuote, resolveRule } from "../pricing"

const iphone = { id: "bbdev_iphone16pro", brand: "Apple" }
const samsung = { id: "bbdev_s25u", brand: "Samsung" }

const perfect: Answers = {
  network: "unlocked",
  liquid: false,
  burn_in: false,
  screen: "perfect",
  case: "perfect",
  battery: 100,
  display_defects: [],
  phone_defects: [],
}

const rule = (r: Partial<Rule> & Pick<Rule, "key">): Rule => ({
  scope: "global",
  scope_value: "",
  kind: "fixed",
  value: 0,
  ...r,
})

const quote = (answers: Partial<Answers>, rules: Rule[] = [], device = iphone, basePrice: number | null = 3150) =>
  computeQuote({ device, basePrice, answers: { ...perfect, ...answers }, rules })

describe("computeQuote", () => {
  it("telefon perfect = prețul de bază, voucher cu bonus", () => {
    const q = quote({})
    expect(q.status).toBe("offer")
    if (q.status !== "offer") return
    expect(q.price).toBe(3150)
    expect(q.voucher_price).toBe(3460) // 3150 × 1.10 = 3465 → în jos la 10
    expect(q.deductions).toEqual([])
  })

  it("fără preț de bază ⇒ indisponibil", () => {
    expect(quote({}, [], iphone, null).status).toBe("unavailable")
  })

  it("bateria contează doar sub prag și doar la Apple", () => {
    expect(quote({ battery: 85 }).status === "offer" && (quote({ battery: 85 }) as any).price).toBe(3150)
    expect((quote({ battery: 79 }) as any).price).toBe(2850) // 3150 − 300
    expect((quote({ battery: 50 }, [], samsung) as any).price).toBe(3150)
  })

  it("pragul bateriei se schimbă din setări", () => {
    const rules = [rule({ key: "setting.battery_threshold", value: 85 })]
    expect((quote({ battery: 84 }, rules) as any).price).toBe(2850)
  })

  it("burn-in se ignoră la Apple", () => {
    expect((quote({ burn_in: true }) as any).price).toBe(3150)
    expect((quote({ burn_in: true }, [], samsung) as any).price).toBe(2200) // −30% = 945 → 2205 → 2200
  })

  it("în aceeași grupă se scade doar reparația cea mai mare", () => {
    const q = quote({ screen: "broken", display_defects: ["dead_pixels", "yellowed"] })
    if (q.status !== "offer") throw new Error(q.status)
    // ecran spart 35% = 1103 (aplicat), pixeli 25% și îngălbenit 25% acoperite
    expect(q.deductions.filter((d) => d.applied).map((d) => d.key)).toEqual(["screen.broken"])
    expect(q.total_deduction).toBe(1103)
    expect(q.price).toBe(2040)
  })

  it("grupe diferite se adună", () => {
    const q = quote({ screen: "visible", case: "visible", battery: 70 })
    if (q.status !== "offer") throw new Error(q.status)
    // 8% (252) + 6% (189) + 300
    expect(q.total_deduction).toBe(741)
    expect(q.price).toBe(2400)
  })

  it("lichid / operator străin / alte probleme ⇒ refuz, cu motive", () => {
    const q = quote({ liquid: true, network: "foreign" })
    expect(q.status).toBe("rejected")
    if (q.status === "rejected") expect(q.reasons).toHaveLength(2)
    expect(quote({ phone_defects: ["other"] }).status).toBe("rejected")
  })

  it("refuzul se poate transforma în scădere din reguli", () => {
    const q = quote({ liquid: true }, [rule({ key: "liquid.yes", kind: "percent", value: 50 })])
    expect(q.status).toBe("offer")
    if (q.status === "offer") expect(q.price).toBe(1570)
  })

  it("sub ofertă minimă ⇒ too_low", () => {
    const q = quote({ screen: "broken" }, [], iphone, 140)
    expect(q.status).toBe("too_low")
  })

  it("defectele duplicate nu se scad de două ori", () => {
    const q = quote({ phone_defects: ["muffled_sound", "muffled_sound"] })
    if (q.status !== "offer") throw new Error(q.status)
    expect(q.total_deduction).toBe(150)
  })
})

describe("resolveRule", () => {
  const rules = [
    rule({ key: "defect.biometrics", kind: "percent", value: 20 }),
    rule({ key: "defect.biometrics", scope: "brand", scope_value: "APPLE", kind: "percent", value: 40 }),
    rule({ key: "defect.biometrics", scope: "device", scope_value: "bbdev_s25u", kind: "fixed", value: 200 }),
  ]

  it("dispozitiv > brand > global > implicit", () => {
    expect(resolveRule(rules, "defect.biometrics", iphone)).toMatchObject({ value: 40, source: "brand" })
    expect(resolveRule(rules, "defect.biometrics", samsung)).toMatchObject({ value: 200, source: "device" })
    expect(resolveRule(rules, "defect.biometrics", { id: "x", brand: "Xiaomi" })).toMatchObject({
      value: 20,
      source: "global",
    })
    expect(resolveRule([], "defect.biometrics", iphone)).toMatchObject({ source: "default" })
  })

  it("setările globalOnly ignoră regulile pe brand", () => {
    const r = [rule({ key: "setting.rounding", scope: "brand", scope_value: "apple", value: 50 })]
    expect(resolveRule(r, "setting.rounding", iphone)).toMatchObject({ value: 10, source: "default" })
  })

  it("un tip nepermis pentru cheie e ignorat", () => {
    const r = [rule({ key: "setting.min_offer", kind: "reject" })]
    expect(resolveRule(r, "setting.min_offer", iphone)).toMatchObject({ source: "default" })
  })
})

describe("voucherAmount", () => {
  it("nu pierde un leu din virgula mobilă", () => {
    const { voucherAmount } = require("../pricing")
    expect(voucherAmount(100, 15, 1)).toBe(115)
    expect(voucherAmount(735, 10, 1)).toBe(808)
    expect(voucherAmount(735, 10, 10)).toBe(800)
    expect(voucherAmount(735, 10, 50)).toBe(800)
  })
})
