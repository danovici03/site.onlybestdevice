// Șiruri (RO) pentru secțiunea de cont a clientului.
// Sursă unică de adevăr, ca să putem conecta ulterior un strat i18n real
// fără să căutăm prin fiecare componentă.
// (Numele fișierului rămâne `account.it.ts` din motive de compatibilitate cu importurile.)

export const account = {
  // Layout
  layout: {
    helpTitle: "Ai nevoie de ajutor?",
    helpSubtitle:
      "Echipa noastră îți stă la dispoziție pentru orice întrebare despre comenzi, retururi și produse.",
    helpCta: "Contactează-ne",
  },

  // Navigation
  nav: {
    section: "Contul meu",
    overview: "Prezentare generală",
    profile: "Profil",
    addresses: "Adrese",
    orders: "Comenzi",
    returns: "Retururi",
    preferences: "Preferințe",
    logout: "Ieși din cont",
    back: "Înapoi",
  },

  // Common
  common: {
    save: "Salvează",
    cancel: "Anulează",
    edit: "Modifică",
    delete: "Șterge",
    add: "Adaugă",
    confirm: "Confirmă",
    loading: "Se încarcă…",
    saving: "Se salvează…",
    saved: "Salvat",
    error: "A apărut o eroare. Încearcă din nou.",
    requiredField: "Câmp obligatoriu",
    optional: "(opțional)",
    seeAll: "Vezi tot",
    backToAccount: "Înapoi la contul meu",
  },

  // Auth (login / register / forgot / reset)
  auth: {
    welcomeBack: "Bine ai revenit",
    welcomeBackSubtitle: "Autentifică-te ca să-ți gestionezi comenzile și datele.",
    createAccount: "Creează-ți contul",
    createAccountSubtitle:
      "Înregistrează-te ca să comanzi mai rapid și să-ți urmărești comenzile.",
    email: "Email",
    password: "Parolă",
    firstName: "Prenume",
    lastName: "Nume",
    phone: "Telefon",
    signIn: "Autentifică-te",
    signUp: "Înregistrează-te",
    signingIn: "Se autentifică…",
    signingUp: "Se înregistrează…",
    forgotPassword: "Ai uitat parola?",
    noAccount: "Nu ai cont?",
    haveAccount: "Ai deja cont?",
    invalidCredentials:
      "Email sau parolă incorecte. Verifică datele și încearcă din nou.",
    marketingConsent:
      "Vreau să primesc oferte și noutăți de la onlybestdevice. Mă pot dezabona oricând.",
    termsConsent:
      "Prin crearea unui cont accepți {terms} și ai luat la cunoștință {privacy}.",
    termsLink: "Termenii și condițiile",
    privacyLink: "Politica de confidențialitate",
    forgotTitle: "Recuperează-ți parola",
    forgotSubtitle:
      "Introdu adresa de email și îți trimitem un link pentru resetarea parolei.",
    forgotSubmit: "Trimite linkul de resetare",
    forgotSent:
      "Dacă adresa este înregistrată, vei primi în scurt timp un email cu instrucțiunile.",
    resetTitle: "Setează o parolă nouă",
    resetSubtitle: "Alege o parolă sigură, de cel puțin 8 caractere.",
    newPassword: "Parolă nouă",
    confirmPassword: "Confirmă parola",
    passwordsMismatch: "Parolele nu coincid.",
    passwordTooShort: "Parola trebuie să aibă cel puțin 8 caractere.",
    resetSubmit: "Actualizează parola",
    resetSuccess:
      "Parolă actualizată. Acum te poți autentifica cu noile date.",
    resetInvalidToken:
      "Linkul a expirat sau nu este valid. Solicită un nou link de resetare.",
  },

  // Overview
  overview: {
    hello: "Salut",
    helloFallback: "Bine ai revenit",
    intro:
      "De aici îți poți gestiona datele, adresele de livrare și urmări comenzile.",
    profileCompletion: "Profil complet",
    profileCompletionHint:
      "Completează-ți profilul pentru un checkout mai rapid.",
    defaultAddress: "Adresă implicită",
    noDefaultAddress: "Nicio adresă implicită setată.",
    addAddress: "Adaugă adresă",
    recentOrders: "Comenzi recente",
    noOrders: "Nu ai plasat încă nicio comandă.",
    noOrdersCta: "Descoperă catalogul",
  },

  // Profile
  profile: {
    title: "Profil",
    subtitle: "Gestionează-ți datele personale.",
    nameLabel: "Nume și prenume",
    emailLabel: "Email",
    phoneLabel: "Telefon",
    passwordLabel: "Parolă",
    billingLabel: "Adresă de facturare",
    passwordPlaceholder: "Din motive de securitate, parola nu este afișată.",
    emailReadonlyHint:
      "Pentru a schimba emailul, contactează serviciul clienți.",
    oldPassword: "Parola actuală",
    newPassword: "Parolă nouă",
    confirmPassword: "Confirmă parola nouă",
    passwordUpdated: "Parolă actualizată cu succes.",
  },

  // Addresses
  addresses: {
    title: "Agendă de adrese",
    subtitle:
      "Adaugă adresele de livrare folosite cel mai des, ca să accelerezi checkout-ul.",
    addNew: "Adaugă adresă",
    edit: "Modifică adresa",
    defaultBadge: "Implicită",
    setDefault: "Setează ca implicită",
    company: "Companie",
    address1: "Adresă",
    address2: "Apartament, scară, etc. (opțional)",
    city: "Oraș",
    province: "Județ",
    postalCode: "Cod poștal",
    country: "Țară",
    deleteConfirm: "Sigur vrei să ștergi această adresă?",
    invalidCap: "Codul poștal trebuie să aibă 6 cifre.",
    noAddresses: "Nu ai salvat încă nicio adresă.",
  },

  // Orders
  orders: {
    title: "Comenzile mele",
    subtitle: "Toate comenzile plasate cu contul tău.",
    empty: "Nu ai plasat încă nicio comandă.",
    emptyCta: "Începe să cumperi",
    orderNumber: "Comanda",
    placedOn: "Plasată la",
    total: "Total",
    items: "Produse",
    seeDetails: "Vezi detalii",
    detailsTitle: "Detalii comandă",
    backToOrders: "Înapoi la comenzile mele",
    requestReturn: "Solicită retur",
    downloadInvoice: "Descarcă factura PDF",
    shippingAddress: "Adresă de livrare",
    billingAddress: "Adresă de facturare",
    paymentMethod: "Metodă de plată",
    summary: "Rezumat",
    subtotal: "Subtotal",
    shipping: "Livrare",
    tax: "TVA",
    discount: "Reducere",
    status: {
      pending: "În așteptare",
      completed: "Finalizată",
      archived: "Arhivată",
      canceled: "Anulată",
      requires_action: "Necesită acțiune",
    },
    fulfillmentStatus: {
      not_fulfilled: "De pregătit",
      partially_fulfilled: "Parțial pregătită",
      fulfilled: "Pregătită",
      partially_shipped: "Parțial expediată",
      shipped: "Expediată",
      delivered: "Livrată",
      canceled: "Anulată",
      returned: "Returnată",
    },
  },

  // Returns
  returns: {
    title: "Retururi",
    subtitle:
      "Solicită returnarea unuia sau mai multor produse în termen de 14 zile de la livrare.",
    empty: "Nu ai încă nicio cerere de retur.",
    requestTitle: "Solicită retur",
    requestSubtitle: "Selectează produsele pe care vrei să le returnezi.",
    selectItems: "Produse",
    quantity: "Cant.",
    reason: "Motiv",
    note: "Notă (opțional)",
    submit: "Trimite cererea",
    submitting: "Se trimite…",
    reasons: {
      defective: "Produs defect",
      wrong_item: "Produs neconform",
      not_wanted: "Nu îl mai doresc",
      damaged_in_transit: "Deteriorat în timpul transportului",
      other: "Altul",
    },
    windowExpired:
      "Perioada de retur de 14 zile a expirat. Contactează serviciul clienți pentru cazuri speciale.",
    submitted: "Cerere trimisă. Te contactăm în maximum 48 de ore.",
  },

  // Order confirmed (thank-you page after checkout)
  orderConfirmed: {
    metaTitle: "Comandă confirmată",
    metaDescription: "Comanda ta a fost plasată cu succes",
    badge: "Comandă confirmată",
    title: "Mulțumim!",
    subtitle: "Comanda ta a fost înregistrată cu succes.",
    emailNotice: "Am trimis confirmarea la",
    orderNumber: "Comanda nr.",
    placedOn: "Plasată la",
    downloadInvoice: "Descarcă factura PDF",
    viewOrders: "Mergi la comenzile mele",
    guestAccountTitle: "Vrei să urmărești comanda mai ușor?",
    guestAccountBody:
      "Creează-ți un cont cu emailul folosit la comandă — vezi statusul comenzilor, descarci facturi și faci retururi în câteva clickuri.",
    guestAccountCta: "Creează-ți cont",
    itemsTitle: "Produse",
    summaryTitle: "Rezumat",
    shippingAddress: "Adresă de livrare",
    shippingMethod: "Metodă de livrare",
    paymentMethod: "Metodă de plată",
    paidAt: "Plătită la",
    nextStepsTitle: "Ce urmează?",
    nextStepsBody:
      "Vei primi un nou email imediat ce comanda ta este pregătită și expediată. Poți urmări starea comenzii din contul tău.",
    onboardingTitle: "Comandă de test creată cu succes",
    onboardingBody:
      "Acum poți finaliza configurarea magazinului din zona de admin.",
    onboardingCta: "Finalizează configurarea",
    paymentTitles: {
      card: "Card bancar",
      paypal: "PayPal",
      ideal: "iDeal",
      bancontact: "Bancontact",
      manual: "Plată la livrare",
      fallback: "Plată",
    },
  },

  // Preferences
  preferences: {
    title: "Preferințe",
    subtitle: "Gestionează cum și când primești comunicări de la onlybestdevice.",
    marketingEmails: "Emailuri promoționale și noutăți",
    marketingHint:
      "Oferte, noutăți și conturi dedicate. Te poți dezabona oricând.",
    transactionalEmails: "Emailuri tranzacționale",
    transactionalHint:
      "Confirmări de comandă, livrări și comunicări despre achizițiile tale. Necesare și nedezactivabile.",
    smsNotifications: "Notificări prin SMS",
    smsHint:
      "Alerte de expediere și livrare prin SMS. Serviciu indisponibil momentan.",
    updated: "Preferințe actualizate.",
  },
} as const

export type AccountStrings = typeof account
