import { clx } from "@medusajs/ui"
import { account as t } from "@lib/i18n/account.it"

export type StatusTone = "success" | "info" | "warning" | "neutral" | "danger"

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-100",
  info: "bg-brand-dark/[0.06] text-brand-dark border-brand-dark/[0.08]",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
  neutral: "bg-brand-dark/[0.04] text-brand-dark/60 border-brand-dark/[0.06]",
  danger: "bg-red-50 text-red-700 border-red-100",
}

type StatusBadgeProps = {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone,
  children,
  className,
}) => (
  <span
    className={clx(
      "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap",
      TONE_CLASSES[tone],
      className,
    )}
  >
    {children}
  </span>
)

// Map Medusa order status → tone + Italian label.
// We collapse the order-level and fulfillment-level statuses into one
// "what's happening" view for the customer: prefer fulfillment progress
// over the order workflow state.
const ORDER_TONE: Record<string, StatusTone> = {
  pending: "info",
  completed: "success",
  archived: "neutral",
  canceled: "danger",
  requires_action: "warning",
}

const FULFILLMENT_TONE: Record<string, StatusTone> = {
  not_fulfilled: "info",
  partially_fulfilled: "info",
  fulfilled: "info",
  partially_shipped: "warning",
  shipped: "warning",
  delivered: "success",
  canceled: "danger",
  returned: "neutral",
}

export const OrderStatusBadge = ({ order }: { order: { status: string; fulfillment_status?: string } }) => {
  // If we have a fulfillment status that's beyond "not_fulfilled", show it —
  // that's what the customer actually cares about ("Spedito", "Consegnato").
  // Otherwise fall back to the order workflow status.
  const fs = order.fulfillment_status
  if (fs && fs !== "not_fulfilled" && FULFILLMENT_TONE[fs]) {
    const label =
      t.orders.fulfillmentStatus[
        fs as keyof typeof t.orders.fulfillmentStatus
      ] ?? fs
    return <StatusBadge tone={FULFILLMENT_TONE[fs]}>{label}</StatusBadge>
  }

  const label =
    t.orders.status[order.status as keyof typeof t.orders.status] ?? order.status
  return (
    <StatusBadge tone={ORDER_TONE[order.status] ?? "info"}>{label}</StatusBadge>
  )
}

export default StatusBadge
