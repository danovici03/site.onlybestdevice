import { WARRANTY_HANDLE } from "../../warranty-prices"
import { listOrderProducts } from "../order-products"

const phone = {
  product_title: "Telefon mobil Apple iPhone 17",
  product_handle: "iphone-17",
  quantity: 1,
}
const warranty = {
  product_title: "Garanție extinsă",
  product_handle: WARRANTY_HANDLE,
  quantity: 1,
}

describe("listOrderProducts — coloana „Produs vândut”", () => {
  it("nu numără garanția extinsă drept produs", () => {
    expect(listOrderProducts([phone, warranty])).toEqual([phone.product_title])
  })

  it("arată cantitatea doar când e mai mare de 1", () => {
    expect(listOrderProducts([{ ...phone, quantity: 2 }])).toEqual([
      "2 × Telefon mobil Apple iPhone 17",
    ])
  })

  it("păstrează toate produsele comenzii", () => {
    const keyboard = { product_title: "Magic Keyboard", quantity: 1 }
    expect(listOrderProducts([phone, warranty, keyboard])).toEqual([
      phone.product_title,
      "Magic Keyboard",
    ])
  })

  it("o comandă doar cu garanție nu pare goală", () => {
    expect(listOrderProducts([warranty])).toEqual(["Garanție extinsă"])
  })

  it("cade pe titlul liniei când lipsește cel al produsului", () => {
    expect(listOrderProducts([{ title: "Linie", quantity: 1 }])).toEqual([
      "Linie",
    ])
  })

  it("o comandă fără linii nu are produse", () => {
    expect(listOrderProducts([])).toEqual([])
    expect(listOrderProducts(undefined)).toEqual([])
  })
})
