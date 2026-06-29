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

const BRAND = "Arredovita"
const LEGAL = "Premium Transport S.r.l."
const SUPPORT_EMAIL = "info@arredovita.it"
const STOREFRONT_FALLBACK = "https://www.arredovita.it"

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

const money = (amount: number | undefined, currency = "EUR") => {
  if (amount == null) return ""
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

const resolveStorefrontUrl = (s?: string) =>
  (s || process.env.STOREFRONT_URL || STOREFRONT_FALLBACK).replace(/\/$/, "")

const logoTag = (storefrontUrl?: string) => {
  const base = resolveStorefrontUrl(storefrontUrl)
  return `<img src="${base}/logo-arredo-vita-email.png" alt="${BRAND}" width="180" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:auto;max-width:180px;">`
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
<html lang="it">
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
              ${BRAND} è un marchio di ${LEGAL}.<br>
              Email automatica — per assistenza scrivici a <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.muted};text-decoration:underline;">${SUPPORT_EMAIL}</a>.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`

const greeting = (firstName?: string) =>
  firstName ? `<p style="margin:0 0 16px;">Ciao ${escape(firstName)},</p>` : ""

const productUrlFor = (item: any, storefrontUrl?: string) => {
  const handle = item.product_handle || item.variant?.product?.handle
  if (!handle) return null
  return `${resolveStorefrontUrl(storefrontUrl)}/it/products/${handle}`
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
        <th colspan="2" align="left" style="padding:8px 0;border-bottom:2px solid ${COLOR.dark};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${COLOR.muted};font-weight:600;">Prodotto</th>
        <th style="padding:8px 0;border-bottom:2px solid ${COLOR.dark};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${COLOR.muted};font-weight:600;">Q.tà</th>
        <th align="right" style="padding:8px 0;border-bottom:2px solid ${COLOR.dark};font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:${COLOR.muted};font-weight:600;">Totale</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

const orderPlacedCustomer: Renderer = ({ order, storefront_url }) => {
  const display = order.display_id ?? order.id
  const orderUrl = `${resolveStorefrontUrl(storefront_url)}/it/order/${order.id}/confirmed`
  const firstName = order.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 16px;">grazie per il tuo ordine <strong>#${escape(display)}</strong>. Lo abbiamo ricevuto correttamente e lo stiamo preparando.</p>
    ${renderOrderItems(order.items, storefront_url)}
    <p style="margin:16px 0;font-size:16px;"><strong>Totale: ${money(order.total, order.currency_code)}</strong></p>
    ${button(orderUrl, "Vedi il tuo ordine")}
    <p style="margin:16px 0 0;color:${COLOR.muted};">Ti scriveremo di nuovo non appena la spedizione partirà.</p>`
  return {
    subject: `Conferma ordine #${display} — ${BRAND}`,
    html: layout({
      heading: `Ordine confermato #${display}`,
      preheader: `Abbiamo ricevuto il tuo ordine #${display}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const orderPlacedAdmin: Renderer = ({ order, admin_url, storefront_url }) => {
  const display = order.display_id ?? order.id
  const adminLink = admin_url ? `${admin_url}/app/orders/${order.id}` : null
  const body = `
    <p style="margin:0 0 12px;">Nuovo ordine ricevuto: <strong>#${escape(display)}</strong></p>
    <ul style="font-size:14px;line-height:1.8;padding-left:20px;margin:0 0 16px;">
      <li>Cliente: ${escape(order.email)}</li>
      <li>Totale: <strong>${money(order.total, order.currency_code)}</strong></li>
      <li>Articoli: ${order.items?.length ?? 0}</li>
      ${order.shipping_address ? `<li>Spedizione: ${escape(order.shipping_address.first_name)} ${escape(order.shipping_address.last_name)} — ${escape(order.shipping_address.city)}, ${escape(order.shipping_address.country_code)}</li>` : ""}
    </ul>
    ${renderOrderItems(order.items, storefront_url)}
    ${adminLink ? button(adminLink, "Apri l'ordine in admin") : ""}`
  return {
    subject: `[${BRAND}] Nuovo ordine #${display} — ${money(order.total, order.currency_code)}`,
    html: layout({
      heading: `Nuovo ordine #${display}`,
      preheader: `${money(order.total, order.currency_code)} — ${order.items?.length ?? 0} articoli`,
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
    ? `${resolveStorefrontUrl(storefront_url)}/it/order/${order.id}/confirmed`
    : null
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">il tuo ordine <strong>#${escape(display)}</strong> è stato spedito.</p>
    ${tracking ? `<p style="margin:0 0 12px;">Codice di tracking: <strong>${escape(tracking)}</strong></p>` : ""}
    ${trackingUrl ? `<p style="margin:0 0 12px;"><a href="${escape(trackingUrl)}" style="color:${COLOR.accent};text-decoration:underline;">Traccia la spedizione</a></p>` : ""}
    ${orderUrl ? button(orderUrl, "Vedi i dettagli") : ""}
    <p style="margin:16px 0 0;color:${COLOR.muted};">Grazie per aver scelto ${BRAND}.</p>`
  return {
    subject: `Il tuo ordine #${display} è in viaggio — ${BRAND}`,
    html: layout({
      heading: "La tua spedizione è partita",
      preheader: `Ordine #${display} in viaggio${tracking ? ` — tracking ${tracking}` : ""}.`,
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
    <p style="margin:0 0 12px;">Sei stato invitato a collaborare nell'admin di ${BRAND}.</p>
    ${button(link, "Accetta l'invito")}
    <p style="margin:16px 0 8px;font-size:13px;color:${COLOR.muted};">Se il pulsante non funziona, copia questo link nel browser:</p>
    <p style="margin:0 0 12px;font-size:12px;color:${COLOR.muted};word-break:break-all;"><span style="word-break:break-all;">${escape(link)}</span></p>
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">L'invito scade tra 7 giorni.</p>`
  return {
    subject: `Invito a collaborare in ${BRAND} admin`,
    html: layout({
      heading: "Invito amministratore",
      preheader: `Accetta l'invito per accedere all'admin di ${BRAND}.`,
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
    : `/it/account/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(entity_id)}`
  const link = baseUrl ? `${baseUrl}${path}` : `(token: ${token})`
  const body = `
    <p style="margin:0 0 12px;">Abbiamo ricevuto una richiesta di reimpostazione della password per <strong>${escape(entity_id)}</strong>.</p>
    ${button(link, "Reimposta la password")}
    <p style="margin:16px 0 8px;font-size:13px;color:${COLOR.muted};">Se non hai richiesto tu questa email, ignorala — la tua password resta invariata.</p>
    <p style="margin:0 0 8px;font-size:13px;color:${COLOR.muted};">Il link scade tra 15 minuti.</p>
    <p style="margin:16px 0 0;font-size:12px;color:${COLOR.muted};word-break:break-all;">Link diretto: ${escape(link)}</p>`
  return {
    subject: `Reimposta la tua password — ${BRAND}`,
    html: layout({
      heading: "Reimposta la tua password",
      preheader: "Link valido 15 minuti per impostare una nuova password.",
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
    <p style="margin:0 0 12px;">Nuova richiesta di reso per l'ordine <strong>#${escape(display)}</strong>.</p>
    <ul style="font-size:14px;line-height:1.7;padding-left:20px;margin:0 0 16px;">
      <li>Cliente: ${escape(order.email)}</li>
      <li>Richiesta il: ${escape(new Date(request.requested_at).toLocaleString("it-IT"))}</li>
    </ul>
    <h3 style="margin:16px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Articoli richiesti per il reso</h3>
    <ul style="font-size:14px;padding-left:20px;margin:0 0 16px;">${itemsHtml}</ul>
    ${request.note ? `<p style="background:${COLOR.light};padding:14px 16px;border-radius:12px;font-size:13px;margin:16px 0;"><strong>Nota cliente:</strong><br>${escape(request.note)}</p>` : ""}
    ${adminLink ? button(adminLink, "Apri l'ordine in admin") : ""}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Processa il reso in admin entro 48 ore e contatta il cliente per il ritiro.</p>`
  return {
    subject: `[${BRAND}] Richiesta reso — Ordine #${display}`,
    html: layout({
      heading: `Richiesta reso — #${display}`,
      preheader: `Cliente: ${order.email} — ${(request?.items ?? []).length} articoli.`,
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
  const orderUrl = `${resolveStorefrontUrl(storefront_url)}/it/account/orders/details/${order.id}`
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
    <p style="margin:0 0 12px;">abbiamo ricevuto la tua richiesta di reso per l'ordine <strong>#${escape(display)}</strong>. Il nostro team la prenderà in carico entro 48 ore.</p>
    <h3 style="margin:16px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Articoli da restituire</h3>
    <ul style="font-size:14px;padding-left:20px;margin:0 0 16px;">${itemsHtml}</ul>
    <h3 style="margin:24px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Cosa succede ora</h3>
    <ol style="font-size:14px;padding-left:20px;margin:0 0 16px;line-height:1.7;">
      <li>Ti contatteremo per organizzare il ritiro o concordare la spedizione di ritorno.</li>
      <li>Ricevuto il reso, verifichiamo lo stato degli articoli.</li>
      <li>Procediamo al rimborso sul metodo di pagamento originale entro 14 giorni.</li>
    </ol>
    ${button(orderUrl, "Vedi il tuo ordine")}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Per qualsiasi domanda scrivi a <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Richiesta di reso ricevuta — Ordine #${display}`,
    html: layout({
      heading: "Richiesta di reso ricevuta",
      preheader: `Stiamo elaborando il reso dell'ordine #${display}.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const orderCanceledCustomer: Renderer = ({ order, storefront_url }) => {
  const display = order?.display_id ?? order?.id ?? ""
  const orderUrl = `${resolveStorefrontUrl(storefront_url)}/it/account/orders/details/${order.id}`
  const firstName = order?.shipping_address?.first_name
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">ti confermiamo che il tuo ordine <strong>#${escape(display)}</strong> è stato annullato.</p>
    <p style="margin:0 0 12px;">Se avevi già effettuato il pagamento, l'importo di <strong>${money(order.total, order.currency_code)}</strong> verrà rimborsato sul metodo di pagamento originale entro 5–10 giorni lavorativi.</p>
    ${renderOrderItems(order.items, storefront_url)}
    ${button(orderUrl, "Vedi i dettagli dell'ordine")}
    <p style="margin:16px 0 0;font-size:13px;color:${COLOR.muted};">Se non hai richiesto tu l'annullamento o vuoi capire cosa è successo, scrivi a <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Ordine #${display} annullato — ${BRAND}`,
    html: layout({
      heading: `Ordine #${display} annullato`,
      preheader: `L'ordine #${display} è stato annullato. Eventuale rimborso entro 5–10 giorni.`,
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

const customerWelcome: Renderer = ({ customer, storefront_url }) => {
  const firstName = customer?.first_name
  const storeUrl = `${resolveStorefrontUrl(storefront_url)}/it`
  const accountUrl = `${resolveStorefrontUrl(storefront_url)}/it/account`
  const body = `
    ${greeting(firstName)}
    <p style="margin:0 0 12px;">benvenuto in ${BRAND}. Il tuo account è pronto: da ora puoi seguire i tuoi ordini, gestire gli indirizzi e accedere a un checkout più rapido.</p>
    <h3 style="margin:24px 0 8px;font-family:${FONT_HEADING};font-size:18px;font-weight:400;color:${COLOR.dark};">Cosa puoi fare dal tuo account</h3>
    <ul style="font-size:14px;padding-left:20px;margin:0 0 16px;line-height:1.7;">
      <li>Tenere d'occhio lo stato di spedizione degli ordini.</li>
      <li>Salvare gli indirizzi di spedizione e fatturazione.</li>
      <li>Scaricare le fatture in PDF.</li>
      <li>Richiedere un reso entro 14 giorni dalla consegna.</li>
    </ul>
    ${button(storeUrl, "Scopri il catalogo")}
    ${button(accountUrl, "Vai al mio account", "secondary")}
    <p style="margin:24px 0 0;font-size:13px;color:${COLOR.muted};">Siamo qui se hai bisogno di consigli sui prodotti o sulla scelta giusta per i tuoi spazi — scrivi a <a href="mailto:${SUPPORT_EMAIL}" style="color:${COLOR.accent};">${SUPPORT_EMAIL}</a>.</p>`
  return {
    subject: `Benvenuto in ${BRAND}`,
    html: layout({
      heading: `Benvenuto in ${BRAND}`,
      preheader: "Il tuo account è pronto. Ecco cosa puoi fare.",
      bodyHtml: body,
      storefrontUrl: storefront_url,
    }),
  }
}

export const TEMPLATES = {
  "order-placed-customer": orderPlacedCustomer,
  "order-placed-admin": orderPlacedAdmin,
  "shipment-created": shipmentCreated,
  "invite-created": inviteCreated,
  "password-reset": passwordReset,
  "return-requested-admin": returnRequestedAdmin,
  "return-requested-customer": returnRequestedCustomer,
  "order-canceled-customer": orderCanceledCustomer,
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
