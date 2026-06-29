"use client"

import { Plus } from "@medusajs/icons"
import { Heading } from "@medusajs/ui"
import { useEffect, useState, useActionState } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { HttpTypes } from "@medusajs/types"
import { addCustomerAddress } from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

type AddAddressProps = {
  region: HttpTypes.StoreRegion
  addresses: HttpTypes.StoreCustomerAddress[]
  variant?: "card" | "primary"
}

const AddAddress = ({ region, addresses, variant = "card" }: AddAddressProps) => {
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)

  const [formState, formAction] = useActionState(addCustomerAddress, {
    isDefaultShipping: addresses.length === 0,
    success: false,
    error: null,
  })

  const close = () => {
    setSuccessState(false)
    closeModal()
  }

  useEffect(() => {
    if (successState) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [successState])

  useEffect(() => {
    if (formState.success) setSuccessState(true)
  }, [formState])

  return (
    <>
      {variant === "primary" ? (
        <button
          onClick={open}
          className="inline-flex items-center justify-center rounded-full bg-brand-dark text-white px-6 py-3 text-sm font-semibold hover:bg-brand-accent transition-colors"
          data-testid="add-address-button"
        >
          <Plus className="mr-2" />
          {t.addresses.addNew}
        </button>
      ) : (
        <button
          className="rounded-3xl border-2 border-dashed border-brand-dark/[0.15] hover:border-brand-accent hover:bg-brand-accent/[0.03] p-6 min-h-[220px] w-full flex flex-col items-center justify-center gap-3 transition-colors group"
          onClick={open}
          data-testid="add-address-button"
        >
          <span className="rounded-full bg-brand-dark/[0.05] group-hover:bg-brand-accent/10 p-3 transition-colors">
            <Plus className="text-brand-dark/60 group-hover:text-brand-accent" />
          </span>
          <span className="text-sm font-medium text-brand-dark/70 group-hover:text-brand-dark">
            {t.addresses.addNew}
          </span>
        </button>
      )}

      <Modal isOpen={state} close={close} data-testid="add-address-modal">
        <Modal.Title>
          <Heading className="mb-2 font-serif text-2xl text-brand-dark">
            {t.addresses.addNew}
          </Heading>
        </Modal.Title>
        <form action={formAction}>
          <Modal.Body>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 small:grid-cols-2 gap-3">
                <Input
                  label={t.auth.firstName}
                  name="first_name"
                  required
                  autoComplete="given-name"
                  data-testid="first-name-input"
                />
                <Input
                  label={t.auth.lastName}
                  name="last_name"
                  required
                  autoComplete="family-name"
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label={`${t.addresses.company} ${t.common.optional}`}
                name="company"
                autoComplete="organization"
                data-testid="company-input"
              />
              <Input
                label={t.addresses.address1}
                name="address_1"
                required
                autoComplete="address-line1"
                data-testid="address-1-input"
              />
              <Input
                label={t.addresses.address2}
                name="address_2"
                autoComplete="address-line2"
                data-testid="address-2-input"
              />
              <div className="grid grid-cols-[120px_1fr_100px] gap-3">
                <Input
                  label={t.addresses.postalCode}
                  name="postal_code"
                  required
                  autoComplete="postal-code"
                  pattern="\d{5}"
                  title={t.addresses.invalidCap}
                  data-testid="postal-code-input"
                />
                <Input
                  label={t.addresses.city}
                  name="city"
                  required
                  autoComplete="locality"
                  data-testid="city-input"
                />
                <Input
                  label={t.addresses.province}
                  name="province"
                  autoComplete="address-level1"
                  maxLength={2}
                  data-testid="state-input"
                />
              </div>
              <CountrySelect
                region={region}
                name="country_code"
                required
                autoComplete="country"
                data-testid="country-select"
              />
              <Input
                label={t.auth.phone}
                name="phone"
                type="tel"
                autoComplete="tel"
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <p
                className="text-red-700 text-sm py-2 mt-2"
                data-testid="address-error"
              >
                {formState.error}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                type="reset"
                onClick={close}
                className="rounded-full border border-brand-dark/[0.15] px-5 py-2 text-sm font-medium text-brand-dark/70 hover:bg-brand-dark/[0.05]"
                data-testid="cancel-button"
              >
                {t.common.cancel}
              </button>
              <SubmitButton data-testid="save-button">
                {t.common.save}
              </SubmitButton>
            </div>
          </Modal.Footer>
        </form>
      </Modal>
    </>
  )
}

export default AddAddress
