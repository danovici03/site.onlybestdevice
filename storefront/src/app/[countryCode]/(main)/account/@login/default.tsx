import LoginTemplate from "@modules/account/templates/login-template"

/**
 * Fallback-ul slotului @login pentru orice sub-rută /account/* accesată
 * fără autentificare (ex. /account/orders de pe pagina de confirmare).
 * Fără el, Next randează `null` → pagină goală.
 */
export default function Default() {
  return <LoginTemplate />
}
