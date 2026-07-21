import { HttpTypes } from "@medusajs/types"
import {
  ArrowsCounterClockwise,
  ArrowUUpLeft,
  CaretDown,
  Truck,
} from "@phosphor-icons/react/dist/ssr"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

// Deschiderea unui panou îl închide pe celelalte (comportamentul vechi de
// tab-uri). Browserele fără suport pentru `name` le lasă pur și simplu pe toate
// deschise — degradare acceptabilă.
const ACCORDION_GROUP = "product-details"

const ProductTabs = ({ product }: ProductTabsProps) => {
  const paragraphs = toParagraphs(product.description)

  return (
    <section className="bg-brand-light rounded-[2.5rem] p-6 sm:p-8 lg:p-12">
      <h2 className="font-serif text-3xl lg:text-4xl text-brand-dark mb-8">
        Detalii produs
      </h2>

      <div className="flex flex-col gap-3">
        {paragraphs.length > 0 && (
          <AccordionItem title="Descriere" defaultOpen>
            <DescriptionPanel paragraphs={paragraphs} />
          </AccordionItem>
        )}
        <AccordionItem title="Specificații" defaultOpen={!paragraphs.length}>
          <SpecsPanel product={product} />
        </AccordionItem>
        <AccordionItem title="Livrare & Retur">
          <ShippingPanel />
        </AccordionItem>
      </div>
    </section>
  )
}

const AccordionItem = ({
  title,
  defaultOpen,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) => (
  <details
    name={ACCORDION_GROUP}
    open={defaultOpen}
    className="group bg-white rounded-[2rem] overflow-hidden"
  >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 lg:px-10 lg:py-7 [&::-webkit-details-marker]:hidden">
      <span className="font-bold text-brand-dark text-lg">{title}</span>
      <CaretDown
        size={18}
        weight="bold"
        aria-hidden
        className="shrink-0 text-brand-dark/40 transition-transform duration-200 group-open:rotate-180"
      />
    </summary>
    <div className="px-6 pb-6 lg:px-10 lg:pb-9">{children}</div>
  </details>
)

/** Descrierile din catalog vin cu multe linii goale consecutive. */
const toParagraphs = (description?: string | null) =>
  (description || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)

const DescriptionPanel = ({ paragraphs }: { paragraphs: string[] }) => {
  const charCount = paragraphs.reduce((sum, p) => sum + p.length, 0)
  const isLong = charCount > 320 || paragraphs.length > 3

  const body = paragraphs.map((paragraph, i) => (
    <p key={i} className="text-brand-dark/70 leading-relaxed">
      {paragraph}
    </p>
  ))

  if (!isLong) {
    return (
      <div
        className="max-w-3xl flex flex-col gap-4"
        data-testid="product-description"
      >
        {body}
      </div>
    )
  }

  // Toggle pur CSS: checkbox ascuns + variantele `peer-checked`. Textul întreg
  // e mereu în DOM (indexabil), doar înălțimea e limitată vizual.
  return (
    <div
      className="max-w-3xl flex flex-col items-start gap-4"
      data-testid="product-description"
    >
      <input
        type="checkbox"
        id="product-description-toggle"
        className="peer sr-only"
      />
      <div className="flex flex-col gap-4 max-h-44 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%)] peer-checked:max-h-none peer-checked:[mask-image:none]">
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
    htmlFor="product-description-toggle"
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

const Spec = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1 py-4 border-b border-brand-dark/10">
    <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
      {label}
    </span>
    <span className="text-brand-dark text-base">{value}</span>
  </div>
)

// Specificațiile extrase din descriere ajung în metadata.specs (vezi
// backend/src/scripts/extract-product-specs.ts). Sunt zeci per produs, așa că
// le urcăm pe cele relevante deasupra; restul păstrează ordinea din sursă.
const SPEC_PRIORITY = [
  /^(diagonal|dimensiune ecran)/i,
  /^tip (ecran|display)/i,
  /^rezolutie/i,
  /^(model )?procesor/i,
  /^memorie ram/i,
  /^(memorie interna|capacitate stocare)/i,
  /^(sistem de operare|versiune sistem)/i,
  /^(capacitate )?(acumulator|baterie)/i,
  /^autonomie/i,
  /^retea|^tehnologie/i,
  /^culoare/i,
  /^greutate/i,
  /^dimensiuni/i,
]

const specRank = (label: string) => {
  const i = SPEC_PRIORITY.findIndex((re) => re.test(label))
  return i === -1 ? SPEC_PRIORITY.length : i
}

const SpecsPanel = ({ product }: ProductTabsProps) => {
  const meta = (product.metadata ?? {}) as Record<string, unknown>
  const specs = (meta.specs ?? null) as Record<string, string> | null

  const entries = specs
    ? Object.entries(specs)
        .filter(([, v]) => v && String(v).trim())
        .sort(([a], [b]) => specRank(a) - specRank(b))
    : []

  if (entries.length) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
        {entries.map(([label, value]) => (
          <Spec key={label} label={label} value={String(value)} />
        ))}
      </div>
    )
  }

  // Produse fără tabel extras: cădem pe câmpurile native Medusa.
  const dimensions =
    product.length && product.width && product.height
      ? `${product.length}L × ${product.width}P × ${product.height}H cm`
      : null

  const fallback = [
    ["Material", product.material],
    ["Tip", product.type?.value],
    ["Țară de origine", product.origin_country],
    ["Dimensiuni", dimensions],
    ["Greutate", product.weight ? `${product.weight} g` : null],
    ["SKU", product.variants?.[0]?.sku],
  ].filter(([, v]) => v) as [string, string][]

  if (!fallback.length) {
    return (
      <p className="text-brand-dark/50 text-sm">
        Specificațiile pentru acest produs nu sunt încă disponibile.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
      {fallback.map(([label, value]) => (
        <Spec key={label} label={label} value={value} />
      ))}
    </div>
  )
}

const ShippingPanel = () => {
  const items = [
    {
      icon: Truck,
      title: "Livrare rapidă",
      body: "Coletul tău ajunge în 1–3 zile lucrătoare, la punctul de ridicare sau direct acasă.",
    },
    {
      icon: ArrowsCounterClockwise,
      title: "Schimburi simple",
      body: "Produsul nu e potrivit? Nicio problemă, îl înlocuim cu unul nou, fără complicații.",
    },
    {
      icon: ArrowUUpLeft,
      title: "Retururi ușoare",
      body: "Returnează produsul și îți restituim banii. Fără întrebări, facem totul ca returul să fie simplu.",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {items.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex flex-col gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center text-brand-dark">
            <Icon size={20} weight="regular" />
          </div>
          <h3 className="font-bold text-brand-dark">{title}</h3>
          <p className="text-brand-dark/60 text-sm leading-relaxed">{body}</p>
        </div>
      ))}
    </div>
  )
}

export default ProductTabs
