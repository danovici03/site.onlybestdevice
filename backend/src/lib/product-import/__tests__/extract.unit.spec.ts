import { extractProduct } from "../index"
import { parseHtml } from "../html"
import { extractJsonLd, repairJson } from "../sources/json-ld"
import { rehostImages, rewriteDescriptionImages } from "../rehost"

const PAGE_URL = "https://www.emag.ro/telefon-x/pd/D499FV3BM/"

describe("repairJson", () => {
  it("escapează newline-urile brute din interiorul stringurilor", () => {
    // JSON-LD-ul eMAG are newline-uri neescapate în `description`, deci
    // `JSON.parse` refuză din start cea mai bogată sursă din pagină.
    const broken = '{"a":"linia 1\nlinia 2","b":1}'
    expect(() => JSON.parse(broken)).toThrow()
    expect(JSON.parse(repairJson(broken))).toEqual({ a: "linia 1\nlinia 2", b: 1 })
  })

  it("nu atinge newline-urile dintre chei", () => {
    expect(JSON.parse(repairJson('{\n  "a": 1\n}'))).toEqual({ a: 1 })
  })
})

describe("extractJsonLd", () => {
  const ld = (obj: unknown) =>
    parseHtml(`<script type="application/ld+json">${JSON.stringify(obj)}</script>`)

  it("citește fișa din additionalProperty", () => {
    const result = extractJsonLd(
      ld({
        "@type": "Product",
        name: "Telefon X",
        brand: { "@type": "Brand", name: "Apple" },
        additionalProperty: [
          { "@type": "PropertyValue", name: "Culoare", value: "Argintiu" },
          { "@type": "PropertyValue", name: "Memorie RAM", value: "12 GB" },
        ],
      })
    )
    expect(result?.name).toBe("Telefon X")
    expect(result?.brand).toBe("Apple")
    expect(result?.specs).toEqual([
      { label: "Culoare", value: "Argintiu" },
      { label: "Memorie RAM", value: "12 GB" },
    ])
  })

  it("refuză codul de piesă al producătorului ca EAN", () => {
    // eMAG pune în `mpn` fie EAN-ul, fie codul Apple („MFYM4ZD/A"). Scris ca
    // EAN, al doilea ar strica orice potrivire ulterioară pe cod de bare.
    const apple = extractJsonLd(ld({ "@type": "Product", mpn: "MFYM4ZD/A" }))
    expect(apple?.ean).toBeUndefined()
    expect(apple?.mpn).toBe("MFYM4ZD/A")

    const toyz = extractJsonLd(ld({ "@type": "Product", mpn: "5908310390444" }))
    expect(toyz?.ean).toBe("5908310390444")
  })

  it("găsește produsul într-un @graph", () => {
    const result = extractJsonLd(
      ld({ "@graph": [{ "@type": "WebPage" }, { "@type": "Product", name: "Y" }] })
    )
    expect(result?.name).toBe("Y")
  })
})

/** Pagina de mai jos are structura reală eMAG, redusă la ce citim din ea. */
const emagPage = `<!doctype html><html><head>
  <script type="application/ld+json">{
    "@context":"http://schema.org","@type":"Product",
    "name":"Telefon mobil Apple iPhone 17 Pro Max, 256GB, 5G, Silver",
    "description":"Nota: Aceasta descriere a fost tradusa automat in limba romana.

Text din JSON-LD.",
    "brand":{"@type":"Brand","name":"Apple"},
    "mpn":"MFYM4ZD/A",
    "image":"https://s13emagst.akamaized.net/products/1/2/images/res_abc.jpg?width=80&height=80&hash=AA",
    "additionalProperty":[{"@type":"PropertyValue","name":"Culoare","value":"Argintiu"}]
  }</script></head><body>
  <h1>Telefon mobil Apple iPhone 17 Pro Max, 256GB, 5G, Silver</h1>
  <div id="product-gallery">
    <a href="https://s13emagst.akamaized.net/products/1/2/images/res_abc.jpg" class="thumbnail product-gallery-image">
      <img src="https://s13emagst.akamaized.net/products/1/2/images/res_abc.jpg?width=720&height=720&hash=BB">
    </a>
    <a href="https://s13emagst.akamaized.net/products/1/2/images/res_def.jpg" class="thumbnail product-gallery-image"></a>
  </div>
  <div class="product-page-description-text">
    <div class="collapse-offset" id="description-body">
      <p>Nota: Aceasta descriere a fost tradusa automat in limba romana.</p>
      <p>Ecranul are 6.9 inch.</p>
      <img data-src="/media/rich.jpg" src="https://cdn.ro/loading.gif">
      <a href="https://www.emag.ro/altceva">Vezi si</a>
      <script>var x = 1;</script>
    </div>
  </div>
  <div class="specifications-body"><div class="collapse-offset" id="specifications-body">
    <p class="strong">Caracteristici generale</p>
    <table class="table table-striped specifications-table"><tbody>
      <tr><td class="text-muted">Culoare</td><td>Argintiu </td></tr>
      <tr><td class="text-muted">Greutate</td><td>233 g</td></tr>
    </tbody></table>
    <p class="strong">Afisare</p>
    <table class="table table-striped specifications-table"><tbody>
      <tr><td class="text-muted">Dimensiune ecran</td><td>6.9 inch</td></tr>
    </tbody></table>
  </div></div>
  <script type="text/template"><div id="description-body"><p>DUPLICAT</p></div></script>
</body></html>`

