import { CaretDown } from "@phosphor-icons/react/dist/ssr"

/**
 * Panoul „Descriere".
 *
 * Descrierile importate din WooCommerce sunt HTML: text, subtitluri și galeriile
 * de imagini copiate odată cu ele (poze găzduite pe domeniile sursă — eMAG,
 * Altex, site-urile producătorilor). HTML-ul e sanitizat O SINGURĂ DATĂ, la
 * import (`backend/src/lib/woo-description.ts`), deci aici îl randăm ca atare.
 * Nu trimite prin componenta asta HTML din altă sursă.
 *
 * Produsele adăugate manual din Admin au descriere text simplu — le păstrăm
 * randarea pe paragrafe.
 *
 * Linkurile apar doar în descrierile scrise din editorul de admin (importul le
 * aruncă); sanitizatorul le pune deja `target`/`rel`, aici doar le dăm stil.
 */

const HTML_RE = /<(p|img|figure|ul|ol|h[2-6]|strong|em|br|dl|a)\b/i

/** Toggle-ul „Citește mai mult" e pur CSS; id-ul e unic pe pagina de produs. */
const TOGGLE_ID = "product-description-toggle"

const DescriptionPanel = ({ description }: { description: string }) => {
  const isHtml = HTML_RE.test(description)
  const body = isHtml ? (
    <RichBody html={description} />
  ) : (
    <PlainBody description={description} />
  )

  // Cu poze, descrierea e aproape mereu lungă; textul simplu doar uneori.
  const isLong = isHtml
    ? description.length > 700 || /<img\b/i.test(description)
    : description.length > 320

  if (!isLong) {
    return (
      <div className="max-w-3xl" data-testid="product-description">
        {body}
      </div>
    )
  }

  // Textul întreg rămâne în DOM (indexabil de motoarele de căutare), doar
  // înălțimea e limitată vizual până la apăsarea butonului.
  return (
    <div
      className="max-w-3xl flex flex-col items-start gap-4"
      data-testid="product-description"
    >
      <input type="checkbox" id={TOGGLE_ID} className="peer sr-only" />
      <div className="w-full max-h-72 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%)] peer-checked:max-h-none peer-checked:[mask-image:none]">
        {body}
      </div>
      <ToggleLabel className="peer-checked:hidden" caret="down">
        Citește mai mult
      </ToggleLabel>
      <ToggleLabel className="hidden peer-checked:inline-flex" caret="up">
        Arată mai puțin
      </ToggleLabel>
    </div>
  )
}

/**
 * Pozele din descriere vin de pe zeci de domenii externe, așa că rămân `<img>`
 * simple: `next/image` ar cere fiecare domeniu în `remotePatterns`.
 */
const RichBody = ({ html }: { html: string }) => (
  <div
    className="
      prose prose-sm sm:prose-base max-w-none
      prose-p:text-brand-dark/70 prose-p:leading-relaxed
      prose-li:text-brand-dark/70
      prose-headings:font-serif prose-headings:text-brand-dark
      prose-strong:text-brand-dark prose-strong:font-bold
      prose-img:rounded-2xl prose-img:mx-auto prose-img:my-0
      prose-figure:my-6 prose-figcaption:text-brand-dark/50
      prose-a:text-brand-dark prose-a:underline prose-a:underline-offset-2
      prose-a:decoration-brand-accent hover:prose-a:text-brand-accent
    "
    dangerouslySetInnerHTML={{ __html: html }}
  />
)

const PlainBody = ({ description }: { description: string }) => (
  <div className="flex flex-col gap-4">
    {description
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((paragraph, i) => (
        <p key={i} className="text-brand-dark/70 leading-relaxed">
          {paragraph}
        </p>
      ))}
  </div>
)

const ToggleLabel = ({
  className,
  caret,
  children,
}: {
  className: string
  caret: "up" | "down"
  children: React.ReactNode
}) => (
  <label
    htmlFor={TOGGLE_ID}
    className={`inline-flex cursor-pointer items-center gap-1.5 text-xs uppercase tracking-[0.18em] font-bold text-brand-dark hover:text-brand-accent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-accent peer-focus-visible:ring-offset-2 rounded-md ${className}`}
  >
    {children}
    <CaretDown
      size={12}
      weight="bold"
      aria-hidden
      className={caret === "up" ? "rotate-180" : undefined}
    />
  </label>
)

export default DescriptionPanel
