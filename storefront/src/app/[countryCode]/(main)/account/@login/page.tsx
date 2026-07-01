import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Autentificare",
  description: "Autentifică-te în contul tău onlybestdevice.",
}

export default function Login() {
  return <LoginTemplate />
}
