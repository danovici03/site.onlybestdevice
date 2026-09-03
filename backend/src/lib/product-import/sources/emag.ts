/**
 * Adaptor pentru paginile de produs eMAG.
 *
 * JSON-LD-ul lor (vezi `json-ld.ts`) dă deja titlul, marca, EAN-ul și fișa
 * tehnică. Ce NU dă și de aceea există fișierul ăsta:
 *  - descrierea ca HTML. În JSON-LD `description` e text simplu, cu
 *    newline-uri; blocul din pagină are paragrafe, liste și pozele „rich".
 *  - galeria. `image` din JSON-LD e o singură poză, cerută la 80×80.
 *
 * URL-urile pozelor: `<a class="product-gallery-image" href>` duce la
 * originalul fără parametri, în timp ce `src`-ul din `<img>` e o redimensionare
 * (`?width=720&height=720&hash=…`), iar hash-ul e legat de dimensiune — nu poți
 * tăia parametrii ca să obții originalul, primești 403. De aceea citim `href`,
 * nu `src`.
 */
import { find, findAll, innerHtml, isElement, text, type ElementNode, type Node } from "../html"
import type { SourceAdapter } from "./types"

/** Disclaimerul de traducere automată pe care eMAG îl pune peste descriere. */
const AUTO_TRANSLATED = /^\s*Nota:\s*Aceasta descriere a fost tradusa automat/i

/**
 * Antetele de grup din fișă („Caracteristici generale") sunt `<p>`-uri ÎNTRE
 * tabele, nu rânduri în ele — de aceea nu le prinde `pairsFromTable`.
 */
function specsFromBody(body: ElementNode) {
  const out: { label: string; value: string; group?: string }[] = []
  let group: string | undefined

  const visit = (node: Node) => {
    if (!isElement(node)) return
    if (node.tag === "p") {
      const t = text(node)
      if (t && t.length <= 64) group = t
      return
    }
    if (node.tag === "table") {
      for (const row of findAll(node, { tag: "tr" })) {
        const cells = row.children.filter(
          (c): c is ElementNode => isElement(c) && (c.tag === "td" || c.tag === "th")
        )
        if (cells.length !== 2) continue
        const label = text(cells[0])
        const value = text(cells[1])
        if (label && value) out.push(group ? { label, value, group } : { label, value })
      }
      return
    }
    node.children.forEach(visit)
  }

  body.children.forEach(visit)
  return out
}

export const emag: SourceAdapter = {
  id: "emag",
  label: "eMAG",
  matches: (url) => /(^|\.)emag\.(ro|bg|hu)$/i.test(url.hostname),

  extract(root) {
    // Modalul „descriere completă" e duplicat într-un `<script type="text/template">`,
    // deci parserul îl vede ca text brut și nu-l putem confunda cu blocul real.
    const descriptionBlock =
      find(root, { id: "description-body" }) ??
      find(root, { className: "product-page-description-text" })

    let descriptionHtml = descriptionBlock ? innerHtml(descriptionBlock) : undefined
    if (descriptionHtml) {
      // Scoatem primul paragraf dacă e disclaimerul de traducere automată.
      descriptionHtml = descriptionHtml.replace(
        /^\s*<p[^>]*>\s*Nota:\s*Aceasta descriere a fost tradusa automat[^<]*<\/p>/i,
        ""
      )
    }

    const gallery = find(root, { id: "product-gallery" })
    const images = gallery
      ? findAll(gallery, { tag: "a", className: "product-gallery-image" })
          .map((a) => a.attrs.href)
          .filter((href) => !!href && /\/products\//.test(href))
      : []

    // Fișa are DOUĂ învelișuri, `.specifications-body` peste
    // `#specifications-body`. Le încercăm pe amândouă: dacă eMAG renunță la
    // unul, antetele de grup ar dispărea tăcut și fișa ar rămâne plată.
    const specsBody =
      find(root, { id: "specifications-body" }) ??
      find(root, { className: "specifications-body" })
    const specs = specsBody ? specsFromBody(specsBody) : []

    const title = find(root, { tag: "h1" })

    return {
      title: title ? text(title) : undefined,
      descriptionHtml,
      images,
      specs,
      notes: AUTO_TRANSLATED.test(text(descriptionBlock ?? root).slice(0, 200))
        ? ["Descrierea de pe eMAG e tradusă automat — merită recitită."]
        : [],
    }
  },
}
