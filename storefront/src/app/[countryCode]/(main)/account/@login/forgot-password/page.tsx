import { Metadata } from "next"

import ForgotPasswordForm from "@modules/account/components/forgot-password"

export const metadata: Metadata = {
  title: "Password dimenticata",
  description: "Recupera l'accesso al tuo account Arredovita.",
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
