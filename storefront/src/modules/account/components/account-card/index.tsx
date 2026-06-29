import { clx } from "@medusajs/ui"
import React from "react"

type AccountCardProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
  className?: string
  padded?: boolean
}

const AccountCard: React.FC<AccountCardProps> = ({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}) => {
  return (
    <section
      className={clx(
        "rounded-3xl bg-white border border-brand-dark/[0.06] shadow-sm",
        padded && "p-6 small:p-8",
        className,
      )}
    >
      {(title || action || description) && (
        <header
          className={clx(
            "flex items-start justify-between gap-4",
            (title || description) && children ? "mb-6" : "",
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="font-serif text-2xl text-brand-dark tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-brand-dark/60">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export default AccountCard
