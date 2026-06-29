"use client"

import { useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  ArrowRight,
  DeviceMobile,
  DeviceTablet,
  Plug,
  Watch,
  GameController,
  Laptop,
  Desktop,
  Television,
  Shield,
  ShieldCheck,
  Package,
} from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import { unsplashLoader } from "@lib/util/unsplash-loader"
import {
  MegaMenuProduct,
  ResolvedMegaItem,
  ResolvedMegaRoot,
} from "./data"

type Props = {
  roots: ResolvedMegaRoot[]
  active: string | null
  onActivate: (key: string) => void
  onDismiss: () => void
}

// Small icon shown next to each category in the left list, keyed by href.
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "/categories/telefoane-mobile": DeviceMobile,
  "/categories/tablete": DeviceTablet,
  "/categories/incarcatoare-acccesorii": Plug,
  "/categories/smartatch-si-wearables": Watch,
  "/categories/console-jocuri": GameController,
  "/categories/laptop": Laptop,
  "/categories/desktop-pc-periferice": Desktop,
  "/categories/tv-audio-video-si-foto": Television,
  "/categories/huse-telefoane": Shield,
  "/categories/folii-de-protectie": ShieldCheck,
  "/categories/diverse": Package,
}

export default function MegaMenuPanel({
  roots,
  active,
  onActivate,
  onDismiss,
}: Props) {
  const visible = !!active
  const activeRoot = roots.find((r) => r.key === active)
  // Which left category is currently highlighted (drives the center products).
  const [selectedHref, setSelectedHref] = useState<string | null>(null)

  // Reset the highlight whenever the panel closes.
  useEffect(() => {
    if (!active) setSelectedHref(null)
  }, [active])

  return (
    <>
      <div
        aria-hidden={!visible}
        onClick={onDismiss}
        className={`fixed inset-x-0 top-20 bottom-0 z-30 bg-brand-dark/30 backdrop-blur-sm transition-opacity duration-200 ${
          visible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        onMouseLeave={onDismiss}
        className={`hidden lg:block fixed inset-x-0 top-20 z-40 transition-all duration-300 ease-out ${
          visible
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
        // Pre-mount so triggers can hover into a known panel area before
        // the active state propagates.
        onMouseEnter={() => activeRoot && onActivate(activeRoot.key)}
      >
        <div className="bg-white border-b border-brand-dark/5 shadow-[0_24px_48px_rgba(0,0,0,0.08)]">
          <div className="max-w-[1440px] mx-auto px-8 py-10">
            {activeRoot ? (
              <PanelLayout
                root={activeRoot}
                selectedHref={selectedHref}
                onSelect={setSelectedHref}
              />
            ) : roots[0] ? (
              // Sizer keeps the panel from collapsing while it fades out.
              <div className="invisible">
                <PanelLayout
                  root={roots[0]}
                  selectedHref={null}
                  onSelect={() => {}}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}

function PanelLayout({
  root,
  selectedHref,
  onSelect,
}: {
  root: ResolvedMegaRoot
  selectedHref: string | null
  onSelect: (href: string) => void
}) {
  const selected =
    root.items.find((i) => i.href === selectedHref) ??
    root.items.find((i) => i.featured) ??
    root.items[0]

  return (
    <div className="grid grid-cols-12 gap-8 items-stretch">
      {/* Left: every category, hover to swap the center products. */}
      <nav className="col-span-3 border-r border-brand-dark/5 pr-6 flex flex-col">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/40">
          Toate categoriile
        </span>
        <ul className="mt-4 flex-1">
          {root.items.map((item) => (
            <li key={item.href}>
              <CategoryListItem
                item={item}
                isSelected={selected?.href === item.href}
                onSelect={() => onSelect(item.href)}
              />
            </li>
          ))}
        </ul>
        <LocalizedClientLink
          href={root.href}
          className="group/all inline-flex items-center gap-2 mt-4 text-sm font-bold text-brand-dark hover:text-brand-accent transition-colors"
        >
          Vezi toate produsele
          <ArrowRight
            size={14}
            weight="bold"
            className="group-hover/all:translate-x-1 transition-transform"
          />
        </LocalizedClientLink>
      </nav>

      {/* Center: the selected category's real products. */}
      {selected ? (
        <CenterPanel item={selected} />
      ) : (
        <div className="col-span-6" />
      )}

      {/* Right: promo banner. */}
      <div className="col-span-3 flex">
        <PromoCard root={root} />
      </div>
    </div>
  )
}

function CategoryListItem({
  item,
  isSelected,
  onSelect,
}: {
  item: ResolvedMegaItem
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = CATEGORY_ICONS[item.href] ?? Package
  return (
    <LocalizedClientLink
      href={item.href}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={`group/row flex items-center gap-3 rounded-xl px-3 py-2 -mx-3 transition-colors ${
        isSelected ? "bg-brand-light" : "hover:bg-brand-light"
      }`}
    >
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
          isSelected
            ? "bg-brand-dark text-white"
            : "bg-brand-light text-brand-dark/70 group-hover/row:bg-brand-dark group-hover/row:text-white"
        }`}
      >
        <Icon size={16} />
      </span>
      <span
        className={`flex-1 text-[15px] tracking-[-0.01em] transition-colors truncate ${
          isSelected
            ? "font-extrabold text-brand-dark"
            : "font-bold text-brand-dark/70 group-hover/row:text-brand-dark"
        }`}
      >
        {item.label}
      </span>
      <ArrowRight
        size={14}
        weight="bold"
        className={`shrink-0 transition-all ${
          isSelected
            ? "opacity-100 text-brand-dark"
            : "opacity-0 -translate-x-1 text-brand-dark/30 group-hover/row:opacity-100 group-hover/row:translate-x-0"
        }`}
      />
    </LocalizedClientLink>
  )
}

function CenterPanel({ item }: { item: ResolvedMegaItem }) {
  return (
    <div className="col-span-6 flex flex-col">
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/40">
          Cele mai populare
        </span>
        <LocalizedClientLink
          href={item.href}
          className="group/all inline-flex items-center gap-1.5 text-sm font-bold text-brand-dark hover:text-brand-accent transition-colors"
        >
          Vezi toate{item.count ? ` (${item.count})` : ""}
          <ArrowRight
            size={14}
            weight="bold"
            className="group-hover/all:translate-x-1 transition-transform"
          />
        </LocalizedClientLink>
      </div>

      {item.products.length > 0 ? (
        <div className="grid grid-cols-3 gap-5">
          {item.products.slice(0, 3).map((product) => (
            <ProductCard key={product.handle} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState item={item} />
      )}
    </div>
  )
}

function ProductCard({ product }: { product: MegaMenuProduct }) {
  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className="group/p flex flex-col"
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-brand-light flex items-center justify-center">
        {product.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover/p:scale-105"
          />
        ) : (
          <Package size={32} className="text-brand-dark/20" />
        )}
      </div>
      <h5 className="mt-3 text-sm font-bold text-brand-dark truncate group-hover/p:text-brand-accent transition-colors">
        {product.title}
      </h5>
      {product.price && (
        <span className="text-sm text-brand-dark/60 mt-0.5">
          {product.price}
        </span>
      )}
    </LocalizedClientLink>
  )
}

// Shown when a category has no products yet — links through to the category.
function EmptyState({ item }: { item: ResolvedMegaItem }) {
  return (
    <LocalizedClientLink
      href={item.href}
      className="group/empty relative flex-1 min-h-[240px] rounded-2xl overflow-hidden img-zoom-wrapper bg-brand-dark"
    >
      <Image
        loader={unsplashLoader}
        src={item.image}
        alt={item.label}
        fill
        sizes="(min-width: 1280px) 40vw, 50vw"
        className="object-cover opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/85 via-brand-dark/30 to-transparent" />
      <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
        <h4 className="font-serif text-2xl leading-tight">{item.label}</h4>
        <p className="text-white/70 text-sm mt-1 max-w-[36ch] leading-relaxed">
          {item.description}
        </p>
        <span className="inline-flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-wider">
          Vezi categoria
          <ArrowRight
            size={12}
            weight="bold"
            className="group-hover/empty:translate-x-1 transition-transform"
          />
        </span>
      </div>
    </LocalizedClientLink>
  )
}

function PromoCard({ root }: { root: ResolvedMegaRoot }) {
  return (
    <LocalizedClientLink
      href={root.href}
      className="group/promo relative block w-full min-h-[300px] rounded-2xl overflow-hidden img-zoom-wrapper bg-brand-dark"
    >
      <Image
        loader={unsplashLoader}
        src={root.feature.image}
        alt={root.feature.title}
        fill
        sizes="(min-width: 1280px) 22vw, 28vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/90 via-brand-dark/40 to-transparent" />
      <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/70 mb-2">
          Recomandarea noastră
        </span>
        <h4 className="font-serif text-2xl leading-[1.1] max-w-[18ch]">
          {root.feature.title}
        </h4>
        <p className="text-white/70 text-sm mt-2 leading-relaxed max-w-[32ch]">
          {root.feature.body}
        </p>
        <span className="inline-flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-wider self-start">
          Descoperă
          <ArrowRight
            size={12}
            weight="bold"
            className="group-hover/promo:translate-x-1 transition-transform"
          />
        </span>
      </div>
    </LocalizedClientLink>
  )
}
