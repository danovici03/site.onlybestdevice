import { Metadata } from "next"

import ResetPasswordForm from "@modules/account/components/reset-password"

export const metadata: Metadata = {
  title: "Reimposta password",
}

type SearchParams = Promise<{ token?: string; email?: string }>

// If a logged-in user clicked a reset link from email (e.g. session predates
// the request), still let them complete the reset — the token validates the
// identity. After success the form refreshes the auth cookie.
export default async function ResetPasswordDashboard({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { token = "", email = "" } = await searchParams
  return <ResetPasswordForm token={token} email={email} />
}
