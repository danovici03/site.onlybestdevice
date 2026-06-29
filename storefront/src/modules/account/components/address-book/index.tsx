import React from "react"

import AddAddress from "../address-card/add-address"
import EditAddress from "../address-card/edit-address-modal"
import { HttpTypes } from "@medusajs/types"
import { account as t } from "@lib/i18n/account.it"

type AddressBookProps = {
  customer: HttpTypes.StoreCustomer
  region: HttpTypes.StoreRegion
}

const AddressBook: React.FC<AddressBookProps> = ({ customer, region }) => {
  const { addresses } = customer

  return (
    <div className="w-full">
      {addresses.length === 0 ? (
        <div className="rounded-3xl bg-white border border-brand-dark/[0.06] p-8 text-center">
          <p className="text-sm text-brand-dark/60 mb-6">
            {t.addresses.noAddresses}
          </p>
          <AddAddress region={region} addresses={addresses} variant="primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 small:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <EditAddress region={region} address={address} key={address.id} />
          ))}
          <AddAddress region={region} addresses={addresses} />
        </div>
      )}
    </div>
  )
}

export default AddressBook
