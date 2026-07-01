import { Metadata } from "next"

import ResetPasswordForm from "@modules/account/components/reset-password"

export const metadata: Metadata = {
  title: "Resetează parola",
  description: "Setează o parolă nouă pentru contul tău onlybestdevice.",
}

type SearchParams = Promise<{ token?: string; email?: string }>

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { token = "", email = "" } = await searchParams
  return <ResetPasswordForm token={token} email={email} />
}
