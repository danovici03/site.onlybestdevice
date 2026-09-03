/**
 * Testele verificărilor puse peste ce întoarce modelul.
 *
 * Aici NU se cheamă API-ul — se testează exact stratul care decide ce trece de
 * la model la operator. Un model care inventează plauzibil e cel mai scump mod
 * de a strica un catalog, iar plasa asta e singurul lucru care stă între el și
 * `product.metadata.specs`.
 */
import {
  buildModelInput,
  collectPageUrls,
  groundKey,
  isGroundedDescription,
  isThinExtraction,
  keepGroundedSpecs,
  keepKnownDescriptionImages,
  keepKnownUrls,
} from "../ai"

const PAGE = "https://cdn.ro/produs/tv" 

describe("isThinExtraction", () => {
  const full = {
    descriptionHtml: "<p>" + "x".repeat(300) + "</p>",
    images: ["a", "b", "c"],
    specs: [1, 2, 3],
  }

  it("nu cheamă modelul când euristica a scos o pagină întreagă", () => {
    expect(isThinExtraction(full)).toBe(false)
  })

  it("îl cheamă când lipsește fișa", () => {
    expect(isThinExtraction({ ...full, specs: [] })).toBe(true)
  })

  it("îl cheamă când galeria are o singură poză", () => {
    expect(isThinExtraction({ ...full, images: ["a"] })).toBe(true)
  })

  it("îl cheamă când descrierea e un rând", () => {
    expect(isThinExtraction({ ...full, descriptionHtml: "<p>Televizor.</p>" })).toBe(true)
  })
})

describe("collectPageUrls", () => {
  it("prinde pozele din atribute, din srcset și din JSON-ul din script", () => {
    const urls = collectPageUrls(
      `<img data-src="https://cdn.ro/a.jpg" srcset="https://cdn.ro/b.jpg 2x, https://cdn.ro/b2.jpg 3x">
       <script type="application/ld+json">{"image":["https://cdn.ro/c.jpg"]}</script>`,
      PAGE
    )
    expect(urls.has("https://cdn.ro/a.jpg")).toBe(true)
    expect(urls.has("https://cdn.ro/b.jpg")).toBe(true)
    expect(urls.has("https://cdn.ro/b2.jpg")).toBe(true)
    expect(urls.has("https://cdn.ro/c.jpg")).toBe(true)
  })

  it("desface slash-urile escapate din JSON (json_encode scrie https:\\/\\/)", () => {
    const urls = collectPageUrls(
      `<script>var g={"img":"https:\\/\\/cdn.ro\\/produs\\/a.jpg"};</script>`,
      PAGE
    )
    expect(urls.has("https://cdn.ro/produs/a.jpg")).toBe(true)
  })

  it("absolutizează căile relative din atribute", () => {
    const urls = collectPageUrls(`<img src="/img/a.jpg"><img src="b.jpg">`, PAGE)
    expect(urls.has("https://cdn.ro/img/a.jpg")).toBe(true)
    expect(urls.has("https://cdn.ro/produs/b.jpg")).toBe(true)
  })

  it("adaugă și varianta fără parametri, pentru că modelul citește src-ul redimensionat", () => {
    const urls = collectPageUrls(`<img src="https://cdn.ro/a.jpg?width=450&amp;hash=99">`, PAGE)
    expect(urls.has("https://cdn.ro/a.jpg?width=450&hash=99")).toBe(true)
    expect(urls.has("https://cdn.ro/a.jpg")).toBe(true)
  })
})

describe("keepKnownUrls", () => {
  const page = collectPageUrls(`<img src="https://cdn.ro/produs/real.jpg">`, PAGE)

  it("păstrează poza care apare în pagină", () => {
    expect(keepKnownUrls(["https://cdn.ro/produs/real.jpg"], page, PAGE)).toEqual({
      kept: ["https://cdn.ro/produs/real.jpg"],
      dropped: 0,
    })
  })

  it("aruncă un URL plauzibil pe care modelul l-a construit singur", () => {
    const out = keepKnownUrls(["https://cdn.ro/produs/real_2.jpg"], page, PAGE)
    expect(out.kept).toEqual([])
    expect(out.dropped).toBe(1)
  })

  it("acceptă calea relativă din pagină, absolutizând-o", () => {
    const relative = collectPageUrls(`<img src="/img/a.jpg">`, PAGE)
    expect(keepKnownUrls(["/img/a.jpg"], relative, PAGE).kept).toEqual([
      "https://cdn.ro/img/a.jpg",
    ])
    // și forma pe care ar putea-o absolutiza singur modelul
    expect(keepKnownUrls(["https://cdn.ro/img/a.jpg"], relative, PAGE).kept).toHaveLength(1)
  })

  it("aruncă ce nu e URL", () => {
    expect(keepKnownUrls(["", "javascript:0"], page, PAGE).dropped).toBe(2)
  })
})

