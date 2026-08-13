/**
 * Suprascrieri de texte pentru dashboard-ul Medusa.
 *
 * Dashboard-ul face `deepMerge(traduceriProprii, aceste resurse)`
 * (`@medusajs/dashboard` → `dashboard-app.populateI18n`), deci orice cheie
 * definită aici o înlocuiește pe cea din pachet. Se folosește ca să scoatem
 * marca Medusa din ecranele pe care le vede clientul: autentificare și invitație.
 *
 * Cheile de marcă sunt definite și în engleză, și în română: implicitul e româna
 * (vezi mai jos), dar limba se poate schimba din profilul fiecărui utilizator.
 * Restul limbilor rămân cu textele Medusa; pe login logo-ul e oricum al nostru
 * (`widgets/login-branding.tsx`).
 *
 * Scrise direct în TypeScript, nu în `i18n/json/*.json`: fișierele din `src/`
 * intră și în compilarea serverului (`module: Node16`), unde importurile de
 * JSON cu `with { type: "json" }` din README nu sunt acceptate.
 */
import ro from "./ro"
import roMissing from "./ro-missing"

type Translations = { [key: string]: string | Translations }

/**
 * Combină obiecte de traduceri pe toată adâncimea, cu valorile din `extra`
 * câștigătoare pe cheile-frunză.
 *
 * Dashboard-ul face același lucru cu `deepMerge` din `@medusajs/admin-shared`,
 * dar pachetul acela e doar o dependență transitivă (prin `@medusajs/dashboard`),
 * nu una declarată de proiect, așa că nu importăm din el. E nevoie de merge, nu
 * de spread: `ro.ts` și `ro-missing.ts` ating aceleași grupuri de nivel întâi
 * (`general`, `fields`, `orders`, …), deci un spread ar păstra doar unul.
 */
const merge = (base: Translations, extra: Translations): Translations => {
  const out: Translations = { ...base }

  for (const [key, value] of Object.entries(extra)) {
    const current = out[key]

    out[key] =
      typeof value === "object" && typeof current === "object"
        ? merge(current, value)
        : value
  }

  return out
}

/**
 * Limba implicită a dashboard-ului.
 *
 * Medusa inițializează i18next cu `fallbackLng: "en"` și cu detectorul de limbă
 * pe ordinea `["cookie", "localStorage", "header"]` (`@medusajs/dashboard` →
 * `src/i18n/config.ts`), fără punct de extensie pentru opțiuni — din `src/admin`
 * se pot suprascrie doar resursele. Pe un browser cu `Accept-Language` englez,
 * ecranul de autentificare apărea în engleză, deși magazinul e românesc.
 *
 * Preferința de limbă nu se salvează pe utilizator în backend: selectorul din
 * profil apelează doar `i18n.changeLanguage()`, care scrie în cheile de cache
 * ale detectorului (cookie-ul și `localStorage` `lng`). Ca să pornim pe română
 * scriem noi acele chei, o singură dată per browser: `obd-lng-default` ține
 * minte că implicitul a fost aplicat, ca o alegere făcută ulterior din profil să
 * nu fie suprascrisă la fiecare încărcare. (Se compară cu valoarea, nu cu un
 * boolean, ca schimbarea implicitului să se reaplice o dată.)
 *
 * Cookie-ul e scris în aceeași formă ca a detectorului — `path=/`,
 * `sameSite=strict`, fără expirare — ca să nu ajungem cu două cookie-uri `lng`.
 *
 * Rulează la import, nu dintr-un widget: modulul e importat static de
 * `virtual:medusa/i18n` în `@medusajs/dashboard` → `src/app.tsx`, deci se
 * evaluează înainte ca `<I18n>` să apeleze `i18n.init()`. Garda pe `window` e
 * pentru compilarea serverului, care include și fișierele din `src/admin`.
 */
const DEFAULT_LANGUAGE = "ro"
const DEFAULT_LANGUAGE_KEY = "obd-lng-default"

if (typeof window !== "undefined") {
  try {
    if (window.localStorage.getItem(DEFAULT_LANGUAGE_KEY) !== DEFAULT_LANGUAGE) {
      window.localStorage.setItem(DEFAULT_LANGUAGE_KEY, DEFAULT_LANGUAGE)
      window.localStorage.setItem("lng", DEFAULT_LANGUAGE)
      document.cookie = `lng=${DEFAULT_LANGUAGE};path=/;samesite=strict`
    }
  } catch {
    // localStorage blocat (fereastră privată, cookie-uri de terță parte oprite):
    // rămâne limba detectată din browser.
  }
}

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

/**
 * Româna se compune în trei straturi, în ordinea în care fiecare are dreptul să
 * suprascrie: corecturile de traducere (`ro.ts`), completările pentru cheile pe
 * care Medusa nu le-a tradus deloc (`ro-missing.ts`) și, ultima, marca proprie —
 * ca titlurile de pe autentificare și invitație să rămână ale noastre.
 */
export default {
  en: {
    translation: {
      login: login.en,
      invite: invite.en,
    },
  },
  ro: {
    translation: merge(merge(ro, roMissing), {
      login: login.ro,
      invite: invite.ro,
    }),
  },
}
