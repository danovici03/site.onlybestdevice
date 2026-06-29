"use client"

import React, { useEffect, useMemo, useActionState } from "react"

import Input from "@modules/common/components/input"
import NativeSelect from "@modules/common/components/native-select"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { addCustomerAddress, updateCustomerAddress } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
  regions: HttpTypes.StoreRegion[]
}

const ProfileBillingAddress: React.FC<MyInformationProps> = ({
  customer,
  regions,
}) => {
  const regionOptions = useMemo(
    () =>
      regions
        ?.map((region) =>
          region.countries?.map((country) => ({
            value: country.iso_2,
            label: country.display_name,
          })),
        )
        .flat() || [],
    [regions],
  )

  const [successState, setSuccessState] = React.useState(false)

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing,
  )

  const initialState: Record<string, any> = {
    isDefaultBilling: true,
    isDefaultShipping: false,
    error: false,
    success: false,
  }
  if (billingAddress) initialState.addressId = billingAddress.id

  const [state, formAction] = useActionState(
    billingAddress ? updateCustomerAddress : addCustomerAddress,
    initialState,
  )

  const clearState = () => setSuccessState(false)

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  const currentInfo = useMemo(() => {
    if (!billingAddress) {
      return <span className="text-brand-dark/60">—</span>
    }
    const country =
      regionOptions?.find((c) => c?.value === billingAddress.country_code)
        ?.label || billingAddress.country_code?.toUpperCase()

    return (
      <div className="leading-relaxed" data-testid="current-info">
        <div>
          {billingAddress.first_name} {billingAddress.last_name}
        </div>
        {billingAddress.company && <div>{billingAddress.company}</div>}
        <div>
          {billingAddress.address_1}
          {billingAddress.address_2 ? `, ${billingAddress.address_2}` : ""}
        </div>
        <div>
          {billingAddress.postal_code} {billingAddress.city}
          {billingAddress.province ? ` (${billingAddress.province})` : ""}
        </div>
        <div className="uppercase text-xs text-brand-dark/50">{country}</div>
      </div>
    )
  }, [billingAddress, regionOptions])

  return (
    <form action={formAction} onReset={clearState} className="w-full">
      <input type="hidden" name="addressId" value={billingAddress?.id} />
      <AccountInfo
        label={t.profile.billingLabel}
        currentInfo={currentInfo}
        isSuccess={successState}
        isError={!!state.error}
        clearState={clearState}
        data-testid="account-billing-address-editor"
      >
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-1 small:grid-cols-2 gap-3">
            <Input
              label={t.auth.firstName}
              name="first_name"
              defaultValue={billingAddress?.first_name || undefined}
              required
              data-testid="billing-first-name-input"
            />
            <Input
              label={t.auth.lastName}
              name="last_name"
              defaultValue={billingAddress?.last_name || undefined}
              required
              data-testid="billing-last-name-input"
            />
          </div>
          <Input
            label={`${t.addresses.company} ${t.common.optional}`}
            name="company"
            defaultValue={billingAddress?.company || undefined}
            data-testid="billing-company-input"
          />
          <Input
            label={t.auth.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            defaultValue={billingAddress?.phone ?? customer?.phone ?? ""}
            data-testid="billing-phone-input"
          />
          <Input
            label={t.addresses.address1}
            name="address_1"
            defaultValue={billingAddress?.address_1 || undefined}
            required
            data-testid="billing-address-1-input"
          />
          <Input
            label={t.addresses.address2}
            name="address_2"
            defaultValue={billingAddress?.address_2 || undefined}
            data-testid="billing-address-2-input"
          />
          <div className="grid grid-cols-[120px_1fr_100px] gap-3">
            <Input
              label={t.addresses.postalCode}
              name="postal_code"
              defaultValue={billingAddress?.postal_code || undefined}
              required
              pattern="\d{5}"
              title="CAP a 5 cifre"
              data-testid="billing-postal-code-input"
            />
            <Input
              label={t.addresses.city}
              name="city"
              defaultValue={billingAddress?.city || undefined}
              required
              data-testid="billing-city-input"
            />
            <Input
              label={t.addresses.province}
              name="province"
              defaultValue={billingAddress?.province || undefined}
              maxLength={2}
              data-testid="billing-province-input"
            />
          </div>
          <NativeSelect
            name="country_code"
            defaultValue={billingAddress?.country_code || undefined}
            required
            data-testid="billing-country-code-select"
          >
            <option value="">{t.addresses.country}</option>
            {regionOptions.map((option, i) => (
              <option key={i} value={option?.value}>
                {option?.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileBillingAddress
