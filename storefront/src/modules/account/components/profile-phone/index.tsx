"use client"

import React, { useEffect, useActionState } from "react"

import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { updateCustomer } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfilePhone: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  const updateCustomerPhone = async (
    _currentState: Record<string, unknown>,
    formData: FormData,
  ) => {
    try {
      await updateCustomer({
        phone: (formData.get("phone") as string) || undefined,
      })
      return { success: true, error: null }
    } catch (error: any) {
      return { success: false, error: error.toString() }
    }
  }

  const [state, formAction] = useActionState(updateCustomerPhone, {
    error: null as string | null,
    success: false,
  })

  const clearState = () => setSuccessState(false)

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  return (
    <form action={formAction} className="w-full">
      <AccountInfo
        label={t.profile.phoneLabel}
        currentInfo={customer.phone || "—"}
        isSuccess={successState}
        isError={!!state?.error}
        clearState={clearState}
        data-testid="account-phone-editor"
      >
        <Input
          label={t.auth.phone}
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={customer.phone ?? ""}
          data-testid="phone-input"
        />
      </AccountInfo>
    </form>
  )
}

export default ProfilePhone
