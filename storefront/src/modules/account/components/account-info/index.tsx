import { Disclosure } from "@headlessui/react"
import { clx } from "@medusajs/ui"
import { useEffect } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import { useFormStatus } from "react-dom"
import { account as t } from "@lib/i18n/account.it"

type AccountInfoProps = {
  label: string
  currentInfo: string | React.ReactNode
  isSuccess?: boolean
  isError?: boolean
  errorMessage?: string
  clearState: () => void
  children?: React.ReactNode
  'data-testid'?: string
  readOnly?: boolean
}

const AccountInfo = ({
  label,
  currentInfo,
  isSuccess,
  isError,
  clearState,
  errorMessage,
  children,
  'data-testid': dataTestid,
  readOnly,
}: AccountInfoProps) => {
  const { state, close, toggle } = useToggleState()
  const { pending } = useFormStatus()

  const handleToggle = () => {
    clearState()
    setTimeout(() => toggle(), 100)
  }

  useEffect(() => {
    if (isSuccess) close()
  }, [isSuccess, close])

  return (
    <div data-testid={dataTestid}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-brand-dark/50 mb-1">
            {label}
          </p>
          <div className="text-sm text-brand-dark" data-testid="current-info">
            {currentInfo}
          </div>
        </div>
        {!readOnly && (
          <button
            type={state ? "reset" : "button"}
            onClick={handleToggle}
            className="shrink-0 text-sm text-brand-accent hover:underline"
            data-testid="edit-button"
            data-active={state}
          >
            {state ? t.common.cancel : t.common.edit}
          </button>
        )}
      </div>

      {/* Success */}
      <Disclosure>
        <Disclosure.Panel
          static
          className={clx(
            "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
            isSuccess ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0",
          )}
          data-testid="success-message"
        >
          <p className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
            {label} — {t.common.saved}
          </p>
        </Disclosure.Panel>
      </Disclosure>

      {/* Error */}
      <Disclosure>
        <Disclosure.Panel
          static
          className={clx(
            "transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden",
            isError ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0",
          )}
          data-testid="error-message"
        >
          <p className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-800">
            {errorMessage || t.common.error}
          </p>
        </Disclosure.Panel>
      </Disclosure>

      {/* Edit panel */}
      <Disclosure>
        <Disclosure.Panel
          static
          className={clx(
            "transition-[max-height,opacity] duration-300 ease-in-out overflow-visible",
            state ? "max-h-[1000px] opacity-100 pt-4" : "max-h-0 opacity-0",
          )}
        >
          <div className="flex flex-col gap-y-3">
            {children}
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-5 py-2 text-sm font-semibold hover:bg-brand-accent transition-colors disabled:opacity-60 disabled:pointer-events-none"
                data-testid="save-button"
              >
                {pending ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        </Disclosure.Panel>
      </Disclosure>
    </div>
  )
}

export default AccountInfo
