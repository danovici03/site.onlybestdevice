"use client"

import { matchCounty } from "@lib/util/counties"
import CountySelect from "@modules/common/components/county-select"
import Input from "@modules/common/components/input"
import LocalitySelect, {
  type LocalitySuggestion,
} from "@modules/common/components/locality-select"
import { useRef, useState } from "react"

type AddressLocalityFieldsProps = {
  labels: {
    city: string
    province: string
    postalCode: string
    invalidPostalCode: string
  }
  defaultCity?: string | null
  defaultProvince?: string | null
  defaultPostalCode?: string | null
}

/**
 * Trio-ul localitate / județ / cod poștal din formularele de adresă ale
 * contului.
 *
 * Cele trei câmpuri au ajuns împreună într-o componentă fiindcă alegerea
 * localității le completează pe celelalte două — lucru imposibil cât timp erau
 * `<input>`-uri necontrolate într-un `form action`. Formularul rămâne totuși
 * unul clasic: fiecare câmp își trimite valoarea prin `name`, deci acțiunea de
 * server n-a trebuit schimbată.
 */
const AddressLocalityFields = ({
  labels,
  defaultCity,
  defaultProvince,
  defaultPostalCode,
}: AddressLocalityFieldsProps) => {
  const [city, setCity] = useState(defaultCity ?? "")
  // Adresa salvată poate avea „BN" sau text fără diacritice.
  const [province, setProvince] = useState(matchCounty(defaultProvince) ?? "")
  const [postalCode, setPostalCode] = useState(defaultPostalCode ?? "")

  // Codul pus de noi poate fi înlocuit la următoarea alegere de localitate;
  // cel scris de client, nu.
  const postalAuto = useRef(false)

  const applyLocality = (locality: LocalitySuggestion) => {
    setCity(locality.name)
    setProvince(locality.county)
    if (locality.postalCode && (!postalCode || postalAuto.current)) {
      setPostalCode(locality.postalCode)
      postalAuto.current = true
    }
  }

  return (
    <>
      {/* Județul are rând propriu: numele complete („Bistrița-Năsăud") nu
          încap în coloana de 120px de dinainte. */}
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Input
          label={labels.postalCode}
          name="postal_code"
          required
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="\d{6}"
          title={labels.invalidPostalCode}
          value={postalCode}
          onChange={(e) => {
            setPostalCode(e.target.value)
            postalAuto.current = false
          }}
          data-testid="postal-code-input"
        />
        <LocalitySelect
          label={labels.city}
          name="city"
          required
          value={city}
          county={province}
          onChange={setCity}
          onSelect={applyLocality}
          data-testid="city-input"
        />
      </div>
      <CountySelect
        label={labels.province}
        name="province"
        required
        value={province}
        onChange={setProvince}
        data-testid="state-input"
      />
    </>
  )
}

export default AddressLocalityFields
