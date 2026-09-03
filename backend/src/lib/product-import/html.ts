/**
 * Un arbore HTML minimal, cât să putem *căuta* în pagina unui magazin.
 *
 * De ce încă un parser, când `woo-description.ts` are deja unul: acela e un
 * sanitizator în flux — trece tokenii o dată și scrie la ieșire. Aici avem
 * nevoie de structură („tabelul din secțiunea cu clasa `specifications`",
 * „al doilea `td` din rând"), deci de un arbore peste care să interoghezi.
 *
 * Nu aducem `cheerio`/`jsdom`: backendul n-are nicio dependință de parsare HTML
 * și n-are rost să intre 6 MB de node_modules pentru ~200 de linii. Parserul
 * de mai jos nu e conform spec-ului HTML5 — nu-i trebuie. Acoperă exact ce
 * strică paginile reale de magazin:
 *  - taguri void și self-closing;
 *  - `<script>`/`<style>` cu `<` în conținut (altfel JSON-LD-ul rupe arborele);
 *  - taguri neînchise (`<p>`, `<li>`, `<td>`, `<tr>`) — implicit close, altfel
 *    un tabel de specificații de pe eMAG se imbrică pe sine la infinit;
 *  - comentarii și `<!doctype>`.
 *
 * Tot ce iese de aici e text/HTML NEÎNCREZUT — trece obligatoriu prin
 * `sanitizeWooHtml()` înainte să ajungă în baza de date.
 */

export type ElementNode = {
  type: "element"
  tag: string
  attrs: Record<string, string>
  children: Node[]
  parent: ElementNode | null
}

export type TextNode = {
  type: "text"
  text: string
  parent: ElementNode | null
}

export type Node = ElementNode | TextNode

export const isElement = (n: Node): n is ElementNode => n.type === "element"

/** Fără conținut propriu — nu se închid niciodată. */
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
])

/** Conținutul lor e text brut, nu markup (`<` din JSON-LD n-ar trebui parsat). */
const RAW_TEXT = new Set(["script", "style", "textarea", "title"])

/**
 * Ce tag închide implicit ce.
 *
 * `<td>Foo<td>Bar` e legal în HTML și apare des în tabelele copiate. Fără
 * regula asta al doilea `td` ar deveni copilul primului, iar extragerea
 * etichetă/valoare ar citi „FooBar" ca o singură celulă.
 */
const IMPLICIT_CLOSE: Record<string, Set<string>> = {
  li: new Set(["li"]),
  p: new Set(["p", "div", "section", "article", "ul", "ol", "table", "h1", "h2", "h3", "h4", "h5", "h6"]),
  td: new Set(["td", "th", "tr"]),
  th: new Set(["td", "th", "tr"]),
  tr: new Set(["tr"]),
  dt: new Set(["dt", "dd"]),
  dd: new Set(["dt", "dd"]),
  option: new Set(["option"]),
}

const ATTR_RE = /([a-zA-Z_:@][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of raw.matchAll(ATTR_RE)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? "")
  }
  return out
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  bdquo: "„", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  hellip: "…", ndash: "–", mdash: "—", times: "×", deg: "°",
  eacute: "é", szlig: "ß", euro: "€", middot: "·", bull: "•",
}