describe("keepKnownDescriptionImages", () => {
  const page = collectPageUrls(`<img src="https://cdn.ro/produs/real.jpg">`, PAGE)

  it("scoate din descriere poza care nu apare în pagină", () => {
    const out = keepKnownDescriptionImages(
      '<p>Design compact.</p><img src="https://cdn.ro/inventat.jpg">',
      page,
      PAGE
    )
    expect(out.html).toBe("<p>Design compact.</p>")
    expect(out.dropped).toBe(1)
  })

  it("lasă neatinsă poza reală", () => {
    const html = '<p>Text</p><img src="https://cdn.ro/produs/real.jpg">'
    expect(keepKnownDescriptionImages(html, page, PAGE)).toEqual({ html, dropped: 0 })
  })
})

describe("keepGroundedSpecs", () => {
  const pageKey = groundKey(
    "Diagonala 60 cm Rezolutie 1366 x 768 Tehnologii audio Dolby Audio Smart TV Da"
  )

  it("păstrează valorile scrise în pagină, indiferent de diacritice", () => {
    const out = keepGroundedSpecs(
      [{ label: "Rezoluție", value: "1366 x 768", group: "Imagine" }],
      pageKey
    )
    expect(out.kept).toEqual([{ label: "Rezoluție", value: "1366 x 768", group: "Imagine" }])
    expect(out.dropped).toBe(0)
  })

  it("aruncă valoarea inventată, chiar dacă e plauzibilă pentru produs", () => {
    const out = keepGroundedSpecs([{ label: "Rezolutie", value: "1920 x 1080" }], pageKey)
    expect(out.kept).toEqual([])
    expect(out.dropped).toBe(1)
  })

  it("lasă să treacă valorile scurte, pe care testul n-ar dovedi nimic", () => {
    expect(keepGroundedSpecs([{ label: "Smart TV", value: "Da" }], pageKey).kept).toHaveLength(1)
  })

  it("aruncă rândurile fără etichetă sau fără valoare", () => {
    expect(keepGroundedSpecs([{ label: "", value: "60 cm" }], pageKey).dropped).toBe(1)
  })
})

describe("isGroundedDescription", () => {
  const pageKey = groundKey(
    "Televizorul LG 24TQ510S aduce imagine HD intr-o diagonala compacta, potrivita pentru bucatarie sau birou. Sistemul webOS ofera acces direct la aplicatiile de streaming."
  )

  it("acceptă descrierea copiată din pagină", () => {
    const html =
      "<p>Televizorul LG 24TQ510S aduce imagine HD intr-o diagonala compacta, potrivita pentru bucatarie sau birou.</p>"
    expect(isGroundedDescription(html, pageKey)).toBe(true)
  })

  it("respinge descrierea repovestită de model", () => {
    const html =
      "<p>Acest televizor modern este alegerea ideala pentru orice locuinta si impresioneaza prin calitatea imaginii sale exceptionale.</p>"
    expect(isGroundedDescription(html, pageKey)).toBe(false)
  })
})

describe("buildModelInput", () => {
  it("aruncă scripturile executabile dar păstrează JSON-LD-ul și template-urile", () => {
    const { payload, reduced } = buildModelInput(`
      <script>window.dataLayer=[];</script>
      <script type="application/ld+json">{"@type":"Product"}</script>
      <script type="text/template"><table><tr><td>Diagonala</td><td>60 cm</td></tr></table></script>
      <style>.x{color:red}</style>
      <p>Descriere</p>
    `, PAGE)
    expect(payload).not.toContain("dataLayer")
    expect(payload).not.toContain("color:red")
    expect(payload).toContain('"@type":"Product"')
    expect(payload).toContain("Diagonala")
    expect(reduced).toBe(false)
  })

  it("trece pe text + listă de poze când pagina e prea mare, în loc să o taie", () => {
    // Multă structură, puțin text — exact forma unei pagini reale de magazin:
    // 700 KB de HTML din care iese sub 100 KB de text.
    const filler = "<span>a</span>".repeat(50_000)
    const { payload, reduced } = buildModelInput(`<img src="https://cdn.ro/a.jpg">${filler}`, PAGE)
    expect(reduced).toBe(true)
    expect(payload).toContain("https://cdn.ro/a.jpg")
    expect(payload).toContain("TEXTUL PAGINII")
  })
})

describe("buildModelInput — plafonul reprezentării reduse", () => {
  it("refuză explicit o pagină imensă în loc să o taie pe tăcute", () => {
    const huge = "<p>" + "cuvant ".repeat(400_000) + "</p>"
    expect(() => buildModelInput(huge, PAGE)).toThrow(/prea mare/i)
  })
})
