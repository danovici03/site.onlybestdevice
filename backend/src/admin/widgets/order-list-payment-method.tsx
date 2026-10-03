import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

import type { PaymentMethod } from "../../lib/orders/payment-method"

/**
 * Lista „Comenzi": coloana „Metodă de plată”, imediat după „Canal de vânzare”.
 *
 * Medusa nu lasă să adaugi coloane în tabelul nativ, doar widgeturi deasupra
 * sau dedesubt (`order.list.before` / `after`). Așa că o inserăm în DOM.
 *
 * Hack-ul depinde de markup-ul `DataTableRoot` din dashboard: antetul are
 * `th[data-table-header-id="sales_channel"]`, iar fiecare celulă a unui rând e
 * un link spre `/orders/<id>` — de acolo luăm id-ul comenzii. Dacă Medusa
 * schimbă markup-ul, NU se rupe nimic: coloana lipsește și primim un
 * `console.warn`.
 *
 * Rândurile nu se recreează la schimbarea paginii (tanstack le cheiază după
 * index), doar li se schimbă conținutul — deci celula noastră se re-verifică
 * la fiecare mutație și se rescrie când id-ul din rând e altul.
 */
const GIVE_UP_AFTER_MS = 4_000
const AFTER_COLUMN = "sales_channel"
const MARK = "data-obd-payment-method"
const HEADER_LABEL = "Metodă de plată"

/** undefined = încă se încarcă; null = comanda n-are plată înregistrată. */
const cache = new Map<string, PaymentMethod | null>()

const orderIdOf = (row: Element): string | null => {
  const href = row.querySelector("a[href*='/orders/']")?.getAttribute("href")
  return href?.match(/\/orders\/(order_[A-Za-z0-9]+)/)?.[1] ?? null
}

const renderCell = (td: HTMLElement, orderId: string | null) => {
  const method = orderId ? cache.get(orderId) : null
  const loading = !!orderId && !cache.has(orderId)
  const text = loading ? "…" : (method?.tag ?? "-")
  // Plata cu cardul iese în evidență, în verde, ca în cardul comenzii.
  const tone =
    method?.group === "card"
      ? "text-ui-tag-green-text font-medium"
      : method
        ? ""
        : "text-ui-fg-muted"
  const key = `${orderId}|${text}|${tone}`
  if (td.dataset.state === key) return
  td.dataset.state = key

  const span = td.querySelector("span")!
  span.textContent = text
  span.className = `truncate ${tone}`
  td.title = method ? `${method.label} — ${method.detail}` : ""
}

const buildCell = (template: HTMLElement): HTMLTableCellElement => {
  const td = document.createElement("td")
  td.setAttribute(MARK, "")
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
  inner.appendChild(document.createElement("span"))
  link.appendChild(inner)
  td.appendChild(link)
  return td
}

const OrderListPaymentMethod = () => {
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
          `/admin/order-payment-methods?ids=${encodeURIComponent(ids.join(","))}`,
          { credentials: "include" }
        )
        const body = res.ok ? await res.json() : { methods: {} }
        for (const id of ids) cache.set(id, body.methods?.[id] ?? null)
      } catch {
        for (const id of ids) cache.set(id, null)
      } finally {
        inFlight = false
        schedule()
      }
    }

    const apply = () => {
      frame = 0
      const anchor = document.querySelector<HTMLElement>(
        `th[data-table-header-id="${AFTER_COLUMN}"]`
      )
      if (!anchor) return
      found = true

      const headerRow = anchor.parentElement!
      const index = Array.prototype.indexOf.call(headerRow.children, anchor)

      if (!headerRow.querySelector(`th[${MARK}]`)) {
        const th = document.createElement("th")
        th.setAttribute(MARK, "")
        th.className = anchor.className
        th.style.width = anchor.style.width
        th.innerHTML =
          '<div class="flex h-full w-full items-center"><span class="truncate"></span></div>'
        th.querySelector("span")!.textContent = HEADER_LABEL
        anchor.after(th)
      }

      const body = headerRow.closest("table")?.querySelector("tbody")
      body?.querySelectorAll(":scope > tr").forEach((row) => {
        let td = row.querySelector<HTMLElement>(`td[${MARK}]`)
        if (!td) {
          const template = row.children[index] as HTMLElement | undefined
          // Rândul „Nu există rezultate” are o singură celulă întinsă.
          if (!template || template.hasAttribute("colspan")) return
          td = buildCell(template)
          template.after(td)
        }
        const orderId = orderIdOf(row)
        if (orderId && !cache.has(orderId)) pending.add(orderId)
        renderCell(td, orderId)
      })

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
          "[admin] Nu am găsit coloana „Canal de vânzare” în lista de comenzi — " +
            "probabil s-a schimbat markup-ul dashboard-ului. Coloana " +
            "„Metodă de plată” lipsește."
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

export default OrderListPaymentMethod