/**
 * Entitățile HTML → caractere.
 *
 * Ordinea contează: `&amp;` se rezolvă ULTIMUL. Altfel `&amp;nbsp;` (dublu
 * encodat, apare în descrierile trecute de două ori prin CKEditor) ar deveni
 * `&nbsp;` și apoi spațiu, adică am pierde un `&` real din text.
 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => {
      const v = NAMED_ENTITIES[String(name).toLowerCase()]
      return v === undefined ? m : v
    })
    .replace(/&amp;/g, "&")
}

const safeCodePoint = (cp: number) => {
  if (!Number.isFinite(cp) || cp < 1 || cp > 0x10ffff) return ""
  try {
    return String.fromCodePoint(cp)
  } catch {
    return ""
  }
}

/** Construiește arborele. Rădăcina e un element sintetic `#root`. */
export function parseHtml(source: string): ElementNode {
  const root: ElementNode = {
    type: "element",
    tag: "#root",
    attrs: {},
    children: [],
    parent: null,
  }
  let current = root
  let i = 0

  const pushText = (text: string) => {
    if (!text) return
    current.children.push({ type: "text", text: decodeEntities(text), parent: current })
  }

  while (i < source.length) {
    const lt = source.indexOf("<", i)
    if (lt === -1) {
      pushText(source.slice(i))
      break
    }
    pushText(source.slice(i, lt))

    // Comentarii, doctype, CDATA — sărite cu totul.
    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4)
      i = end === -1 ? source.length : end + 3
      continue
    }
    if (source.startsWith("<!", lt) || source.startsWith("<?", lt)) {
      const end = source.indexOf(">", lt + 2)
      i = end === -1 ? source.length : end + 1
      continue
    }

    const gt = source.indexOf(">", lt + 1)
    if (gt === -1) {
      pushText(source.slice(lt))
      break
    }

    const inner = source.slice(lt + 1, gt)

    // Tag de închidere
    if (inner.startsWith("/")) {
      const tag = inner.slice(1).trim().toLowerCase()
      // Urcăm până la cel mai apropiat strămoș cu tagul cerut. Dacă nu există
      // (închidere orfană), nu mișcăm nimic — altfel am scoate tot arborele.
      let node: ElementNode | null = current
      while (node && node.tag !== tag) node = node.parent
      if (node?.parent) current = node.parent
      i = gt + 1
      continue
    }

    const nameMatch = /^([a-zA-Z][-a-zA-Z0-9:_]*)/.exec(inner)
    if (!nameMatch) {
      pushText(source.slice(lt, gt + 1))
      i = gt + 1
      continue
    }

    const tag = nameMatch[1].toLowerCase()
    const selfClosing = inner.trimEnd().endsWith("/")
    const attrs = parseAttrs(inner.slice(nameMatch[1].length))

    // Închideri implicite: `<li>a<li>b`, `<td>x<td>y`.
    while (current.parent && IMPLICIT_CLOSE[current.tag]?.has(tag)) {
      current = current.parent
    }

    const el: ElementNode = { type: "element", tag, attrs, children: [], parent: current }
    current.children.push(el)

    if (VOID.has(tag) || selfClosing) {
      i = gt + 1
      continue
    }

    if (RAW_TEXT.has(tag)) {
      // Căutăm tagul de închidere ca text brut: conținutul poate avea `<`.
      const closeRe = new RegExp(`</${tag}\\s*>`, "i")
      const rest = source.slice(gt + 1)
      const m = closeRe.exec(rest)
      const raw = m ? rest.slice(0, m.index) : rest
      // Fără decodare: în `<script>` un `&amp;` e text de cod, nu entitate.
      el.children.push({ type: "text", text: raw, parent: el })
      i = m ? gt + 1 + m.index + m[0].length : source.length
      continue
    }

    current = el
    i = gt + 1
  }

  return root
}

/** Parcurge arborele în ordinea documentului. */
export function* walk(node: Node): Generator<Node> {
  yield node
  if (isElement(node)) {
    for (const child of node.children) yield* walk(child)
  }
}

export type Selector = {
  tag?: string
  /** Substring căutat în `class` (nu clasă exactă — magazinele le compun). */
  className?: string
  id?: string
  attrs?: Record<string, string | RegExp>
}

const matches = (el: ElementNode, sel: Selector): boolean => {
  if (sel.tag && el.tag !== sel.tag) return false
  if (sel.id && el.attrs.id !== sel.id) return false
  if (sel.className) {
    const cls = el.attrs.class || ""
    if (!cls.toLowerCase().includes(sel.className.toLowerCase())) return false
  }
  for (const [name, want] of Object.entries(sel.attrs ?? {})) {
    const have = el.attrs[name]
    if (have === undefined) return false
    if (want instanceof RegExp ? !want.test(have) : have !== want) return false
  }
  return true
}

export function findAll(root: Node, sel: Selector): ElementNode[] {
  const out: ElementNode[] = []
  for (const n of walk(root)) {
    if (isElement(n) && n.tag !== "#root" && matches(n, sel)) out.push(n)
  }
  return out
}

