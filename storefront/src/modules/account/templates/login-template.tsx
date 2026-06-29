"use client"

import { useState } from "react"
import { clx } from "@medusajs/ui"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import { account as t } from "@lib/i18n/account.it"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
}

const LoginTemplate = () => {
  const [view, setView] = useState<LOGIN_VIEW>(LOGIN_VIEW.SIGN_IN)

  return (
    <div
      className="w-full max-w-md mx-auto rounded-3xl bg-white border border-brand-dark/[0.06] p-6 small:p-10"
      data-testid="login-template"
    >
      <div
        className="relative grid grid-cols-2 rounded-full bg-brand-dark/[0.05] p-1 mb-8"
        role="tablist"
      >
        <button
          role="tab"
          aria-selected={view === LOGIN_VIEW.SIGN_IN}
          onClick={() => setView(LOGIN_VIEW.SIGN_IN)}
          className={clx(
            "rounded-full py-2 text-sm font-medium transition-colors",
            view === LOGIN_VIEW.SIGN_IN
              ? "bg-brand-dark text-white"
              : "text-brand-dark/60 hover:text-brand-dark",
          )}
        >
          {t.auth.signIn}
        </button>
        <button
          role="tab"
          aria-selected={view === LOGIN_VIEW.REGISTER}
          onClick={() => setView(LOGIN_VIEW.REGISTER)}
          className={clx(
            "rounded-full py-2 text-sm font-medium transition-colors",
            view === LOGIN_VIEW.REGISTER
              ? "bg-brand-dark text-white"
              : "text-brand-dark/60 hover:text-brand-dark",
          )}
          data-testid="register-tab"
        >
          {t.auth.signUp}
        </button>
      </div>

      {view === LOGIN_VIEW.SIGN_IN ? (
        <Login setCurrentView={setView} />
      ) : (
        <Register setCurrentView={setView} />
      )}
    </div>
  )
}

export default LoginTemplate
