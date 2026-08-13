/**
 * Suprascrieri de texte pentru dashboard-ul Medusa.
 *
 * Dashboard-ul face `deepMerge(traduceriProprii, aceste resurse)`
 * (`@medusajs/dashboard` → `dashboard-app.populateI18n`), deci orice cheie
 * definită aici o înlocuiește pe cea din pachet. Se folosește ca să scoatem
 * marca Medusa din ecranele pe care le vede clientul: autentificare și invitație.
 *
 * Cheile trebuie să existe și în engleză, și în română — admin-ul pornește pe
 * `en`, iar limba se poate schimba din profilul fiecărui utilizator. Restul
 * limbilor rămân cu textele Medusa; pe login logo-ul e oricum al nostru
 * (`widgets/login-branding.tsx`).
 *
 * Scrise direct în TypeScript, nu în `i18n/json/*.json`: fișierele din `src/`
 * intră și în compilarea serverului (`module: Node16`), unde importurile de
 * JSON cu `with { type: "json" }` din README nu sunt acceptate.
 */
const login = {
  en: {
    title: "Welcome to Only Best Device",
    hint: "Sign in to manage the store",
  },
  ro: {
    title: "Bun venit la Only Best Device",
    hint: "Autentifică-te pentru a administra magazinul",
  },
}

const invite = {
  en: {
    title: "Welcome to Only Best Device",
    successHint: "Get started with the admin panel right away.",
    successAction: "Open the admin panel",
  },
  ro: {
    title: "Bun venit la Only Best Device",
    successHint: "Poți intra imediat în panoul de administrare.",
    successAction: "Deschide panoul de administrare",
  },
}

export default {
  en: {
    translation: {
      login: login.en,
      invite: invite.en,
    },
  },
  ro: {
    translation: {
      login: login.ro,
      invite: invite.ro,
    },
  },
}
