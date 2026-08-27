/** Ce are nevoie browserul ca să deschidă pagina de plată Netopia. */
export type NetopiaHandoffFields =
  | { redirect_url: string }
  | { payment_url: string; env_key: string; data: string }

/** Rezultatul deschiderii unei sesiuni: câmpurile de plată sau motivul refuzului. */
export type NetopiaSessionResult =
  | { fields: NetopiaHandoffFields }
  | { error: string }

/**
 * Form POST către mobilPay (Netopia API v1).
 *
 * v1 nu are link vizitabil: pagina de plată se deschide doar trimițând
 * `env_key` + `data` (payload-ul criptat) prin POST. De aceea un `<a href>`
 * sau un `window.location` către `payment_url` nu poate funcționa — de aici și
 * butonul „Reia plata" care ducea în gol.
 *
 * Folosit din două locuri: finalizarea comenzii din checkout și pagina de
 * handoff `/order/:id/pay` (reluarea plății).
 */
export const submitNetopiaForm = (
  url: string,
  envKey: string,
  data: string
) => {
  const form = document.createElement("form")
  form.method = "POST"
  form.action = url
  const add = (name: string, value: string) => {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  add("env_key", envKey)
  add("data", data)
  document.body.appendChild(form)
  form.submit()
}
