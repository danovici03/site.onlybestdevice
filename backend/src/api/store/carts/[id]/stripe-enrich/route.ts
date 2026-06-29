import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Stripe from "stripe"

// Updates the active Stripe PaymentIntent for a cart with shipping address and
// receipt email so that Stripe can evaluate eligibility for country-restricted
// payment methods (Klarna, Afterpay, etc.). Without this, the PaymentIntent is
// created with no buyer context and Stripe filters out those methods even when
// they are enabled in the dashboard.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.params.id
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "shipping_address.*",
      "payment_collection.id",
      "payment_collection.payment_sessions.id",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.status",
      "payment_collection.payment_sessions.data",
    ],
    filters: { id: cartId },
  })

  const cart = carts?.[0]
  if (!cart) {
    return res.status(404).json({ updated: false, reason: "cart_not_found" })
  }

  if (!cart.shipping_address) {
    return res.json({ updated: false, reason: "no_shipping_address" })
  }

  const sessions = cart.payment_collection?.payment_sessions ?? []
  const stripeSession = sessions.find(
    (s): s is NonNullable<typeof s> =>
      !!s &&
      typeof s.provider_id === "string" &&
      (s.provider_id === "pp_stripe_stripe" ||
        s.provider_id.startsWith("pp_stripe"))
  )

  if (!stripeSession) {
    return res.json({ updated: false, reason: "no_stripe_session" })
  }

  const paymentIntentId =
    typeof stripeSession.data?.id === "string"
      ? stripeSession.data.id
      : undefined

  if (!paymentIntentId) {
    return res.json({ updated: false, reason: "no_payment_intent_id" })
  }

  const apiKey = process.env.STRIPE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ updated: false, reason: "no_stripe_key" })
  }

  const addr = cart.shipping_address
  const name =
    [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim() ||
    "Customer"

  const stripe = new Stripe(apiKey)

  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      shipping: {
        name,
        phone: addr.phone || undefined,
        address: {
          line1: addr.address_1 || "",
          line2: addr.address_2 || undefined,
          city: addr.city || "",
          postal_code: addr.postal_code || "",
          country: (addr.country_code || "it").toUpperCase(),
          state: addr.province || undefined,
        },
      },
      receipt_email: cart.email || undefined,
    })

    return res.json({ updated: true, paymentIntentId })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    logger.warn(
      `stripe-enrich: failed to update PaymentIntent ${paymentIntentId}: ${message}`
    )
    return res
      .status(500)
      .json({ updated: false, reason: "stripe_update_failed", message })
  }
}
