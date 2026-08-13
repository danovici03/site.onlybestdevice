import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Heading, Text } from "@medusajs/ui"
import { useLayoutEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import ObdLogo from "../components/obd-logo"

/**
 * Antetul paginii de autentificare, cu marca Only Best Device în locul celei
 * Medusa.
 *
 * Medusa nu expune niciun punct de extensie pentru avatarul și titlul de
 * deasupra formularului: le desenează direct în `routes/login/login.tsx`,
 * înaintea zonei de widgeturi. Singurul cârlig e `login.before`, care se
 * randează *sub* ele — așa că widgetul își caută frații de deasupra în DOM,
 * îi ascunde, și desenează el antetul.
 *
 * Se umblă pe poziții, nu pe clase Tailwind (care se schimbă la orice redesign
 * al dashboardului): tot ce e înaintea containerului care ne conține pe noi e
 * antetul implicit. Dacă Medusa mută cândva zona, în cel mai rău caz reapare
 * avatarul lor deasupra — formularul de login rămâne funcțional.
 *
 * Textele vin din `t("login.*")`, suprascrise în `src/admin/i18n`, ca să rămână
 * traduse dacă cineva schimbă limba admin-ului din profil.
 */
const LoginBrandingWidget = () => {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = ref.current?.parentElement?.parentElement

    if (!container) {
      return
    }

    const hidden: HTMLElement[] = []

    for (const sibling of Array.from(container.children)) {
      if (sibling.contains(ref.current)) {
        break
      }

      const el = sibling as HTMLElement
      el.style.display = "none"
      hidden.push(el)
    }

    return () => {
      hidden.forEach((el) => {
        el.style.display = ""
      })
    }
  }, [])

  return (
    <div ref={ref} className="mb-2 flex flex-col items-center gap-y-5">
      <ObdLogo className="text-ui-fg-base w-[220px]" />
      <div className="flex flex-col items-center gap-y-1">
        <Heading>{t("login.title")}</Heading>
        <Text size="small" className="text-ui-fg-subtle text-center">
          {t("login.hint")}
        </Text>
      </div>
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default LoginBrandingWidget
