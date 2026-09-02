import { bankAccount } from "../../../lib/company/bank-account"
import {
  formatCui as formatBuyerCui,
  readBuyerFiscal,
} from "../../../lib/company/buyer-fiscal"

// Template registry for the Resend notification provider.
// Each template returns a subject + rendered HTML (and optional text fallback).
// Layout is shared (logo header, brand colors, serif heading, branded footer)
// so every email looks like part of the same family.

export type RenderedEmail = {
  subject: string
  html: string
  text?: string
}

type Renderer = (data: Record<string, any>) => RenderedEmail

// Datele societare — oglindesc storefront/src/lib/util/company-info.ts.
const BRAND = "onlybestdevice"
const LEGAL = "ONLY BEST DEVICE S.R.L."
const CUI = "43546040"
const REG_COM = "J06/26/2021"
const SUPPORT_EMAIL = "office@onlybestdevice.ro"
const SUPPORT_HOURS = "Luni–Vineri 9:00–18:00"
const STOREFRONT_FALLBACK = "https://onlybestdevice.ro"
// Prefixul de limbă folosit în linkurile către storefront (middleware-ul
// Next redirectează pe /{countryCode}). Citit la randare, nu la import, ca
// să nu depindă de ordinea de încărcare a env-ului.
const locale = () => process.env.STOREFRONT_LOCALE || "ro"

// Mirror of storefront/tailwind.config.js → theme.extend.colors.brand
const COLOR = {
  dark: "#1C1B1A",
  accent: "#A46754",
  light: "#F4F3F0",
  surface: "#FFFFFF",
  muted: "#7A7775",
  border: "#EAE8E4",
}

const FONT_BODY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const FONT_HEADING = "Georgia, 'Times New Roman', serif"