describe("extractProduct pe o pagină eMAG", () => {
  const result = extractProduct(emagPage, PAGE_URL)

  it("recunoaște sursa și titlul", () => {
    expect(result.source).toBe("emag")
    expect(result.title).toBe("Telefon mobil Apple iPhone 17 Pro Max, 256GB, 5G, Silver")
    expect(result.brand).toBe("Apple")
  })

  it("ia fișa completă, cu grupurile din `<p>`-urile dintre tabele", () => {
    // Antetele eMAG NU sunt rânduri în tabel, sunt paragrafe între tabele —
    // de aceea adaptorul le citește separat de euristica generică.
    expect(result.specs).toEqual([
      { label: "Culoare", value: "Argintiu", group: "Caracteristici generale" },
      { label: "Greutate", value: "233 g", group: "Caracteristici generale" },
      { label: "Dimensiune ecran", value: "6.9 inch", group: "Afisare" },
    ])
  })

  it("scoate disclaimerul de traducere automată, dar avertizează", () => {
    expect(result.descriptionHtml).not.toMatch(/tradusa automat/i)
    expect(result.descriptionHtml).toContain("Ecranul are 6.9 inch.")
    expect(result.notes.join(" ")).toMatch(/tradusă automat/i)
  })

  it("rezolvă poza lazy și aruncă placeholderul", () => {
    // `src` e `loading.gif`, poza reală stă în `data-src` și e relativă.
    expect(result.descriptionImages).toEqual(["https://www.emag.ro/media/rich.jpg"])
    expect(result.descriptionHtml).not.toMatch(/loading\.gif/)
  })

  it("nu păstrează linkuri către magazinul sursă și nici scripturi", () => {
    expect(result.descriptionHtml).not.toMatch(/<a\b/)
    expect(result.descriptionHtml).not.toMatch(/<script/i)
    expect(result.descriptionHtml).not.toMatch(/DUPLICAT/)
  })

  it("ia galeria la rezoluție maximă, fără dubluri redimensionate", () => {
    // JSON-LD-ul dă aceeași primă poză cerută la 80×80; hash-ul e legat de
    // dimensiune, deci varianta fără parametri e singura de păstrat.
    expect(result.images).toEqual([
      "https://s13emagst.akamaized.net/products/1/2/images/res_abc.jpg",
      "https://s13emagst.akamaized.net/products/1/2/images/res_def.jpg",
    ])
  })

  it("nu confundă EAN-ul cu codul de piesă", () => {
    expect(result.ean).toBeUndefined()
    expect(result.mpn).toBe("MFYM4ZD/A")
  })
})

describe("extractProduct pe o pagină fără adaptor", () => {
  it("cade pe OpenGraph și pe tabelul găsit în pagină", () => {
    const html = `<html><head>
      <meta property="og:title" content="Boxa portabila Z">
      <meta property="og:image" content="https://producator.ro/img/z.jpg">
      </head><body>
      <div class="product-description"><p>O boxa buna, cu autonomie mare si sunet clar pentru petreceri.</p></div>
      <table>
        <tr><td>Putere totala</td><td>4.2 W</td></tr>
        <tr><td>Conectare</td><td>Bluetooth</td></tr>
        <tr><td>Autonomie</td><td>12 ore</td></tr>
      </table></body></html>`
    const result = extractProduct(html, "https://producator.ro/boxa-z")
    expect(result.source).toBe("generic")
    expect(result.title).toBe("Boxa portabila Z")
    expect(result.images).toEqual(["https://producator.ro/img/z.jpg"])
    expect(result.specs.map((s) => s.label)).toEqual([
      "Putere totala",
      "Conectare",
      "Autonomie",
    ])
    expect(result.descriptionHtml).toContain("autonomie mare")
  })

  it("face paragrafe din descrierea-text a JSON-LD-ului, când nu e HTML în pagină", () => {
    const html = `<html><body><script type="application/ld+json">{
      "@type":"Product","name":"X","description":"Prima linie.\\nA doua linie."
    }</script></body></html>`
    const result = extractProduct(html, "https://shop.ro/x")
    expect(result.descriptionHtml).toBe("<p>Prima linie.</p><p>A doua linie.</p>")
  })
})

describe("rewriteDescriptionImages", () => {
  it("înlocuiește sursele mutate și scoate ce n-a putut fi adus", () => {
    const html =
      '<p>a</p><figure><img src="https://x.ro/1.jpg" /></figure><figure><img src="https://x.ro/2.jpg" /></figure>'
    const map = new Map([["https://x.ro/1.jpg", "https://cdn.noi.ro/media/1.jpg"]])
    expect(rewriteDescriptionImages(html, map)).toBe(
      '<p>a</p><figure><img src="https://cdn.noi.ro/media/1.jpg" /></figure>'
    )
  })
})

describe("rehostImages", () => {
  it("refuză adresele din rețeaua internă", async () => {
    // Pe calea cu HTML lipit de operator, `src`-urile n-au trecut prin nicio
    // verificare — o poză „găzduită" pe 10.0.0.5 ar face backendul să ceară
    // de la un serviciu intern.
    const container = {
      resolve: () => ({
        createFiles: async () => {
          throw new Error("n-ar trebui apelat")
        },
      }),
    }
    const { map, failures } = await rehostImages(container as never, [
      "http://10.0.0.5/secret.jpg",
      "http://localhost:9000/x.jpg",
      "file:///etc/passwd",
    ])
    expect(map.size).toBe(0)
    expect(failures).toHaveLength(3)
  })
})
