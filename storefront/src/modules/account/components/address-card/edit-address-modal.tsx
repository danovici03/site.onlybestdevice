"use client"

import React, { useEffect, useState, useActionState } from "react"
import { PencilSquare as Edit, Trash, CheckCircleSolid } from "@medusajs/icons"
import { Heading, clx } from "@medusajs/ui"

import useToggleState from "@lib/hooks/use-toggle-state"
import CountrySelect from "@modules/checkout/components/country-select"
import Input from "@modules/common/components/input"
import Modal from "@modules/common/components/modal"
import Spinner from "@modules/common/icons/spinner"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { HttpTypes } from "@medusajs/types"
import {
  deleteCustomerAddress,
  setDefaultShippingAddress,
  updateCustomerAddress,
} from "@lib/data/customer"
import { account as t } from "@lib/i18n/account.it"

type EditAddressProps = {
  region: HttpTypes.StoreRegion
  address: HttpTypes.StoreCustomerAddress
}

const EditAddress: React.FC<EditAddressProps> = ({ region, address }) => {
  const [removing, setRemoving] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)
  const [successState, setSuccessState] = useState(false)
  const { state, open, close: closeModal } = useToggleState(false)

  const [formState, formAction] = useActionState(updateCustomerAddress, {
    success: false,
    error: null,
    addressId: address.id,
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

  const removeAddress = async () => {
    if (!window.confirm(t.addresses.deleteConfirm)) return
    setRemoving(true)
    await deleteCustomerAddress(address.id)
    setRemoving(false)
  }

  const setAsDefault = async () => {
    setSettingDefault(true)
    await setDefaultShippingAddress(address.id)
    setSettingDefault(false)
  }

  const isDefault = address.is_default_shipping

  return (
    <>
      <div
        className={clx(
          "rounded-3xl border bg-white p-6 min-h-[220px] flex flex-col justify-between transition-colors",
          isDefault
            ? "border-brand-dark"
            : "border-brand-dark/[0.06] hover:border-brand-dark/[0.15]",
        )}
        data-testid="address-container"
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3
              className="font-semibold text-brand-dark"
              data-testid="address-name"
            >
              {address.first_name} {address.last_name}
            </h3>
            {isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-dark text-white px-3 py-1 text-xs font-medium">
                <CheckCircleSolid />
                {t.addresses.defaultBadge}
              </span>
            )}
          </div>

          {address.company && (
            <p
              className="text-sm text-brand-dark/70"
              data-testid="address-company"
            >
              {address.company}
            </p>
          )}
          <div className="text-sm text-brand-dark/80 leading-relaxed mt-1">
            <p data-testid="address-address">
              {address.address_1}
              {address.address_2 ? `, ${address.address_2}` : ""}
            </p>
            <p data-testid="address-postal-city">
              {address.postal_code} {address.city}
              {address.province ? ` (${address.province})` : ""}
            </p>
            <p
              className="uppercase text-xs text-brand-dark/50 mt-1"
              data-testid="address-province-country"
            >
              {address.country_code}
            </p>
            {address.phone && (
              <p className="text-xs text-brand-dark/50 mt-1">{address.phone}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-4 border-t border-brand-dark/[0.06]">
          <div className="flex items-center gap-x-4">
            <button
              className="text-sm text-brand-dark/70 hover:text-brand-dark inline-flex items-center gap-x-1.5"
              onClick={open}
              data-testid="address-edit-button"
            >
              <Edit />
              {t.common.edit}
            </button>
            <button
              className="text-sm text-brand-dark/70 hover:text-red-700 inline-flex items-center gap-x-1.5"
              onClick={removeAddress}
              disabled={removing}
              data-testid="address-delete-button"
            >
              {removing ? <Spinner /> : <Trash />}
              {t.common.delete}
            </button>
          </div>
          {!isDefault && (
            <button
              className="text-xs text-brand-accent hover:underline"
              onClick={setAsDefault}
              disabled={settingDefault}
            >
              {settingDefault ? t.common.saving : t.addresses.setDefault}
            </button>
          )}
        </div>
      </div>

      <Modal isOpen={state} close={close} data-testid="edit-address-modal">
        <Modal.Title>
          <Heading className="mb-2 font-serif text-2xl text-brand-dark">
            {t.addresses.edit}
          </Heading>
        </Modal.Title>
        <form action={formAction}>
          <input type="hidden" name="addressId" value={address.id} />
          <Modal.Body>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 small:grid-cols-2 gap-3">
                <Input
                  label={t.auth.firstName}
                  name="first_name"
                  required
                  autoComplete="given-name"
                  defaultValue={address.first_name || undefined}
                  data-testid="first-name-input"
                />
                <Input
                  label={t.auth.lastName}
                  name="last_name"
                  required
                  autoComplete="family-name"
                  defaultValue={address.last_name || undefined}
                  data-testid="last-name-input"
                />
              </div>
              <Input
                label={`${t.addresses.company} ${t.common.optional}`}
                name="company"
                autoComplete="organization"
                defaultValue={address.company || undefined}
                data-testid="company-input"
              />
              <Input
                label={t.addresses.address1}
                name="address_1"
                required
                autoComplete="address-line1"
                defaultValue={address.address_1 || undefined}
                data-testid="address-1-input"
              />
              <Input
                label={t.addresses.address2}
                name="address_2"
                autoComplete="address-line2"
                defaultValue={address.address_2 || undefined}
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
                  defaultValue={address.postal_code || undefined}
                  data-testid="postal-code-input"
                />
                <Input
                  label={t.addresses.city}
                  name="city"
                  required
                  autoComplete="locality"
                  defaultValue={address.city || undefined}
                  data-testid="city-input"
                />
                <Input
                  label={t.addresses.province}
                  name="province"
                  autoComplete="address-level1"
                  maxLength={2}
                  defaultValue={address.province || undefined}
                  data-testid="state-input"
                />
              </div>
              <CountrySelect
                name="country_code"
                region={region}
                required
                autoComplete="country"
                defaultValue={address.country_code || undefined}
                data-testid="country-select"
              />
              <Input
                label={t.auth.phone}
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={address.phone || undefined}
                data-testid="phone-input"
              />
            </div>
            {formState.error && (
              <p className="text-red-700 text-sm py-2 mt-2">{formState.error}</p>
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

export default EditAddress