const escape = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const money = (amount: number | undefined, currency = "RON") => {
  if (amount == null) return ""
  try {
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

const resolveStorefrontUrl = (s?: string) =>
  (s || process.env.STOREFRONT_URL || STOREFRONT_FALLBACK).replace(/\/$/, "")

// Setează EMAIL_LOGO_URL (absolut, sau relativ la storefront) când există un
// logo pentru email. Fără el afișăm wordmark-ul text, nu o imagine ruptă.
const logoTag = (storefrontUrl?: string) => {
  const logo = process.env.EMAIL_LOGO_URL
  if (!logo) {
    return `<span style="font-family:${FONT_HEADING};font-size:22px;letter-spacing:-0.01em;color:${COLOR.dark};">${BRAND}</span>`
  }
  const src = /^https?:\/\//.test(logo)
    ? logo
    : `${resolveStorefrontUrl(storefrontUrl)}/${logo.replace(/^\//, "")}`
  return `<img src="${escape(src)}" alt="${BRAND}" width="180" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:auto;max-width:180px;">`
}

const button = (
  href: string,
  label: string,
  variant: "primary" | "secondary" = "primary"
) => {
  const bg = variant === "primary" ? COLOR.dark : COLOR.surface
  const fg = variant === "primary" ? "#ffffff" : COLOR.dark
  const border = variant === "primary" ? COLOR.dark : COLOR.border
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
      <tr><td style="border-radius:9999px;background:${bg};">
        <a href="${escape(href)}" style="display:inline-block;border:1px solid ${border};border-radius:9999px;padding:14px 28px;color:${fg};background:${bg};font-family:${FONT_BODY};font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">${escape(label)}</a>
      </td></tr>
    </table>`
}

type LayoutInput = {
  heading: string
  bodyHtml: string
  preheader?: string
  storefrontUrl?: string
}

const layout = ({ heading, bodyHtml, preheader, storefrontUrl }: LayoutInput) => `<!doctype html>
<html lang="${locale()}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escape(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${COLOR.light};font-family:${FONT_BODY};color:${COLOR.dark};-webkit-font-smoothing:antialiased;">
    ${preheader ? `<div style="display:none;visibility:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${escape(preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.light};padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr><td align="center" style="padding:8px 0 24px;">${logoTag(storefrontUrl)}</td></tr>
          <tr><td style="background:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:24px;padding:40px 32px;">
            <h1 style="margin:0 0 20px;font-family:${FONT_HEADING};font-size:28px;font-weight:400;line-height:1.2;color:${COLOR.dark};letter-spacing:-0.01em;">${escape(heading)}</h1>
            <div style="font-size:15px;line-height:1.65;color:${COLOR.dark};">${bodyHtml}</div>
          </td></tr>
          <tr><td style="padding:24px 8px 8px;">
            <p style="margin:0;font-size:12px;color:${COLOR.muted};line-height:1.7;text-align:center;">
              ${BRAND} este o marcă a ${LEGAL} — CUI ${CUI}, Reg. Com. ${REG_COM}.<br>
              Email automat — pentru asistență scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.muted};text-decoration:underline;">${SUPPORT_EMAIL}</a> (${SUPPORT_HOURS}).
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

const greeting = (firstName?: string) =>
  firstName ? `<p style="margin:0 0 16px;">Bună ${escape(firstName)},</p>` : ""

const productUrlFor = (item: any, storefrontUrl?: string) => {
  const handle = item.product_handle || item.variant?.product?.handle
  if (!handle) return null
  return `${resolveStorefrontUrl(storefrontUrl)}/${locale()}/products/${handle}`
}

const thumbnailImg = (item: any) => {
  const alt = escape(item.product_title || item.title || "")
  if (item.thumbnail) {
    return `<img src="${escape(item.thumbnail)}" width="56" height="56" alt="${alt}" style="display:block;width:56px;height:56px;border:0;outline:none;text-decoration:none;border-radius:10px;background:${COLOR.light};object-fit:cover;">`
  }
  return `<div style="width:56px;height:56px;border-radius:10px;background:${COLOR.light};"></div>`
}

const renderOrderItems = (
  items: any[] | undefined,
  storefrontUrl?: string
) => {
  if (!items?.length) return ""
  const rows = items
    .map((i) => {
      const href = productUrlFor(i, storefrontUrl)
      const thumb = thumbnailImg(i)
      const thumbCell = href
        ? `<a href="${escape(href)}" style="display:block;text-decoration:none;">${thumb}</a>`
        : thumb
      const title = escape(i.product_title || i.title || "")
      const titleEl = href
        ? `<a href="${escape(href)}" style="color:${COLOR.dark};text-decoration:none;font-weight:600;">${title}</a>`
        : `<strong style="color:${COLOR.dark};">${title}</strong>`
      return `
      <tr>
        <td valign="top" style="padding:14px 0;border-bottom:1px solid ${COLOR.border};width:72px;">
          ${thumbCell}
        </td>
        <td valign="top" style="padding:14px 0 14px 14px;border-bottom:1px solid ${COLOR.border};">
          <span style="font-size:14px;line-height:1.4;">${titleEl}</span>
          ${i.variant_title ? `<br><span style="color:${COLOR.muted};font-size:13px;line-height:1.5;">${escape(i.variant_title)}</span>` : ""}
        </td>
        <td valign="top" style="padding:14px 0;border-bottom:1px solid ${COLOR.border};text-align:center;color:${COLOR.muted};font-size:14px;">${i.quantity}</td>
        <td valign="top" style="padding:14px 0;border-bottom:1px solid ${COLOR.border};text-align:right;font-variant-numeric:tabular-nums;color:${COLOR.dark};font-size:14px;">${money(i.total, i.currency_code)}</td>
      </tr>`
    })
    .join("")
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;font-size:14px;border-collapse:collapse;">
      <thead><tr>
        <th colspan="2" align="left" style="padding:8px 0;border-bottom:2px solid ${COLOR.dark};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${COLOR.muted};font-weight:600;">Produs</th>
        <th style="padding:8px 0;border-bottom:2px solid ${COLOR.dark};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${COLOR.muted};font-weight:600;">Cant.</th>
        <th align="right" style="padding:8px 0;border-bottom:2px solid ${COLOR.dark};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${COLOR.muted};font-weight:600;">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

/** Ridicarea din magazin e singura opțiune fără taxă de curier. */
const isPickupOrder = (order: Record<string, any>) =>
  (order.shipping_methods ?? []).some((m: any) => /ridicare/i.test(m?.name ?? ""))

/** Metoda (sau metodele) de livrare alese, cu preț doar când chiar costă. */
const shippingMethodLine = (order: Record<string, any>): string => {
  const methods = (order.shipping_methods ?? []).filter(Boolean)
  if (!methods.length) return ""
  const text = methods
    .map((m: any) => {
      const amount = Number(m?.amount ?? 0)
      const price = amount > 0 ? ` — ${money(amount, order.currency_code)}` : ""
      return `${escape(m?.name ?? "")}${price}`
    })
    .join(", ")
  return `<li><strong>Metodă de livrare:</strong> ${text}</li>`
}

// Livrăm doar în România, dar codul de țară singur („RO") nu spune nimic pe
// un email pe care operatorul îl citește în grabă.
const COUNTRY_NAMES: Record<string, string> = { ro: "România" }

const countryName = (code?: string | null) =>
  code ? (COUNTRY_NAMES[code.toLowerCase()] ?? code.toUpperCase()) : ""

/**
 * Adresa pe linii, în ordinea în care se completează un AWB, ca să se poată
 * da copy-paste direct în aplicația de curierat. Județul apare doar când
 * adaugă ceva peste oraș — la București ar fi de două ori același cuvânt.
 */
const addressLines = (addr: any, email?: string | null): string[] => {
  if (!addr) return []
  const cityLine = [addr.postal_code, addr.city].filter(Boolean).join(" ")
  const county =
    addr.province && addr.province !== addr.city ? `jud. ${addr.province}` : ""
  return [
    [addr.first_name, addr.last_name].filter(Boolean).join(" "),
    addr.company,
    addr.address_1,
    addr.address_2,
    [cityLine, county].filter(Boolean).join(", "),
    countryName(addr.country_code),
    addr.phone,
    email,
  ]
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
}

/** La ridicarea din magazin adresa n-are rost — contactul, da. */
const contactLines = (order: Record<string, any>): string[] => {
  const addr = order?.shipping_address
  return [
    [addr?.first_name, addr?.last_name].filter(Boolean).join(" "),
    addr?.phone,
    order?.email,
  ]
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
}

/** `noteHtml` e HTML gata escapat — restul liniilor le escapăm aici. */
const addressPanel = (
  title: string,
  lines: string[],
  noteHtml = ""
): string => {
  if (!lines.length) return ""
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;">
      <tr><td style="background:${COLOR.light};border:1px solid ${COLOR.border};border-radius:16px;padding:18px 20px;">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${COLOR.muted};font-weight:600;">${escape(title)}</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:${COLOR.dark};">${lines.map(escape).join("<br>")}</p>
        ${noteHtml ? `<p style="margin:10px 0 0;font-size:12px;color:${COLOR.muted};line-height:1.6;">${noteHtml}</p>` : ""}
      </td></tr>
    </table>`
}

/** Panoul de livrare, în forma potrivită comenzii — curier sau ridicare. */
const deliveryPanel = (order: Record<string, any>, noteHtml = ""): string =>
  isPickupOrder(order)
    ? addressPanel("Ridicare din magazin", contactLines(order), noteHtml)
    : addressPanel(
        "Adresă de livrare",
        addressLines(order?.shipping_address, order?.email),
        noteHtml
      )

/** Linia „Facturare firmă" din emailul intern — cu ea se emite factura. */
const buyerFiscalLine = (order: Record<string, any>): string => {
  const fiscal = readBuyerFiscal(order.metadata)
  if (!fiscal) return ""

  const name = fiscal.name || order.billing_address?.company || ""
  const parts = [
    name && escape(name),
    escape(formatBuyerCui(fiscal.cui, fiscal.vatPayer)),
    fiscal.regCom ? `Reg. Com. ${escape(fiscal.regCom)}` : "",
    fiscal.vatPayer ? "plătitoare de TVA" : "neplătitoare de TVA",
  ].filter(Boolean)

  return `<li><strong>Factură pe firmă:</strong> ${parts.join(" · ")}</li>`
}

/** Aceleași date, confirmate clientului cât mai poate cere o corectură. */
const buyerFiscalNote = (order: Record<string, any>): string => {
  const fiscal = readBuyerFiscal(order.metadata)
  if (!fiscal) return ""

  const name = fiscal.name || order.billing_address?.company || ""

  return `<p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Factura se emite pe <strong>${escape(name)}</strong>, ${escape(formatBuyerCui(fiscal.cui, fiscal.vatPayer))}${fiscal.regCom ? `, Reg. Com. ${escape(fiscal.regCom)}` : ""}. Dacă datele nu sunt corecte, răspunde la acest email.</p>`
}

const orderPlacedCustomer: Renderer = ({ order, storefront_url }) => {
  const display = order.display_id ?? order.id
  const orderUrl = `${resolveStorefrontUrl(storefront_url)}/${locale()}/order/${order.id}/confirmed`
  const firstName = order.shipping_address?.first_name
  const pickup = isPickupOrder(order)
  // Totalul comenzii nu conține transportul — clientul îl dă curierului.
  const courierNote = pickup
    ? ""
    : `<p style="margin:0 0 16px;font-size:13px;color:${COLOR.muted};">Taxa de transport nu este inclusă în acest total: o achiți direct curierului, la primirea coletului.</p>`
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 16px;">îți mulțumim pentru comanda <strong>#${escape(display)}</strong>. Am primit-o cu bine și o pregătim.</p>
    ${renderOrderItems(order.items, storefront_url)}
    <p style="margin:16px 0;font-size:16px;"><strong>Total: ${money(order.total, order.currency_code)}</strong></p>
    ${courierNote}
    ${deliveryPanel(
      order,
      pickup
        ? ""
        : "Dacă adresa nu e corectă, răspunde la acest email cât mai repede — o corectăm înainte să predăm coletul curierului."
    )}
    ${button(orderUrl, "Vezi comanda")}
    ${buyerFiscalNote(order)}
    <p style="margin:16px 0 0;color:${COLOR.muted};">${pickup ? "Îți scriem din nou imediat ce comanda te așteaptă în magazin." : "Îți scriem din nou imediat ce comanda pleacă spre tine."}</p>`
  return {
    subject: `Confirmare comandă #${display} — ${BRAND}`,
    html: layout({
      heading: `Comandă confirmată #${display}`,
      preheader: `Am primit comanda ta #${display}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const orderPlacedAdmin: Renderer = ({ order, admin_url, storefront_url }) => {
  const display = order.display_id ?? order.id
  const adminLink = admin_url ? `${admin_url}/app/orders/${order.id}` : null
  const body = `
    <p style="margin:0 0 12px;">Comandă nouă primită: <strong>#${escape(display)}</strong></p>
    <ul style="font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 16px;">
      <li>Client: ${escape(order.email)}</li>
      <li>Total: <strong>${money(order.total, order.currency_code)}</strong></li>
      <li>Produse: ${order.items?.length ?? 0}</li>
      ${shippingMethodLine(order)}
      ${buyerFiscalLine(order)}
    </ul>
    ${deliveryPanel(order)}
    ${renderOrderItems(order.items, storefront_url)}
    ${adminLink ? button(adminLink, "Deschide comanda în admin") : ""}`
  return {
    subject: `[${BRAND}] Comandă nouă #${display} — ${money(order.total, order.currency_code)}`,
    html: layout({
      heading: `Comandă nouă #${display}`,
      preheader: `${money(order.total, order.currency_code)} — ${order.items?.length ?? 0} produse`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const shipmentCreated: Renderer = ({ order, shipment, storefront_url }) => {
  const display = order?.display_id ?? order?.id ?? ""
  const tracking =
    shipment?.labels?.[0]?.tracking_number || shipment?.tracking_numbers?.[0]
  const trackingUrl = shipment?.labels?.[0]?.url
  const orderUrl = order
    ? `${resolveStorefrontUrl(storefront_url)}/${locale()}/order/${order.id}/confirmed`
    : null
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">comanda ta <strong>#${escape(display)}</strong> a fost expediată.</p>
    ${tracking ? `<p style="margin:0 0 12px;">Număr de urmărire (AWB): <strong>${escape(tracking)}</strong></p>` : ""}
    ${trackingUrl ? `<p style="margin:0 0 12px;"><a href="${escape(trackingUrl)}" style="color:${COLOR.accent};text-decoration:underline;">Urmărește coletul</a></p>` : ""}
    ${orderUrl ? button(orderUrl, "Vezi detaliile") : ""}
    <p style="margin:16px 0 0;color:${COLOR.muted};">Îți mulțumim că ai ales ${BRAND}.</p>`
  return {
    subject: `Comanda #${display} a plecat spre tine — ${BRAND}`,
    html: layout({
      heading: "Comanda ta a fost expediată",
      preheader: `Comanda #${display} e pe drum${tracking ? ` — AWB ${tracking}` : ""}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const inviteCreated: Renderer = ({ invite, admin_url, storefront_url }) => {
  const link = admin_url
    ? `${admin_url}/app/invite?token=${encodeURIComponent(invite.token)}`
    : `(token: ${invite.token})`
  const body = `
    <p style="margin:0 0 12px;">Ai fost invitat să colaborezi în panoul de administrare ${BRAND}.</p>
    ${button(link, "Acceptă invitația")}
    <p style="margin:16px 0 8px;font-size:13px;color:${COLOR.muted};">Dacă butonul nu funcționează, copiază linkul în browser:</p>
    <p style="margin:0 0 12px;font-size:12px;color:${COLOR.muted};word-break:break-all;"><span style="word-break:break-all;">${escape(link)}</span></p>
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Invitația expiră în 7 zile.</p>`
  return {
    subject: `Invitație în panoul de administrare ${BRAND}`,
    html: layout({
      heading: "Invitație administrator",
      preheader: `Acceptă invitația pentru a accesa adminul ${BRAND}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const passwordReset: Renderer = ({
  token,
  entity_id,
  actor_type,
  storefront_url,
  admin_url,
}) => {
  const isAdmin = actor_type === "user"
  const baseUrl = isAdmin ? admin_url : resolveStorefrontUrl(storefront_url)
  const path = isAdmin
    ? `/app/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(entity_id)}`
    : `/${locale()}/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(entity_id)}`
  const link = baseUrl ? `${baseUrl}${path}` : `(token: ${token})`
  const body = `
    <p style="margin:0 0 12px;">Am primit o cerere de resetare a parolei pentru <strong>${escape(entity_id)}</strong>.</p>
    ${button(link, "Resetează parola")}
    <p style="margin:16px 0 8px;font-size:13px;color:${COLOR.muted};">Dacă nu tu ai cerut acest email, ignoră-l — parola ta rămâne neschimbată.</p>
    <p style="margin:0 0 8px;font-size:13px;color:${COLOR.muted};">Linkul expiră în 15 minute.</p>
    <p style="margin:16px 0 0;font-size:12px;color:${COLOR.muted};word-break:break-all;">Link direct: ${escape(link)}</p>`
  return {
    subject: `Resetare parolă — ${BRAND}`,
    html: layout({
      heading: "Resetează-ți parola",
      preheader: "Link valabil 15 minute pentru a seta o parolă nouă.",
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const returnRequestedAdmin: Renderer = ({
  order,
  request,
  admin_url,
  storefront_url,
}) => {
  const display = order?.display_id ?? order?.id ?? ""
  const itemsHtml = (request?.items ?? [])
    .map((it: any) => {
      const orderItem = order?.items?.find((i: any) => i.id === it.item_id)
      const title = orderItem?.product_title || orderItem?.title || it.item_id
      return `<li style="margin-bottom:6px;">
          <strong>${escape(title)}</strong> × ${it.quantity}
          ${it.reason ? ` — <span style="color:${COLOR.muted};">${escape(it.reason)}</span>` : ""}
          ${it.note ? `<br><span style="font-size:12px;color:${COLOR.muted};">${escape(it.note)}</span>` : ""}
        </li>`
    })
    .join("")
  const adminLink = admin_url ? `${admin_url}/app/orders/${order.id}` : null
  const body = `
    <p style="margin:0 0 12px;">Cerere nouă de retur pentru comanda <strong>#${escape(display)}</strong>.</p>
    <ul style="font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 16px;">
      <li>Client: ${escape(order.email)}</li>
      <li>Cerere trimisă la: ${escape(new Date(request.requested_at).toLocaleString("ro-RO"))}</li>
    </ul>
    <h3 style="margin:16px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Produse cerute pentru retur</h3>
    <ul style="font-size:14px;padding-left:20px;margin:0 0 16px;">${itemsHtml}</ul>
    ${request.note ? `<p style="background:${COLOR.light};padding:14px 16px;border-radius:12px;font-size:13px;margin:16px 0;"><strong>Mesajul clientului:</strong><br>${escape(request.note)}</p>` : ""}
    ${adminLink ? button(adminLink, "Deschide comanda în admin") : ""}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Procesează returul în admin în maximum 48 de ore și contactează clientul pentru ridicarea coletului.</p>`
  return {
    subject: `[${BRAND}] Cerere de retur — Comanda #${display}`,
    html: layout({
      heading: `Cerere de retur — #${display}`,
      preheader: `Client: ${order.email} — ${(request?.items ?? []).length} produse.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const returnRequestedCustomer: Renderer = ({
  order,
  request,
  storefront_url,
}) => {
  const display = order?.display_id ?? order?.id ?? ""
  const orderUrl = `${resolveStorefrontUrl(storefront_url)}/${locale()}/account/orders/details/${order.id}`
  const itemsHtml = (request?.items ?? [])
    .map((it: any) => {
      const orderItem = order?.items?.find((i: any) => i.id === it.item_id)
      const title = orderItem?.product_title || orderItem?.title || it.item_id
      return `<li style="margin-bottom:6px;"><strong>${escape(title)}</strong> × ${it.quantity}${it.reason ? ` — <span style="color:${COLOR.muted};">${escape(it.reason)}</span>` : ""}</li>`
    })
    .join("")
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">am primit cererea ta de retur pentru comanda <strong>#${escape(display)}</strong>. Echipa noastră o preia în maximum 48 de ore.</p>
    <h3 style="margin:16px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Produse de returnat</h3>
    <ul style="font-size:14px;padding-left:20px;margin:0 0 16px;">${itemsHtml}</ul>
    <h3 style="margin:24px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Ce urmează</h3>
    <ol style="font-size:14px;padding-left:20px;margin:0 0 16px;line-height:1.7;">
      <li>Te contactăm ca să stabilim ridicarea coletului sau expedierea lui către noi.</li>
      <li>După ce primim produsele, verificăm starea lor.</li>
      <li>Îți returnăm banii pe aceeași metodă de plată, în maximum 14 zile de la primirea returului.</li>
    </ol>
    ${button(orderUrl, "Vezi comanda")}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Pentru orice întrebare scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Cerere de retur înregistrată — Comanda #${display}`,
    html: layout({
      heading: "Cererea ta de retur a fost înregistrată",
      preheader: `Procesăm returul pentru comanda #${display}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const orderCanceledCustomer: Renderer = ({ order, storefront_url }) => {
  const display = order?.display_id ?? order?.id ?? ""
  const orderUrl = `${resolveStorefrontUrl(storefront_url)}/${locale()}/account/orders/details/${order.id}`
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">îți confirmăm că <strong>comanda #${escape(display)}</strong> a fost anulată.</p>
    <p style="margin:0 0 12px;">Dacă plata fusese deja făcută, suma de <strong>${money(order.total, order.currency_code)}</strong> îți este returnată pe aceeași metodă de plată, în 5–10 zile lucrătoare.</p>
    ${renderOrderItems(order.items, storefront_url)}
    ${button(orderUrl, "Vezi detaliile comenzii")}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Dacă nu tu ai cerut anularea sau vrei să afli ce s-a întâmplat, scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Comanda #${display} a fost anulată — ${BRAND}`,
    html: layout({
      heading: `Comanda #${display} a fost anulată`,
      preheader: `Comanda #${display} a fost anulată. Eventuala restituire, în 5–10 zile.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

/**
 * Plata cu cardul nu a trecut. Comanda rămâne înregistrată, deci îi dăm
 * clientului drumul înapoi spre pagina de plată în loc să o luăm de la coș.
 */
const paymentFailedCustomer: Renderer = ({ order, reason, storefront_url }) => {
  const display = order?.display_id ?? order?.id ?? ""
  const retryUrl = `${resolveStorefrontUrl(storefront_url)}/${locale()}/order/${order.id}/pay`
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">plata pentru <strong>comanda #${escape(display)}</strong> nu a fost finalizată, așa că deocamdată comanda e în așteptare. Nu ți s-a reținut nicio sumă.</p>
    ${
      reason
        ? `<p style="margin:0 0 12px;font-size:14px;color:${COLOR.muted};">Motivul transmis de bancă: ${escape(String(reason))}.</p>`
        : ""
    }
    <p style="margin:0 0 12px;">Poți relua plata din butonul de mai jos — produsele rămân rezervate pentru tine.</p>
    ${button(retryUrl, "Reia plata")}
    ${renderOrderItems(order?.items, storefront_url)}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Dacă preferi altă metodă de plată sau ai nevoie de ajutor, scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Plata pentru comanda #${display} nu a reușit — ${BRAND}`,
    html: layout({
      heading: "Plata nu a reușit",
      preheader: `Comanda #${display} așteaptă plata. Poți relua oricând.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const customerWelcome: Renderer = ({ customer, storefront_url }) => {
  const firstName = customer?.first_name
  const storeUrl = `${resolveStorefrontUrl(storefront_url)}/it`
  const accountUrl = `${resolveStorefrontUrl(storefront_url)}/${locale()}/account`
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">bine ai venit la ${BRAND}. Contul tău e gata: de acum îți poți urmări comenzile, îți salvezi adresele și finalizezi comenzile mai rapid.</p>
    <h3 style="margin:24px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Ce poți face din contul tău</h3>
    <ul style="font-size:14px;padding-left:20px;margin:0 0 16px;line-height:1.7;">
      <li>Urmărești starea comenzilor și a livrărilor.</li>
      <li>Salvezi adresele de livrare și de facturare.</li>
      <li>Descarci facturile în PDF.</li>
      <li>Ceri retur în 14 zile de la primirea comenzii.</li>
    </ul>
    ${button(storeUrl, "Descoperă produsele")}
    ${button(accountUrl, "Mergi la contul meu", "secondary")}
    <p style="margin:24px 0 0;font-size:13px;color:${COLOR.muted};">Suntem aici dacă ai nevoie de recomandări sau de ajutor în alegerea device-ului potrivit — scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Bine ai venit la ${BRAND}`,
    html: layout({
      heading: `Bine ai venit la ${BRAND}`,
      preheader: "Contul tău e gata. Iată ce poți face.",
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

// Adresa + programul punctului de ridicare. Configurabile din env ca să nu
// fie nevoie de deploy când se schimbă locația. Citite la randare, nu la
// import, ca să nu depindă de ordinea de încărcare a env-ului.
const pickupDetails = () => ({
  address: process.env.STORE_PICKUP_ADDRESS || "",
  hours: process.env.STORE_PICKUP_HOURS || "",
  phone: process.env.STORE_PICKUP_PHONE || "",
})

/**
 * Anunță clientul că o comandă cu ridicare personală e gata în magazin.
 * `note` e textul opțional scris de operator din Admin.
 */
const orderReadyForPickup: Renderer = ({ order, note, storefront_url }) => {
  const display = order?.display_id ?? order?.id ?? ""
  const orderUrl = order
    ? `${resolveStorefrontUrl(storefront_url)}/${locale()}/order/${order.id}/confirmed`
    : null
  const firstName = order?.shipping_address?.first_name

  const pickup = pickupDetails()
  const details = [
    pickup.address ? `<li><strong>Adresă:</strong> ${escape(pickup.address)}</li>` : "",
    pickup.hours ? `<li><strong>Program:</strong> ${escape(pickup.hours)}</li>` : "",
    pickup.phone ? `<li><strong>Telefon:</strong> ${escape(pickup.phone)}</li>` : "",
  ]
    .filter(Boolean)
    .join("")

  const body = `
    ${firstName ? `<p style="margin:0 0 16px;">Bună ${escape(firstName)},</p>` : ""}
    <p style="margin:0 0 12px;">comanda ta <strong>#${escape(display)}</strong> este pregătită și te așteaptă în magazin.</p>
    ${
      details
        ? `<ul style="font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 16px;">${details}</ul>`
        : ""
    }
    <p style="margin:0 0 12px;">Când vii, ai nevoie doar de numărul comenzii <strong>#${escape(display)}</strong> și un act de identitate.</p>
    ${
      note
        ? `<p style="background:${COLOR.light};padding:14px 16px;border-radius:12px;font-size:14px;margin:16px 0;">${escape(note)}</p>`
        : ""
    }
    ${renderOrderItems(order?.items, storefront_url)}
    ${orderUrl ? button(orderUrl, "Vezi detaliile comenzii") : ""}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Dacă nu poți ajunge în perioada următoare sau vrei să schimbi modalitatea de livrare, scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`

  return {
    subject: `Comanda #${display} te așteaptă în magazin — ${BRAND}`,
    html: layout({
      heading: `Comanda #${display} e gata de ridicare`,
      preheader: `Comanda #${display} este disponibilă pentru ridicare în magazin.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

/**
 * Schimbare de status pusă manual de operator din admin.
 *
 * Textul e deliberat scurt și neutru: statusurile care au un mesaj propriu
 * (anulare, plată eșuată, virament, ridicare din magazin) au template-ul lor,
 * cu instrucțiuni concrete. Ăsta acoperă restul — „În procesare", „În
 * așteptare" — unde singura informație utilă e nota scrisă de operator.
 */
const orderStatusChanged: Renderer = ({
  order,
  status_label,
  note,
  storefront_url,
}) => {
  const display = order?.display_id ?? order?.id ?? ""
  const orderUrl = `${resolveStorefrontUrl(storefront_url)}/${locale()}/account/orders/details/${order.id}`
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">avem o actualizare pentru <strong>comanda #${escape(display)}</strong>:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      <tr><td style="border-radius:9999px;background:${COLOR.light};border:1px solid ${COLOR.border};padding:10px 20px;font-family:${FONT_BODY};font-size:15px;font-weight:600;color:${COLOR.dark};">${escape(status_label)}</td></tr>
    </table>
    ${
      note
        ? `<p style="margin:0 0 12px;">${escape(String(note))}</p>`
        : ""
    }
    ${renderOrderItems(order?.items, storefront_url)}
    ${button(orderUrl, "Vezi detaliile comenzii")}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Ai o întrebare despre comandă? Scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Comanda #${display}: ${status_label} — ${BRAND}`,
    html: layout({
      heading: `Comanda #${display}`,
      preheader: `Status nou: ${status_label}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

/**
 * Blocul cu datele contului, folosit de emailul de virament.
 *
 * Fără `BANK_IBAN` configurat întoarce șir gol. În practică nu se ajunge aici
 * — ruta de status refuză să trimită emailul — dar dacă s-ar ajunge, un bloc
 * gol e mai onest decât un tabel cu „IBAN:" urmat de nimic.
 */
const bankDetails = (order: any) => {
  const bank = bankAccount()
  if (!bank) return ""

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;border:1px solid ${COLOR.border};border-radius:12px;background:${COLOR.light};">
    <tr><td style="padding:20px 24px;font-family:${FONT_BODY};font-size:14px;color:${COLOR.dark};line-height:1.7;">
      <div style="color:${COLOR.muted};font-size:12px;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Date pentru plată</div>
      <div><strong>Beneficiar:</strong> ${escape(bank.holder)}</div>
      <div><strong>IBAN:</strong> <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escape(bank.iban)}</span></div>
      ${bank.name ? `<div><strong>Banca:</strong> ${escape(bank.name)}</div>` : ""}
      <div><strong>Sumă:</strong> ${money(order?.total, order?.currency_code)}</div>
      <div><strong>Detalii plată:</strong> Comanda #${escape(order?.display_id ?? order?.id ?? "")}</div>
    </td></tr>
  </table>`
}

/**
 * Comandă lăsată pe ordin de plată. Pe lângă IBAN îi dăm și butonul de plată
 * cu cardul: cei mai mulți clienți aleg viramentul din inerție, iar dacă tot
 * deschid emailul e momentul în care pot plăti pe loc.
 */
const orderBankTransfer: Renderer = ({ order, pay_url, note, storefront_url }) => {
  const display = order?.display_id ?? order?.id ?? ""
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 16px;">îți mulțumim pentru <strong>comanda #${escape(display)}</strong>. Așteptăm plata prin ordin de plată în contul de mai jos — pregătim coletul imediat ce banii intră.</p>
    ${bankDetails(order)}
    ${note ? `<p style="margin:0 0 12px;">${escape(String(note))}</p>` : ""}
    ${
      pay_url
        ? `<p style="margin:0 0 4px;">Dacă preferi să nu aștepți transferul, poți plăti acum cu cardul:</p>${button(pay_url, "Plătește cu cardul")}`
        : ""
    }
    ${renderOrderItems(order?.items, storefront_url)}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Transferul între bănci diferite poate dura până la o zi lucrătoare. Întrebări: <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Comanda #${display} — date pentru plata prin virament`,
    html: layout({
      heading: `Plata comenzii #${display}`,
      preheader: `IBAN și detaliile pentru plata comenzii #${display}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

/**
 * Link de plată trimis din admin pentru o comandă neîncasată — plată eșuată,
 * client care s-a răzgândit de la virament, sau pur și simplu o comandă la care
 * plata nu a fost dusă până la capăt.
 */
const orderPaymentLink: Renderer = ({ order, pay_url, note, storefront_url }) => {
  const display = order?.display_id ?? order?.id ?? ""
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;"><strong>comanda #${escape(display)}</strong> este înregistrată, dar plata nu a fost finalizată. Poți plăti online, cu cardul, din butonul de mai jos.</p>
    ${note ? `<p style="margin:0 0 12px;">${escape(String(note))}</p>` : ""}
    <p style="margin:0 0 4px;">Sumă de plată: <strong>${money(order?.total, order?.currency_code)}</strong></p>
    ${button(pay_url, "Plătește comanda")}
    ${renderOrderItems(order?.items, storefront_url)}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Produsele rămân rezervate pentru tine. Dacă întâmpini probleme la plată, scrie-ne la <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Plătește comanda #${display} — ${BRAND}`,
    html: layout({
      heading: `Plătește comanda #${display}`,
      preheader: `Link de plată pentru comanda #${display}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

export const TEMPLATES = {
  "order-placed-customer": orderPlacedCustomer,
  "order-ready-for-pickup": orderReadyForPickup,
  "order-placed-admin": orderPlacedAdmin,
  "shipment-created": shipmentCreated,
  "invite-created": inviteCreated,
  "password-reset": passwordReset,
  "return-requested-admin": returnRequestedAdmin,
  "return-requested-customer": returnRequestedCustomer,
  "order-canceled-customer": orderCanceledCustomer,
  "order-status-changed": orderStatusChanged,
  "order-bank-transfer": orderBankTransfer,
  "order-payment-link": orderPaymentLink,
  "payment-failed-customer": paymentFailedCustomer,
  "customer-welcome": customerWelcome,
} as const

export type TemplateName = keyof typeof TEMPLATES

export const renderTemplate = (
  name: string,
  data: Record<string, any>
): RenderedEmail | null => {
  const renderer = (TEMPLATES as Record<string, Renderer>)[name]
  if (!renderer) return null
  return renderer(data)
}
