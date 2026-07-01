"use client"

import * as Accordion from "@radix-ui/react-accordion"
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr"
import { useMemo, useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { FaqCategoryDTO } from "@lib/data/faq"

type Props = {
  categories: FaqCategoryDTO[]
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

export default function FaqClient({ categories }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState("")
  const [activeSlug, setActiveSlug] = useState<string>(
    () => searchParams.get("tab") || categories[0]?.slug || ""
  )

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && tab !== activeSlug && categories.some((c) => c.slug === tab)) {
      setActiveSlug(tab)
    }
  }, [searchParams, activeSlug, categories])

  const setTab = (slug: string) => {
    setActiveSlug(slug)
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", slug)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const normalizedQuery = normalize(query.trim())
  const isSearching = normalizedQuery.length >= 2

  const filteredByCategory = useMemo(() => {
    if (!isSearching) return null
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (it) =>
            normalize(it.question).includes(normalizedQuery) ||
            normalize(it.answer).includes(normalizedQuery)
        ),
      }))
      .filter((cat) => cat.items.length > 0)
  }, [categories, normalizedQuery, isSearching])

  const activeCategory = categories.find((c) => c.slug === activeSlug)

  return (
    <div>
      <div className="relative mb-10">
        <MagnifyingGlass
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-dark/40 pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caută printre întrebările frecvente…"
          aria-label="Caută în întrebările frecvente"
          className="w-full pl-12 pr-4 py-4 rounded-full border border-brand-dark/15 bg-white text-brand-dark placeholder:text-brand-dark/40 focus:outline-none focus:border-brand-dark transition-colors"
        />
      </div>

      {!isSearching && (
        <div
          role="tablist"
          aria-label="Categorie FAQ"
          className="flex flex-wrap gap-2 mb-8"
        >
          {categories.map((cat) => {
            const isActive = cat.slug === activeSlug
            return (
              <button
                key={cat.slug}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(cat.slug)}
                className={
                  isActive
                    ? "px-5 py-2.5 rounded-full bg-brand-dark text-white text-sm font-semibold transition-colors"
                    : "px-5 py-2.5 rounded-full bg-brand-dark/5 text-brand-dark hover:bg-brand-dark/10 text-sm font-semibold transition-colors"
                }
              >
                {cat.title}
              </button>
            )
          })}
        </div>
      )}

      {isSearching ? (
        filteredByCategory && filteredByCategory.length > 0 ? (
          <div className="space-y-12">
            {filteredByCategory.map((cat) => (
              <div key={cat.slug}>
                <h2 className="text-xl font-bold text-brand-dark mb-4">
                  {cat.title}
                </h2>
                <FaqList items={cat.items} idPrefix={`search-${cat.slug}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-brand-dark/60">
            <p className="text-lg mb-2">Nessuna domanda corrisponde a “{query}”.</p>
            <p className="text-sm">
              Prova con un altro termine o{" "}
              <a href="/contact" className="text-brand-accent hover:underline">
                contattaci direttamente
              </a>
              .
            </p>
          </div>
        )
      ) : activeCategory ? (
        <div>
          {activeCategory.description && (
            <p className="text-brand-dark/70 mb-6 text-lg">
              {activeCategory.description}
            </p>
          )}
          <FaqList items={activeCategory.items} idPrefix={activeCategory.slug} />
        </div>
      ) : (
        <p className="text-brand-dark/60">Nessuna FAQ disponibile.</p>
      )}
    </div>
  )
}

function FaqList({
  items,
  idPrefix,
}: {
  items: FaqCategoryDTO["items"]
  idPrefix: string
}) {
  if (items.length === 0) {
    return (
      <p className="text-brand-dark/60 italic">
        Lucrăm la completarea acestei secțiuni.
      </p>
    )
  }
  return (
    <Accordion.Root type="multiple" className="divide-y divide-brand-dark/10 border-y border-brand-dark/10">
      {items.map((item) => (
        <Accordion.Item value={item.id} key={item.id}>
          <Accordion.Header>
            <Accordion.Trigger
              id={`${idPrefix}-${item.id}`}
              className="group flex w-full items-center justify-between gap-4 py-5 text-left text-brand-dark font-semibold hover:text-brand-accent transition-colors"
            >
              <span>{item.question}</span>
              <CaretDown
                size={18}
                weight="bold"
                className="shrink-0 transition-transform group-data-[state=open]:rotate-180"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-open data-[state=closed]:animate-accordion-close">
            <div className="pb-6 pr-8 prose prose-neutral prose-sm max-w-none prose-a:text-brand-accent hover:prose-a:underline prose-strong:text-brand-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {item.answer}
              </ReactMarkdown>
            </div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}
