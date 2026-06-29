import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export default async function resetAdminPassword({
  container,
  args,
}: ExecArgs) {
  const [email, password] = args

  if (!email || !password) {
    throw new Error(
      "Usage: yarn medusa exec ./src/scripts/reset-admin-password.ts <email> <password>"
    )
  }

  const authModule = container.resolve(Modules.AUTH)

  const result = await authModule.updateProvider("emailpass", {
    entity_id: email,
    password,
  })

  if (!("success" in result) || !result.success) {
    throw new Error(
      `Failed to update password for ${email}: ${JSON.stringify(result)}`
    )
  }

  console.log(`Password updated for ${email}`)
}
