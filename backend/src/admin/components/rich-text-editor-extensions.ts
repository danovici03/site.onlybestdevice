import { mergeAttributes } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import StarterKit from "@tiptap/starter-kit"

/**
 * Schema editorului, croită pe ce acceptă sanitizatorul
 * (`src/lib/woo-description.ts`).
 *
 * Regula: un buton care produce markup pe care serverul îl aruncă e mai rău
 * decât lipsa butonului — operatorul ar formata ceva ce dispare la salvare.
 * De aceea `blockquote`, `code`, `codeBlock`, `strike`, `underline` și
 * `horizontalRule` sunt oprite: niciunul nu e în `KEEP_TAGS`.
 */

/** Dimensiune numerică validă, ca în sanitizator (sursa are `width=""`). */
const dimension = (v: string | null): string | null =>
  v && /^\d+$/.test(v.trim()) && Number(v) > 1 ? v.trim() : null

/**
 * Poza de descriere, ca `<figure><img /></figure>`.
 *
 * 43% din descrierile importate au deja poza înfășurată în `figure`, iar
 * storefront-ul stilează `prose-figure:my-6` — deci figura e forma canonică.
 * Nodul e atomic (fără conținut editabil): în tot catalogul nu există niciun
 * `figcaption`, așa că nu avem ce lăsa editabil înăuntru.
 *
 * `width`/`height` se păstrează pentru că 90% din poze le au, iar pierderea
 * lor ar aduce înapoi salturile de layout în pagina de produs.
 * `loading`/`decoding`/`referrerpolicy` NU se modelează aici: le pune
 * sanitizatorul la fiecare salvare, iar dublarea lor ar însemna două surse
 * de adevăr pentru aceleași atribute.
 *
 * Contractul e verificat pe tot catalogul (603 descrieri cu HTML, deschise și
 * serializate înapoi): textul și sursele pozelor ies IDENTICE peste tot. 320
 * ies neatinse la caracter, iar restul diferă doar prin structura de blocuri —
 * `<img>` singur se înfășoară în `<figure>`, iar un paragraf care conținea o
 * poză se rupe în paragraf + figură + paragraf. Niciun paragraf gol în plus.
 */
export const FigureImage = Image.extend({
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: "" },
      width: {
        default: null,
        parseHTML: (el) => dimension(el.getAttribute("width")),
      },
      height: {
        default: null,
        parseHTML: (el) => dimension(el.getAttribute("height")),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        // Figurile cu text propriu, cu `figcaption` sau cu mai multe poze nu
        // încap în nodul ăsta atomic — întoarcem `false` și le lăsăm pe seama
        // parsării normale, ca să nu pierdem conținut.
        getAttrs: (element) => {
          const figure = element as HTMLElement
          const images = figure.querySelectorAll("img[src]")
          if (images.length !== 1) return false
          if (figure.querySelector("figcaption")) return false
          if (figure.textContent?.trim()) return false

          const img = images[0]
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            width: dimension(img.getAttribute("width")),
            height: dimension(img.getAttribute("height")),
          }
        },
      },
      { tag: "img[src]" },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", {}, ["img", mergeAttributes(HTMLAttributes)]]
  },
})

/**
 * Extensiile editorului. `allowLinks` e explicit ca să rămână legat de
 * opțiunea cu același nume din sanitizator.
 */
export const buildExtensions = ({ allowLinks = true } = {}) => [
  StarterKit.configure({
    // `h1` e remapat la `h2` de sanitizator (titlul paginii e deja h1).
    heading: { levels: [2, 3, 4, 5, 6] },
    link: allowLinks
      ? {
          openOnClick: false,
          autolink: false,
          // Fără `defaultProtocol` un „exemplu.ro" tastat ar deveni un link
          // relativ pe care sanitizatorul îl acceptă, dar care duce în gol.
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto", "tel"],
        }
      : false,
    // Markup pe care sanitizatorul îl aruncă:
    blockquote: false,
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
  }),
  FigureImage,
]
