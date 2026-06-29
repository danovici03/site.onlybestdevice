import { redirect } from "next/navigation"

export default async function ForgotPasswordDashboard({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  // User is already authenticated — send them to the in-app password change.
  const { countryCode } = await params
  redirect(`/${countryCode}/account/profile`)
}
