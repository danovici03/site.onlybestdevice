import { parseHtml } from "../html"
import { extractSpecPairs, specKey } from "../specs"

describe("specKey", () => {
  it("șterge diacriticele, ca eticheta eMAG să cadă pe cea din baza noastră", () => {
    // Baza are „Rezolutie camera principala" (venită din WooCommerce, fără
    // diacritice), eMAG scrie „Rezoluție cameră principală".
    expect(specKey("Rezoluție cameră principală")).toBe("rezolutie camera principala")
    expect(specKey("Rezolutie camera principala")).toBe("rezolutie camera principala")
  })

  it("tratează Ș/Ț cu virgulă la fel ca pe cele cu sedilă", () => {
    // Cele două forme arată identic dar sunt code point-uri diferite, iar NFD
    // nu le descompune — fără maparea explicită, „Conexiuni" ar da două chei.
    expect(specKey("Șasiu Ţeavă")).toBe(specKey("Şasiu Țeavă"))
  })

  it("ignoră punctuația și majusculele", () => {
    expect(specKey("Memorie RAM:")).toBe(specKey("memorie ram"))
  })
})

describe("extractSpecPairs", () => {
  it("citește un tabel etichetă/valoare", () => {
    const html = `<table>
      <tr><td>Culoare</td><td>Argintiu</td></tr>
      <tr><td>Memorie RAM</td><td>12 GB</td></tr>
      <tr><td>Greutate</td><td>233 g</td></tr>
    </table>`
    expect(extractSpecPairs(parseHtml(html))).toEqual([
      { label: "Culoare", value: "Argintiu" },
      { label: "Memorie RAM", value: "12 GB" },
      { label: "Greutate", value: "233 g" },
    ])
  })

  it("reține antetul de grup dintr-un rând cu o singură celulă", () => {
    const html = `<table>
      <tr><td colspan="2">Afisare</td></tr>
      <tr><td>Tip display</td><td>OLED</td></tr>
    </table>`
    expect(extractSpecPairs(parseHtml(html))).toEqual([
      { label: "Tip display", value: "OLED", group: "Afisare" },
    ])
  })

  it("refuză tabelul de layout cu poze în celule", () => {
    // Jumătate din tabelele din descrierile importate sunt layout: text la
    // stânga, poză la dreapta. Citite ca fișă, ar umple panoul cu gunoi.
    const html = `<table>
      <tr><td>Bateria ține toată ziua, chiar și la utilizare intensă.</td><td><img src="https://x.ro/a.jpg"></td></tr>
      <tr><td>Camera face fotografii excelente pe timp de noapte.</td><td><img src="https://x.ro/b.jpg"></td></tr>
    </table>`
    expect(extractSpecPairs(parseHtml(html))).toEqual([])
  })

  it("refuză copy-ul de marketing prins într-un tabel", () => {
    const html = `<table>
      <tr><td>De ce sa alegi acest model in locul altuia din aceeasi gama?</td><td>Pentru ca are cel mai bun raport pret-calitate.</td></tr>
      <tr><td>Cat de rezistent este la apa in conditii normale de folosire?</td><td>Rezista la imersiune completa timp de 30 de minute.</td></tr>
    </table>`
    expect(extractSpecPairs(parseHtml(html))).toEqual([])
  })

  it("citește liste de definiții", () => {
    const html = "<dl><dt>Procesor</dt><dd>Apple A19 Pro</dd><dt>Culoare</dt><dd>Negru</dd></dl>"
    expect(extractSpecPairs(parseHtml(html))).toEqual([
      { label: "Procesor", value: "Apple A19 Pro" },
      { label: "Culoare", value: "Negru" },
    ])
  })

  it("citește fișele făcute din div-uri, când nu există tabel", () => {
    const html = `<div class="specs">
      <div><span>Procesor</span><span>Snapdragon 8</span></div>
      <div><span>Culoare</span><span>Negru</span></div>
      <div><span>Greutate</span><span>190 g</span></div>
    </div>`
    expect(extractSpecPairs(parseHtml(html))).toEqual([
      { label: "Procesor", value: "Snapdragon 8" },
      { label: "Culoare", value: "Negru" },
      { label: "Greutate", value: "190 g" },
    ])
  })

  it("prima apariție a unei etichete câștigă", () => {
    // Blocul „produse similare" din josul paginii repetă aceleași etichete cu
    // valorile ALTOR produse. Fișa reală e mai sus în document.
    const html = `<table><tr><td>Culoare</td><td>Argintiu</td></tr><tr><td>Greutate</td><td>233 g</td></tr><tr><td>Tip</td><td>Smartphone</td></tr></table>
      <table><tr><td>Culoare</td><td>Negru</td></tr><tr><td>Greutate</td><td>180 g</td></tr><tr><td>Tip</td><td>Tableta</td></tr></table>`
    const pairs = extractSpecPairs(parseHtml(html))
    expect(pairs.find((p) => p.label === "Culoare")?.value).toBe("Argintiu")
    expect(pairs).toHaveLength(3)
  })
})
