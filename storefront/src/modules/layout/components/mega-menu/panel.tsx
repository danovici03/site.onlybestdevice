"use client"

import { ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  ArrowRight,
  CaretDown,
  CaretUp,
  Package,
} from "@phosphor-icons/react/dist/ssr"
import Image from "next/image"
import { unsplashLoader } from "@lib/util/unsplash-loader"
import {
  MEGA_MENU,
  MegaMenuData,
  MegaMenuItem,
  MegaMenuItemData,
  MegaMenuProduct,
  MegaMenuRoot,
} from "./data"
import { getCategoryIcon } from "./category-icons"
import { useMegaMenuData } from "./use-mega-menu-data"

// `undefined` cât se încarcă, `null` dacă n-a venit — vezi `useMegaMenuData`.
type RootData = MegaMenuData[string] | null | undefined

type Props = {
  active: string | null
  onActivate: (key: string) => void
  onDismiss: () => void
}

export default function MegaMenuPanel({
  active,
  onActivate,
  onDismiss,
}: Props) {
  const roots = MEGA_MENU
  const visible = !!active
  const activeRoot = roots.find((r) => r.key === active)
  const { countryCode } = useParams<{ countryCode: string }>()
  // Produsele vin abia la prima deschidere: în HTML-ul paginilor rămân doar
  // linkurile categoriilor.
  const data = useMegaMenuData(countryCode, visible)
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
        className={`fixed inset-x-0 top-[var(--nav-bottom,5rem)] bottom-0 z-30 bg-brand-dark/30 backdrop-blur-sm transition-opacity duration-200 ${
          visible
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        onMouseLeave={onDismiss}
        className={`hidden lg:block fixed inset-x-0 top-[var(--nav-bottom,5rem)] z-40 transition-all duration-300 ease-out ${
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
                // Odată venite datele, o rădăcină lipsă din JSON e „fără
                // date", nu „se încarcă" — altfel scheletul ar pulsa la nesfârșit.
                data={data === undefined ? undefined : data?.[activeRoot.key] ?? null}
                selectedHref={selectedHref}
                onSelect={setSelectedHref}
              />
            ) : roots[0] ? (
              // Sizer keeps the panel from collapsing while it fades out.
              <div className="invisible">
                <PanelLayout
                  root={roots[0]}
                  data={undefined}
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
  data,
  selectedHref,
  onSelect,
}: {
  root: MegaMenuRoot
  data: RootData
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
        <CategoryScroller>
          {root.items.map((item) => (
            <li key={item.href} className="snap-start">
              <CategoryListItem
                item={item}
                isSelected={selected?.href === item.href}
                onSelect={() => onSelect(item.href)}
              />
            </li>
          ))}
        </CategoryScroller>
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
        <CenterPanel
          item={selected}
          entry={data === undefined ? undefined : data?.items[selected.href] ?? null}
        />
      ) : (
        <div className="col-span-6" />
      )}

      {/* Right: promo banner. */}
      <div className="col-span-3 flex">
        <PromoCard root={root} data={data} />
      </div>
    </div>
  )
}

// Un rând din listă: `py-2` + iconița de 32px.
const ROW_PX = 48

/**
 * Lista de categorii, derulabilă. Minimum 7,5 rânduri: rândul tăiat jos
 * spune, fără niciun text, că mai sunt categorii dedesubt.
 * Gradientele și săgețile apar doar spre capătul în care mai e ceva de văzut.
 *
 * Fără bibliotecă de carusel: e scroll nativ (rotiță, trackpad, tastatură —
 * focusul pe un link îl aduce singur în vedere), plus `scrollBy` pe săgeți.
 */
function CategoryScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ top: false, bottom: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const top = el.scrollTop > 1
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1
    setEdges((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom }
    )
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [update])

  const page = (direction: 1 | -1) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ref.current?.scrollBy({
      top: direction * ROW_PX * 3,
      behavior: reduce ? "auto" : "smooth",
    })
  }

  // Săgețile dublează doar ce fac deja rotița și tastatura, deci rămân în
  // afara ordinii de tab și a cititorului de ecran.
  const arrow =
    "w-7 h-7 rounded-full flex items-center justify-center text-brand-dark/60 hover:text-brand-dark hover:bg-brand-light transition disabled:opacity-0 disabled:pointer-events-none"

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-dark/40">
          Toate categoriile
        </span>
        <div
          aria-hidden
          className={`flex items-center gap-0.5 -my-1.5 transition-opacity ${
            edges.top || edges.bottom ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={() => page(-1)}
            disabled={!edges.top}
            className={arrow}
          >
            <CaretUp size={14} weight="bold" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => page(1)}
            disabled={!edges.bottom}
            className={arrow}
          >
            <CaretDown size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Lista e scoasă din flux (`absolute`), deci nu dictează înălțimea
          rândului: umple ce lasă centrul și bannerul, dar nu sub 7,5 rânduri. */}
      <div className="relative mt-4 flex-1" style={{ minHeight: ROW_PX * 7.5 }}>
        {/* `-mx-3 px-3`: rândurile au `-mx-3` pentru fundalul de hover, iar
            un container cu overflow le-ar tăia marginile. */}
        <ul
          ref={ref}
          onScroll={update}
          className="no-scrollbar absolute inset-0 overflow-y-auto overscroll-contain snap-y snap-proximity -mx-3 px-3"
        >
          {children}
        </ul>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white to-transparent transition-opacity duration-200 ${
            edges.top ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent transition-opacity duration-200 ${
            edges.bottom ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </>
  )
}

function CategoryListItem({
  item,
  isSelected,
  onSelect,
}: {
  item: MegaMenuItem
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = getCategoryIcon(item.href)
  // „Oferte" e singura intrare care nu e o categorie de produs, ci un motiv de
  // cumpărare. Fără accent s-ar citi ca a șaptea categorie din listă.
  const highlight = !!item.highlight
  return (
    <LocalizedClientLink
      href={item.href}
      // `pointermove`, nu `mouseenter`: lista se derulează, iar la scroll cu
      // rotița rândurile trec pe sub cursorul nemișcat și fiecare ar deveni
      // selectat, cu centrul pâlpâind prin toate categoriile.
      onPointerMove={onSelect}
      onFocus={onSelect}
      className={`group/row flex items-center gap-3 rounded-xl px-3 py-2 -mx-3 transition-colors ${
        isSelected ? "bg-brand-light" : "hover:bg-brand-light"
      }`}
    >
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
          highlight
            ? "bg-brand-accent text-white"
            : isSelected
              ? "bg-brand-dark text-white"
              : "bg-brand-light text-brand-dark/70 group-hover/row:bg-brand-dark group-hover/row:text-white"
        }`}
      >
        <Icon size={16} weight={highlight ? "fill" : "regular"} />
      </span>
      <span
        className={`flex-1 text-[15px] tracking-[-0.01em] transition-colors truncate ${
          highlight
            ? "font-extrabold text-brand-accent"
            : isSelected
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

function CenterPanel({
  item,
  entry,
}: {
  item: MegaMenuItem
  /** `undefined` cât se încarcă; `null` dacă n-avem date pentru intrare. */
  entry: MegaMenuItemData | null | undefined
}) {
  const count = entry?.count
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
          Vezi toate{count ? ` (${count})` : ""}
          <ArrowRight
            size={14}
            weight="bold"
            className="group-hover/all:translate-x-1 transition-transform"
          />
        </LocalizedClientLink>
      </div>

      {entry === undefined ? (
        <div className="grid grid-cols-3 gap-5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col">
              <div className="aspect-square rounded-2xl bg-brand-light animate-pulse" />
              <div className="mt-3 h-4 w-3/4 rounded bg-brand-light animate-pulse" />
              <div className="mt-1.5 h-4 w-1/3 rounded bg-brand-light animate-pulse" />
            </div>
          ))}
        </div>
      ) : entry && entry.products.length > 0 ? (
        <div className="grid grid-cols-3 gap-5">
          {entry.products.slice(0, 3).map((product) => (
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
function EmptyState({ item }: { item: MegaMenuItem }) {
  return (
    <LocalizedClientLink
      href={item.href}
      className="group/empty relative flex-1 min-h-[240px] rounded-2xl overflow-hidden img-zoom-wrapper bg-brand-dark"
    >
      {item.image && (
        <>
          <Image
            loader={unsplashLoader}
            src={item.image}
            alt={item.label}
            fill
            sizes="(min-width: 1280px) 40vw, 50vw"
            className="object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/85 via-brand-dark/30 to-transparent" />
        </>
      )}
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

function PromoCard({ root, data }: { root: MegaMenuRoot; data: RootData }) {
  const product = data?.feature ?? null

  return (
    <LocalizedClientLink
      href={root.feature.href ?? root.href}
      className="group/promo flex w-full min-h-[300px] flex-col rounded-2xl overflow-hidden bg-brand-dark p-5"
    >
      {data === undefined ? (
        <div className="flex-1 min-h-[132px] rounded-xl bg-white/10 animate-pulse" />
      ) : product?.thumbnail && (
        // Pozele de catalog sunt decupaje pe fundal alb, deci stau pe o plăcuță
        // deschisă și `object-contain`, ca în cardurile din centru. Peste un
        // fundal închis, `object-cover` ar tăia produsul și l-ar lăsa într-un
        // dreptunghi alb care nu seamănă cu restul meniului.
        <div className="relative flex-1 min-h-[132px] rounded-xl bg-brand-light overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.thumbnail}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover/promo:scale-105"
          />
        </div>
      )}

      <div className="mt-4 text-white">
        <span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-white/70">
          {root.feature.eyebrow ?? "Recomandarea noastră"}
        </span>
        <h4 className="font-serif text-2xl leading-[1.1] max-w-[18ch] mt-2">
          {root.feature.title}
        </h4>
        {product ? (
          <div className="mt-2">
            {/* Titlurile de catalog trec ușor de două rânduri, iar prețul e
                partea care convinge: pe rândul lui, nu îl mai taie clamp-ul. */}
            <p className="text-white/70 text-sm leading-relaxed line-clamp-2">
              {product.title}
            </p>
            {product.price && (
              <span className="block mt-1 text-sm font-bold text-white">
                {product.price}
              </span>
            )}
          </div>
        ) : (
          <p className="text-white/70 text-sm mt-2 leading-relaxed max-w-[32ch]">
            {root.feature.body}
          </p>
        )}
        <span className="inline-flex items-center gap-2 mt-4 text-xs font-bold uppercase tracking-wider">
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
