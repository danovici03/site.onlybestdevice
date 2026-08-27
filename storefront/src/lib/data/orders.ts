"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import type { NetopiaSessionResult } from "@lib/util/netopia-form"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { HttpTypes } from "@medusajs/types"

/**
 * Comanda pentru pagina de handoff spre plată.
 *
 * `retrieveOrder` nu merge aici din două motive: cere o listă fixă de câmpuri
 * din care lipsește `metadata` — exact acolo stă URL-ul Netopia — iar în
 * Medusa un `fields` fără `+` înlocuiește selecția implicită, nu o completează.
 * Și răspunde din cache, deși noi citim o comandă creată acum o secundă.
 */
export const retrieveOrderForPayment = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: { fields: "+metadata" },
      headers,
      cache: "no-store",
    })
    .then(({ order }) => order)
    .catch(() => null)
}

/**
 * Deschide o sesiune de plată NOUĂ pentru o comandă deja plasată.
 *
 * E o SERVER ACTION, chemată din pagina de handoff la montarea componentei —
 * deliberat nu din randarea paginii. `/order/:id/pay` e o rută publică, iar
 * deschiderea unei sesiuni schimbă starea comenzii (contorul de încercări,
 * resetarea codului de eroare) și consumă o sesiune la Netopia. Ca efect
 * secundar al unui GET, orice reîmprospătare, navigare înapoi sau re-randare
 * RSC ar fi făcut asta din nou.
 *
 * Nu refolosim linkul salvat în `metadata.netopia.payment_url`: pe v2 e de
 * unică folosință, deja consumat de încercarea care a picat, iar pe v1 nici
 * măcar nu e un URL vizitabil — plata cere form POST cu `env_key` + `data`,
 * generate criptat la fiecare sesiune.
 *
 * Ruta din backend refuză comenzile plătite, anulate sau cu plata la livrare,
 * deci mesajul de eroare e util clientului, nu doar logului.
 */
export const createNetopiaPaymentSession = async (
  orderId: string
): Promise<NetopiaSessionResult> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    const resp = await sdk.client.fetch<{
      redirect_url?: string
      payment_url?: string
      env_key?: string
      data?: string
    }>(`/store/netopia/session`, {
      method: "POST",
      body: { order_id: orderId },
      headers,
      cache: "no-store",
    })

    if (resp?.redirect_url) {
      return { fields: { redirect_url: resp.redirect_url } }
    }
    if (resp?.payment_url && resp?.env_key && resp?.data) {
      return {
        fields: {
          payment_url: resp.payment_url,
          env_key: resp.env_key,
          data: resp.data,
        },
      }
    }
    return { error: "Pagina de plată nu a putut fi pregătită." }
  } catch (e: any) {
    console.error("[netopia] Nu am putut deschide sesiunea de plată:", e)
    return {
      error:
        e?.message || "Pagina de plată nu a putut fi pregătită.",
    }
  }
}

export const retrieveOrder = async (id: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "+metadata,*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
}

export const listOrders = async (
  limit: number = 10,
  offset: number = 0,
  filters?: Record<string, any>
) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("orders")),
  }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "+metadata,*items,+items.metadata,*items.variant,*items.product",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
}

// Same as listOrders but returns the full paginated envelope (orders, count,
// offset, limit) so the orders list page can render page controls.
export const listOrdersPaginated = async (
  limit: number = 12,
  offset: number = 0,
  filters?: Record<string, any>,
) => {
  const headers = { ...(await getAuthHeaders()) }
  const next = { ...(await getCacheOptions("orders")) }

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
      method: "GET",
      query: {
        limit,
        offset,
        order: "-created_at",
        fields: "+metadata,*items,+items.metadata,*items.variant,*items.product",
        ...filters,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .catch((err) => medusaError(err))
}

export const createTransferRequest = async (
  state: {
    success: boolean
    error: string | null
    order: HttpTypes.StoreOrder | null
  },
  formData: FormData
): Promise<{
  success: boolean
  error: string | null
  order: HttpTypes.StoreOrder | null
}> => {
  const id = formData.get("order_id") as string

  if (!id) {
    return { success: false, error: "Order ID is required", order: null }
  }

  const headers = await getAuthHeaders()

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: "id, email",
      },
      headers
    )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders()

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }))
}
