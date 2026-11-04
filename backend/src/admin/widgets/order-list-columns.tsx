import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

import type { OrderListColumns } from "../../api/admin/order-list-columns/route"

/**
 * Lista „Comenzi": „Canal de vânzare” nu spune nimic (avem un singur canal),
 * așa că în locul ei apar „Produs vândut” și „Metodă de plată”. Iar „Client”
 * se înlocuiește cu una care pune numele de pe comandă: cea nativă arată
 * emailul la clienții fără cont (vezi lib/orders/customer-name.ts).
 *
 * Medusa nu lasă să adaugi coloane în tabelul nativ, doar widgeturi deasupra
 * sau dedesubt (`order.list.before` / `after`). Așa că le inserăm în DOM.
 *
 * Hack-ul depinde de markup-ul `DataTableRoot` din dashboard: antetul are
 * `th[data-table-header-id="sales_channel"]` (și `"customer"`), iar fiecare celulă a unui rând e
 * un link spre `/orders/<id>` — de acolo luăm id-ul comenzii. Dacă Medusa
 * schimbă markup-ul, NU se rupe nimic: revin coloanele native, cele noi
 * lipsesc și primim un `console.warn`.
 *
 * Coloana nativă se ascunde, nu se șterge: e nodul lui React și reperul de
 * care ne ancorăm. React nu-i atinge `display`, iar dacă recreează celula,
 * următoarea trecere o ascunde la loc. Poziția ei se numără doar printre
 * celulele native: un rând recreat de React nu le mai are pe ale noastre.
 *
 * Rândurile nu se recreează la schimbarea paginii (tanstack le cheiază după
 * index), doar li se schimbă conținutul — deci celulele noastre se re-verifică
 * la fiecare mutație și se rescriu când id-ul din rând e altul.
 */
const GIVE_UP_AFTER_MS = 4_000
const MARK = "data-obd-column"
const MUTED = "text-ui-fg-muted"

type Cell = { text: string; extra?: string; tone?: string; title?: string }

type Column = {
  key: string
  label: string
  /** Titlurile de produs ajung la 160 de caractere și ar lăți tot tabelul. */
  maxWidth?: string
  /** `native` = celula ascunsă a coloanei înlocuite. */
  cell: (row: OrderListColumns | null, native: HTMLElement) => Cell
  /** Ce arată până vin datele; implicit „…”. */
  loading?: (native: HTMLElement) => Cell
}

/** Textul coloanei native; „-” gri, ca în CustomerCell, când nu are client. */
const nativeCell = (native: HTMLElement): Cell => {
  const text = native.textContent?.trim()
  return text && text !== "-" ? { text } : { text: "-", tone: MUTED }
}

const CLIENT: Column = {
  key: "customer",
  label: "Client",
  // Până vine răspunsul rămâne ce scria coloana nativă, ca să nu clipească.
  loading: (native) => nativeCell(native),
  cell: (row, native) =>
    row?.customer ? { text: row.customer } : nativeCell(native),
}

const SALES_CHANNEL_COLUMNS: Column[] = [
  {
    key: "product",
    label: "Produs vândut",
    maxWidth: "320px",
    cell: (row) => {
      const [first, ...others] = row?.products ?? []
      if (!first) return { text: "-", tone: MUTED }
      return {
        text: first,
        extra: others.length ? `+${others.length}` : "",
        title: row!.products.join("\n"),
      }
    },
  },
  {
    key: "payment",
    label: "Metodă de plată",
    cell: (row) => {
      const method = row?.payment
      if (!method) return { text: "-", tone: MUTED }
      return {
        text: method.tag,
        // Plata cu cardul iese în evidență, în verde, ca în cardul comenzii.
        tone:
          method.group === "card" ? "text-ui-tag-green-text font-medium" : "",
        title: `${method.label} — ${method.detail}`,
      }
    },
  },
]

/** Coloana nativă ascunsă → coloanele noastre, puse în locul ei. */
const REPLACEMENTS: { replaces: string; columns: Column[] }[] = [
  { replaces: "customer", columns: [CLIENT] },
  { replaces: "sales_channel", columns: SALES_CHANNEL_COLUMNS },
]

/** undefined = încă se încarcă; null = comanda n-a venit din API. */
const cache = new Map<string, OrderListColumns | null>()

const orderIdOf = (row: Element): string | null => {
  const href = row.querySelector("a[href*='/orders/']")?.getAttribute("href")
  return href?.match(/\/orders\/(order_[A-Za-z0-9]+)/)?.[1] ?? null
}

/** Celulele lui React, fără cele inserate de noi. */
const nativeChildren = (row: Element) =>
  Array.from(row.children).filter((el) => !el.hasAttribute(MARK))

