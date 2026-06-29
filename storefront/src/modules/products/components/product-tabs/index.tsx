"use client"

import { HttpTypes } from "@medusajs/types"
import {
  ArrowsCounterClockwise,
  ArrowUUpLeft,
  Truck,
} from "@phosphor-icons/react/dist/ssr"
import { useState } from "react"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const TABS = [
  { key: "specs", label: "Specificații" },
  { key: "shipping", label: "Livrare & Retur" },
] as const

type TabKey = (typeof TABS)[number]["key"]

const ProductTabs = ({ product }: ProductTabsProps) => {
  const [active, setActive] = useState<TabKey>("specs")

  return (
    <section className="bg-brand-light rounded-[2.5rem] p-8 lg:p-12">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
        <h2 className="font-serif text-3xl lg:text-4xl text-brand-dark">
          Detalii produs
        </h2>
        <div className="flex items-center p-1 bg-white rounded-full self-start lg:self-auto">
          {TABS.map((tab) => {
            const isActive = active === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={`px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${
                  isActive
                    ? "bg-brand-dark text-white shadow-sm"
                    : "text-brand-dark/60 hover:bg-brand-light"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 lg:p-10">
        {active === "specs" ? (
          <SpecsPanel product={product} />
        ) : (
          <ShippingPanel />
        )}
      </div>
    </section>
  )
}

const Spec = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1 py-4 border-b border-brand-dark/10">
    <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/50">
      {label}
    </span>
    <span className="text-brand-dark text-base">{value}</span>
  </div>
)

const SpecsPanel = ({ product }: ProductTabsProps) => {
  const dimensions =
    product.length && product.width && product.height
      ? `${product.length}L × ${product.width}P × ${product.height}H cm`
      : "—"

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
      <Spec label="Material" value={product.material || "—"} />
      <Spec label="Tip" value={product.type?.value || "—"} />
      <Spec
        label="Țară de origine"
        value={product.origin_country || "—"}
      />
      <Spec label="Dimensiuni" value={dimensions} />
      <Spec
        label="Greutate"
        value={product.weight ? `${product.weight} g` : "—"}
      />
      <Spec label="SKU" value={product.variants?.[0]?.sku || "—"} />
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
