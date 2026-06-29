"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    const headers = {
      ...authHeaders,
    }

    const next = {
      ...(await getCacheOptions("customers")),
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  }

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const marketingOptIn = formData.get("marketing_opt_in") === "on"
  const customerForm: HttpTypes.StoreCreateCustomer = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: (formData.get("phone") as string) || undefined,
    metadata: {
      preferences: {
        marketing: marketingOptIn,
        consent_at: new Date().toISOString(),
      },
    },
  }

  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password: password,
    })

    await setAuthToken(token as string)

    const headers = {
      ...(await getAuthHeaders()),
    }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      customerForm,
      {},
      headers
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    await setAuthToken(loginToken as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    await transferCart()

    return createdCustomer
  } catch (error: any) {
    return error.toString()
  }
}

// Triggers Medusa's reset-password workflow which emits `auth.password_reset`.
// Always succeeds at the API level — Medusa intentionally doesn't reveal
// whether the email is registered, so we mirror that with a generic UI message.
export async function requestPasswordReset(
  _currentState: unknown,
  formData: FormData,
) {
  const email = formData.get("email") as string
  if (!email) return { ok: false, message: "Email obbligatoria" }

  try {
    await sdk.client.fetch("/auth/customer/emailpass/reset-password", {
      method: "POST",
      body: { identifier: email },
    })
  } catch {
    // swallow — never reveal whether the email exists
  }
  return { ok: true, message: null as string | null }
}

// Updates customer.metadata.preferences while preserving any other metadata
// already on the customer (e.g. the consent_at timestamp set at signup).
export async function updatePreferences(
  _currentState: unknown,
  formData: FormData,
) {
  const marketing = formData.get("marketing") === "on"
  const sms = formData.get("sms") === "on"

  const customer = await retrieveCustomer().catch(() => null)
  const existingMeta = (customer?.metadata ?? {}) as Record<string, unknown>
  const existingPrefs =
    (existingMeta.preferences as Record<string, unknown> | undefined) ?? {}

  try {
    await updateCustomer({
      metadata: {
        ...existingMeta,
        preferences: {
          ...existingPrefs,
          marketing,
          sms,
          updated_at: new Date().toISOString(),
        },
      },
    })
    return { ok: true, message: null as string | null }
  } catch (e: any) {
    return { ok: false, message: e?.toString?.() ?? "error" }
  }
}

// Used by the public reset-password page reached from the email link.
// The token from the email is used as the Authorization bearer for the update call.
export async function resetPassword(
  _currentState: unknown,
  formData: FormData,
) {
  const token = formData.get("token") as string
  const password = formData.get("password") as string
  const confirm = formData.get("confirm_password") as string

  if (!token) return { ok: false, message: "reset_invalid_token" }
  if (!password || password.length < 8)
    return { ok: false, message: "reset_password_short" }
  if (password !== confirm)
    return { ok: false, message: "reset_password_mismatch" }

  try {
    await sdk.client.fetch("/auth/customer/emailpass/update", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: { password },
    })
    return { ok: true, message: null as string | null }
  } catch (e: any) {
    return { ok: false, message: "reset_invalid_token" }
  }
}

// Used by the logged-in profile page. Re-verifies the old password via a
// login attempt first so we don't allow stealth password changes if a session
// is hijacked.
export async function updatePassword(
  _currentState: unknown,
  formData: FormData,
) {
  const oldPassword = formData.get("old_password") as string
  const newPassword = formData.get("new_password") as string
  const confirm = formData.get("confirm_password") as string

  if (!oldPassword || !newPassword)
    return { ok: false, message: "password_required" }
  if (newPassword.length < 8)
    return { ok: false, message: "password_too_short" }
  if (newPassword !== confirm)
    return { ok: false, message: "password_mismatch" }

  const customer = await retrieveCustomer().catch(() => null)
  if (!customer?.email) return { ok: false, message: "password_unauthenticated" }

  // Verify the old password by attempting a login.
  let verifyToken: string | undefined
  try {
    verifyToken = (await sdk.auth.login("customer", "emailpass", {
      email: customer.email,
      password: oldPassword,
    })) as string
  } catch {
    return { ok: false, message: "password_old_invalid" }
  }
  if (!verifyToken)
    return { ok: false, message: "password_old_invalid" }

  try {
    await sdk.client.fetch("/auth/customer/emailpass/update", {
      method: "POST",
      headers: { authorization: `Bearer ${verifyToken}` },
      body: { password: newPassword },
    })

    // Re-issue the session cookie with a fresh login on the new password.
    const sessionToken = (await sdk.auth.login("customer", "emailpass", {
      email: customer.email,
      password: newPassword,
    })) as string
    await setAuthToken(sessionToken)
    return { ok: true, message: null as string | null }
  } catch {
    return { ok: false, message: "password_update_failed" }
  }
}

export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(token as string)
        const customerCacheTag = await getCacheTag("customers")
        revalidateTag(customerCacheTag)
      })
  } catch (error: any) {
    return error.toString()
  }

  try {
    await transferCart()
  } catch (error: any) {
    return error.toString()
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async ({ customer }) => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const setDefaultShippingAddress = async (
  addressId: string,
): Promise<{ success: boolean; error: string | null }> => {
  const headers = { ...(await getAuthHeaders()) }
  return sdk.store.customer
    .updateAddress(addressId, { is_default_shipping: true }, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => ({ success: false, error: err.toString() }))
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}