const renderCell = (
  td: HTMLElement,
  column: Column,
  orderId: string | null,
  native: HTMLElement
) => {
  const loading = !!orderId && !cache.has(orderId)
  const { text, extra = "", tone = "", title = "" } = loading
    ? (column.loading?.(native) ?? { text: "…", tone: MUTED })
    : column.cell(orderId ? (cache.get(orderId) ?? null) : null, native)

  const key = `${orderId}|${text}|${extra}|${tone}`
  if (td.dataset.state === key) return
  td.dataset.state = key

  const [main, more] = Array.from(td.querySelectorAll("span"))
  main.textContent = text
  main.className = `truncate ${tone}`
  more.textContent = extra
  td.title = title
}

const buildCell = (template: HTMLElement, column: Column) => {
  const td = document.createElement("td")
  td.setAttribute(MARK, column.key)
  td.className = template.className
  // Rândul e clicabil doar prin linkurile din celule; un <a> simplu ar
  // reîncărca pagina, așa că trimitem clicul la linkul React din același rând.
  const link = document.createElement("a")
  link.className = "size-full outline-none"
  link.tabIndex = -1
  link.addEventListener("click", (e) => {
    e.preventDefault()
    td.parentElement
      ?.querySelector<HTMLAnchorElement>(`td:not([${MARK}]) a[href*='/orders/']`)
      ?.click()
  })
  const inner = document.createElement("div")
  inner.className = "flex size-full items-center pe-6"
  if (column.maxWidth) inner.style.maxWidth = column.maxWidth
  const more = document.createElement("span")
  // „+1” stă în afara trunchierii: e chiar informația că mai sunt produse.
  more.className = `ms-1 shrink-0 ${MUTED}`
  inner.append(document.createElement("span"), more)
  link.appendChild(inner)
  td.appendChild(link)
  return td
}

const buildHeader = (template: HTMLElement, column: Column) => {
  const th = document.createElement("th")
  th.setAttribute(MARK, column.key)
  th.className = template.className
  th.style.width = template.style.width
  th.innerHTML =
    '<div class="flex h-full w-full items-center"><span class="truncate"></span></div>'
  th.querySelector("span")!.textContent = column.label
  return th
}

const OrderListColumnsWidget = () => {
  useEffect(() => {
    let found = false
    let frame = 0
    const pending = new Set<string>()
    let inFlight = false

    const load = async () => {
      if (inFlight || !pending.size) return
      inFlight = true
      const ids = Array.from(pending)
      pending.clear()
      try {
        const res = await fetch(
          `/admin/order-list-columns?ids=${encodeURIComponent(ids.join(","))}`,
          { credentials: "include" }
        )
        const body = res.ok ? await res.json() : { orders: {} }
        for (const id of ids) cache.set(id, body.orders?.[id] ?? null)
      } catch {
        for (const id of ids) cache.set(id, null)
      } finally {
        inFlight = false
        schedule()
      }
    }

    const apply = () => {
      frame = 0
      for (const { replaces, columns } of REPLACEMENTS) {
        const anchor = document.querySelector<HTMLElement>(
          `th[data-table-header-id="${replaces}"]`
        )
        if (!anchor) continue
        found = true

        const headerRow = anchor.parentElement!
        const index = nativeChildren(headerRow).indexOf(anchor)
        anchor.style.display = "none"

        let previousHeader: HTMLElement = anchor
        for (const column of columns) {
          let th = headerRow.querySelector<HTMLElement>(
            `th[${MARK}="${column.key}"]`
          )
          if (!th) {
            th = buildHeader(anchor, column)
            previousHeader.after(th)
          }
          previousHeader = th
        }

        const body = headerRow.closest("table")?.querySelector("tbody")
        body?.querySelectorAll(":scope > tr").forEach((row) => {
          const native = nativeChildren(row)[index] as HTMLElement | undefined
          // Rândul „Nu există rezultate” are o singură celulă întinsă.
          if (!native || native.hasAttribute("colspan")) return
          native.style.display = "none"

          const orderId = orderIdOf(row)
          if (orderId && !cache.has(orderId)) pending.add(orderId)

          let previous: HTMLElement = native
          for (const column of columns) {
            let td = row.querySelector<HTMLElement>(
              `td[${MARK}="${column.key}"]`
            )
            if (!td) {
              td = buildCell(native, column)
              previous.after(td)
            }
            renderCell(td, column, orderId, native)
            previous = td
          }
        })
      }

      void load()
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    schedule()

    // `characterData` + `href`: la schimbarea paginii React doar rescrie
    // textele și linkurile rândurilor existente, fără noduri noi.
    const root = document.getElementById("medusa") ?? document.body
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href"],
    })

    const timer = window.setTimeout(() => {
      if (!found) {
        console.warn(
          "[admin] Nu am găsit coloanele „Client” / „Canal de vânzare” în " +
            "lista de comenzi — probabil s-a schimbat markup-ul dashboard-ului. " +
            "Coloanele „Produs vândut” și „Metodă de plată” lipsesc."
        )
      }
    }, GIVE_UP_AFTER_MS)

    return () => {
      window.clearTimeout(timer)
      if (frame) window.cancelAnimationFrame(frame)
      observer.disconnect()
      // La revenire citim din nou: linkul de plată poate muta comanda pe card.
      cache.clear()
      document.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove())
    }
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default OrderListColumnsWidget
