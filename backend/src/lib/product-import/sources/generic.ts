/**
 * Ce facem când pagina nu e de la un magazin pe care îl cunoaștem.
 *
 * Ordinea surselor de descriere e importantă: containerele de mai jos sunt
 * ordonate de la cel mai specific la cel mai generic. Un `#description` prins
 * pe un site care numește așa footer-ul ar aduce gunoi, dar tot e mai bine
 * decât nimic — operatorul vede previzualizarea și refuză.
 *
 * Pentru site-urile de producător, JSON-LD-ul lipsește des, dar OpenGraph
 * există aproape mereu (îl cer Facebook și Google), deci de acolo luăm titlul
 * și poza principală.
 */
import { find, findAll, innerHtml, text, type ElementNode, type Node } from "../html"
import { extractSpecPairs } from "../specs"
import type { SourceAdapter } from "./types"

/** Candidați de container pentru descriere, în ordinea încrederii. */
const DESCRIPTION_HINTS: { id?: string; className?: string }[] = [
  { className: "woocommerce-Tabs-panel--description" },
  { className: "product-page-description-text" },
  { id: "tab-description" },
  { className: "product-description" },
  { className: "product__description" },
  { id: "description" },
  { className: "description" },
]

const metaContent = (root: Node, property: string): string | undefined => {
  const el =
    find(root, { tag: "meta", attrs: { property } }) ??
    find(root, { tag: "meta", attrs: { name: property } })
  const value = el?.attrs.content?.trim()
  return value || undefined
}

/** Poze de interfață, nu de produs. */
const isChrome = (url: string) =>
  /\.(svg|gif)(\?|$)/i.test(url) ||
  /(logo|icon|sprite|placeholder|banner|badge|avatar|favicon|payment|flag)/i.test(url)

export const generic: SourceAdapter = {
  id: "generic",
  label: "generic",
  matches: () => true,

  extract(root, url) {
    // Primul candidat cu text suficient cât să fie o descriere. Pragul e mic
    // intenționat: descrierile scurte („O boxă bună, cu autonomie mare.") sunt
    // reale, iar un prag mare le-ar arunca și ar lăsa produsul fără nimic.
    // Dacă niciunul nu-l trece, luăm totuși pe cel mai bogat — operatorul vede
    // previzualizarea și decide.
    let block: ElementNode | null = null
    let longest: ElementNode | null = null
    for (const hint of DESCRIPTION_HINTS) {
      const candidate = find(root, hint)
      if (!candidate) continue
      const length = text(candidate).length
      if (!longest || length > text(longest).length) longest = candidate
      if (length >= 40) {
        block = candidate
        break
      }
    }
    block ??= longest && text(longest).length > 0 ? longest : null

    const images: string[] = []
    const push = (raw?: string) => {
      if (!raw) return
      let abs: string
      try {
        abs = new URL(raw.trim(), url).toString()
      } catch {
        return
      }
      if (!/^https?:/i.test(abs) || isChrome(abs)) return
      images.push(abs)
    }

    push(metaContent(root, "og:image"))

    // Galeriile WooCommerce/Shopify: linkul spre imaginea mare stă pe `<a>`
    // sau într-un `data-large_image`.
    for (const a of findAll(root, { tag: "a", attrs: { href: /\.(jpe?g|png|webp)(\?|$)/i } })) {
      push(a.attrs.href)
    }
    for (const img of findAll(root, { tag: "img", attrs: { "data-large_image": /./ } })) {
      push(img.attrs["data-large_image"])
    }

    return {
      title: metaContent(root, "og:title") ?? (find(root, { tag: "h1" }) ? text(find(root, { tag: "h1" })!) : undefined),
      descriptionHtml: block ? innerHtml(block) : undefined,
      descriptionText: block ? undefined : metaContent(root, "og:description"),
      images,
      specs: extractSpecPairs(root),
      notes: [],
    }
  },
}