export function find(root: Node, sel: Selector): ElementNode | null {
  for (const n of walk(root)) {
    if (isElement(n) && n.tag !== "#root" && matches(n, sel)) return n
  }
  return null
}

/** Copiii direcți care sunt elemente cu tagul dat. */
export function children(el: ElementNode, tag?: string): ElementNode[] {
  return el.children.filter(
    (c): c is ElementNode => isElement(c) && (!tag || c.tag === tag)
  )
}

/** Blocurile introduc spațiu la extragerea textului; inline-urile nu. */
const BLOCK = new Set([
  "p", "div", "section", "article", "header", "footer", "li", "tr", "td", "th",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "table", "dl", "dt", "dd",
  "br", "figure", "figcaption", "blockquote", "pre",
])

/** Text vizibil, cu spațiile normalizate. `script`/`style` nu contribuie. */
export function text(node: Node): string {
  let out = ""
  const visit = (n: Node) => {
    if (n.type === "text") {
      out += n.text
      return
    }
    if (RAW_TEXT.has(n.tag)) return
    const block = BLOCK.has(n.tag)
    if (block) out += " "
    for (const c of n.children) visit(c)
    if (block) out += " "
  }
  visit(node)
  return out.replace(/ /g, " ").replace(/\s+/g, " ").trim()
}

const escapeText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

/**
 * Re-serializează subarborele în HTML.
 *
 * Ieșirea NU e sigură de randat — e intrarea pentru `sanitizeWooHtml()`, care
 * decide ce taguri și ce atribute supraviețuiesc.
 */
export function innerHtml(el: ElementNode): string {
  return el.children.map(outerHtml).join("")
}

export function outerHtml(node: Node): string {
  if (node.type === "text") return escapeText(node.text)
  if (node.tag === "#root") return innerHtml(node)

  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => (v === "" ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`))
    .join("")

  if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`
  if (RAW_TEXT.has(node.tag)) {
    const raw = node.children.map((c) => (c.type === "text" ? c.text : "")).join("")
    return `<${node.tag}${attrs}>${raw}</${node.tag}>`
  }
  return `<${node.tag}${attrs}>${innerHtml(node)}</${node.tag}>`
}

/** Atributele care conțin URL-uri și pe care le vrem absolute. */
const URL_ATTRS = ["src", "href", "data-src", "data-original", "data-lazy-src", "data-large_image"]
const SRCSET_ATTRS = ["srcset", "data-srcset", "data-flixsrcset"]

/**
 * Rescrie URL-urile relative din arbore ca absolute, față de pagina sursă.
 *
 * Obligatoriu înainte de sanitizare: `isUsableUrl` din `woo-description.ts`
 * cere `http(s)://`, deci un `src="/media/poza.jpg"` ar fi aruncat tăcut, iar
 * descrierea ar ajunge în magazin fără poze. Un `<base href>` în pagină bate
 * URL-ul documentului, ca în browser.
 */
export function absolutizeUrls(root: ElementNode, pageUrl: string): void {
  let base = pageUrl
  const baseEl = find(root, { tag: "base" })
  if (baseEl?.attrs.href) {
    try {
      base = new URL(baseEl.attrs.href, pageUrl).toString()
    } catch {
      /* base stricat — rămânem pe URL-ul paginii */
    }
  }

  const abs = (raw: string): string | null => {
    const value = raw.trim()
    if (!value || /^(data|javascript|mailto|tel):/i.test(value)) return null
    try {
      return new URL(value, base).toString()
    } catch {
      return null
    }
  }

  for (const node of walk(root)) {
    if (!isElement(node)) continue
    for (const attr of URL_ATTRS) {
      const raw = node.attrs[attr]
      if (!raw) continue
      const url = abs(raw)
      if (url) node.attrs[attr] = url
    }
    for (const attr of SRCSET_ATTRS) {
      const raw = node.attrs[attr]
      if (!raw) continue
      node.attrs[attr] = raw
        .split(",")
        .map((part) => {
          const [url, ...rest] = part.trim().split(/\s+/)
          const resolved = url ? abs(url) : null
          return resolved ? [resolved, ...rest].join(" ") : part.trim()
        })
        .join(", ")
    }
  }
}
