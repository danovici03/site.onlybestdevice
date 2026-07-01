import { Metadata } from "next"

import ForgotPasswordForm from "@modules/account/components/forgot-password"

export const metadata: Metadata = {
  title: "Ai uitat parola",
  description: "Recuperează accesul la contul tău onlybestdevice.",
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
