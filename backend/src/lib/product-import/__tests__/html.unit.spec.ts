import { absolutizeUrls, find, findAll, innerHtml, parseHtml, text } from "../html"

/**
 * Parserul e scris de mână, deci aici stau exact tiparele din paginile reale
 * care l-ar rupe. Fiecare test e un bug care s-ar vedea în magazin.
 */
describe("parseHtml", () => {
  it("închide implicit celulele lăsate deschise", () => {
    // Fără implicit close, al doilea `td` ar deveni copilul primului, iar
    // eticheta și valoarea s-ar citi ca o singură celulă.
    const root = parseHtml("<table><tr><td>Culoare<td>Argintiu</table>")
    const cells = findAll(root, { tag: "td" })
    expect(cells.map(text)).toEqual(["Culoare", "Argintiu"])
  })

  it("nu parsează markup din interiorul unui script", () => {
    // eMAG duplică descrierea într-un `<script type="text/template">`. Dacă
    // parserul ar intra în el, am importa descrierea de două ori.
    const root = parseHtml(
      '<div id="real"><p>bun</p></div><script type="text/template"><div id="real"><p>duplicat</p></div></script>'
    )
    expect(findAll(root, { id: "real" })).toHaveLength(1)
    expect(text(find(root, { id: "real" })!)).toBe("bun")
  })

  it("tolerează JSON cu `<` în script", () => {
    const root = parseHtml('<script>var a = 1 < 2;</script><p>după</p>')
    expect(text(find(root, { tag: "p" })!)).toBe("după")
  })

  it("ignoră o închidere orfană în loc să desfacă arborele", () => {
    const root = parseHtml("<div><p>a</p></span><p>b</p></div>")
    expect(findAll(root, { tag: "p" }).map(text)).toEqual(["a", "b"])
  })

  it("decodează entitățile, inclusiv pe cele dublu-encodate", () => {
    // `&amp;nbsp;` (trecut de două ori prin CKEditor) trebuie să rămână textul
    // „&nbsp;", nu să devină spațiu — altfel pierdem un `&` real.
    const root = parseHtml("<p>a &amp;nbsp; b &nbsp; c &#8364;</p>")
    expect(text(find(root, { tag: "p" })!)).toBe("a &nbsp; b c €")
  })

  it("nu ia textul din script în `text()`", () => {
    const root = parseHtml("<div>vizibil<script>ascuns</script></div>")
    expect(text(find(root, { tag: "div" })!)).toBe("vizibil")
  })
})

describe("absolutizeUrls", () => {
  it("rezolvă căile relative față de pagina sursă", () => {
    const root = parseHtml('<img src="/media/a.jpg"><img data-src="b.jpg">')
    absolutizeUrls(root, "https://shop.ro/produse/telefon")
    const imgs = findAll(root, { tag: "img" })
    expect(imgs[0].attrs.src).toBe("https://shop.ro/media/a.jpg")
    expect(imgs[1].attrs["data-src"]).toBe("https://shop.ro/produse/b.jpg")
  })

  it("respectă `<base href>`, ca browserul", () => {
    const root = parseHtml('<base href="https://cdn.ro/x/"><img src="a.jpg">')
    absolutizeUrls(root, "https://shop.ro/p/1")
    expect(find(root, { tag: "img" })!.attrs.src).toBe("https://cdn.ro/x/a.jpg")
  })

  it("nu atinge `data:` — un base64 rescris ar deveni un URL fals", () => {
    const root = parseHtml('<img src="data:image/png;base64,AAA">')
    absolutizeUrls(root, "https://shop.ro/p/1")
    expect(find(root, { tag: "img" })!.attrs.src).toBe("data:image/png;base64,AAA")
  })

  it("rezolvă fiecare candidat din srcset", () => {
    const root = parseHtml('<img srcset="a.jpg 1x, /b.jpg 2x">')
    absolutizeUrls(root, "https://shop.ro/p/1")
    expect(find(root, { tag: "img" })!.attrs.srcset).toBe(
      "https://shop.ro/p/a.jpg 1x, https://shop.ro/b.jpg 2x"
    )
  })
})

describe("innerHtml", () => {
  it("re-serializează cu entitățile reescapate", () => {
    const root = parseHtml("<div><p>a &amp; b</p><br></div>")
    expect(innerHtml(find(root, { tag: "div" })!)).toBe("<p>a &amp; b</p><br>")
  })
})
