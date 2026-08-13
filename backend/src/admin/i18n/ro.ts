/**
 * Corecturi pentru traducerea română livrată de `@medusajs/dashboard`.
 *
 * Pachetul `ro` din dashboard e tradus automat, cuvânt cu cuvânt, fără context
 * de interfață. Rezultă cinci feluri de greșeli, toate vizibile zilnic:
 *
 *  1. Infinitiv în loc de imperativ pe butoane: „Salva”, „Edita”, „Crea”,
 *     „Anula”, „Adăuga”, „Selecta”, „Confirma”, „Publica”, „Elimina”.
 *  2. Sensul greșit al unui cuvânt polisemantic: „Close” → „Aproape”, „Back” →
 *     „Spate”, „Paste” → „Pastă”, „Handle” → „Mâner”, „Parent” → „Mamă”,
 *     „Balance” → „Echilibru”, „Spend” → „Petrece”, „Draft Orders” → „Proiecte
 *     de ordine”, „Store settings” → „Memorează setările”, „Light/Dark” →
 *     „Aprinde/Întuneric”, „Exact” → „Corect”, „Overrides” → „Anulează”.
 *  3. Cedilă în loc de virgulă dedesubt: ţ/ş (U+0163/U+015F) în loc de ț/ș.
 *  4. Șiruri trunchiate, cu partea a doua pierdută la traducere: „Total excl. ”,
 *     „Min. ”, „Max. ”, „jud”, „Cantitatea este necesară. ”.
 *  5. Două opțiuni distincte cu același text — bug funcțional, nu doar stilistic:
 *     `promotions.form.value_type.fixed` și `.percentage` erau amândouă
 *     „Valoarea de promovare”, iar `fields.amount` (sumă de bani) era
 *     „Cantitate”, identic cu `fields.quantity`.
 *
 * Convenții alese pentru corecturi, ca să nu iasă iar amestecat:
 *  - acțiunile se scriu la imperativ, persoana a II-a singular („Salvează”,
 *    „Șterge”), la fel ca textul de pe ecranul de autentificare;
 *  - etichetele-substantiv stau la nominativ nearticulat („Notă”, „Taxă”,
 *    „Etichetă”), nu articulat („Nota”, „Taxa”);
 *  - „fulfillment” e „livrare”, nu „îndeplinire”/„împlinire”; „draft” e
 *    „ciornă”, nu „proiect”/„Draft”; „return” e „retur”, nu „întoarcere”.
 *
 * Acoperă etichetele (vocabularul scurt, reutilizat pe toate ecranele) plus
 * mesajele lungi cu trafic mare. Frazele lungi rămase și cele 268 de chei care
 * lipsesc din pachetul `ro` (și cad pe engleză) nu sunt atinse aici.
 *
 * Se aplică prin `deepMerge` peste pachetul Medusa (`i18n/index.ts`), deci se
 * listează doar cheile schimbate.
 */
export default {
  general: {
    add: "Adaugă",
    apply: "Aplică",
    close: "Închide",
    end: "Sfârșit",
    next: "Următor",
    of: "din",
    prev: "Anterior",
    range: "Interval",
    removed: "Eliminat",
    select: "Selectează",
    areYouSure: "Ești sigur?",
    countSelected: "{{count}} selectate",
    countOfTotalSelected: "{{count}} din {{total}} selectate",
    plusCountMore: "+ încă {{count}}",
    typeToConfirm: "Scrie {val} pentru a confirma:",
    noResultsMessage: "Încearcă să schimbi filtrele sau termenul căutat",
    unsavedChangesTitle: "Sigur vrei să părăsești acest formular?",
    unsavedChangesDescription:
      "Ai modificări nesalvate care se vor pierde dacă închizi formularul.",
  },

  actions: {
    save: "Salvează",
    saveAsDraft: "Salvează ca ciornă",
    copy: "Copiază",
    duplicate: "Duplică",
    publish: "Publică",
    create: "Creează",
    delete: "Șterge",
    remove: "Elimină",
    revoke: "Revocă",
    cancel: "Anulează",
    forceConfirm: "Confirmă forțat",
    continueEdit: "Continuă editarea",
    enable: "Activează",
    disable: "Dezactivează",
    // Era „Anula”, adică exact textul de la `cancel` — două acțiuni diferite cu
    // aceeași etichetă.
    undo: "Anulează ultima acțiune",
    complete: "Finalizează",
    back: "Înapoi",
    close: "Închide",
    continue: "Continuă",
    continueWithEmail: "Continuă cu e-mail",
    addReason: "Adaugă motiv",
    addNote: "Adaugă notă",
    reset: "Resetează",
    confirm: "Confirmă",
    edit: "Editează",
    addItems: "Adaugă articole",
    download: "Descarcă",
    clear: "Golește",
    clearAll: "Golește tot",
    apply: "Aplică",
    add: "Adaugă",
    select: "Selectează",
  },

  statuses: {
    draft: "Ciornă",
  },

  fields: {
    // „Amount” e o sumă de bani; era „Cantitate”, la fel ca `quantity`.
    amount: "Sumă",
    lastName: "Nume de familie",
    // „Collection” ca substantiv (colecția de produse), nu ca act de colectare.
    collection: "Colecție",
    // Era „Mâner”. E slug-ul din URL, deci îl numim după rolul lui.
    handle: "Identificator URL",
    discountable: "Acceptă reduceri",
    qty: "buc.",
    none: "niciunul",
    years: "Ani",
    note: "Notă",
    currency: "Monedă",
    address: "Adresă",
    // Era „Apartament, apartament etc.” — „suite” tradus a doua oară tot cu
    // „apartament”.
    address2: "Apartament, etaj etc.",
    city: "Oraș",
    country: "Țară",
    // Câmpul e folosit pentru diviziunea administrativă a adresei.
    state: "Județ",
    total: "Total comandă",
    paidTotal: "Total plătit",
    // Erau trunchiate: „Total excl. ”, „Min. ”, „Max. ”.
    totalExclTax: "Total fără taxe",
    minSubtotal: "Subtotal min.",
    maxSubtotal: "Subtotal max.",
    tax: "Taxă",
    date: "Dată",
    order: "Comandă",
    label: "Etichetă",
    rate: "Rată",
    draft: "Ciornă",
    parent: "Părinte",
    price: "Preț",
    priceTemplate: "Preț {{regionOrCurrency}}",
    height: "Înălțime",
    width: "Lățime",
    location: "Locație",
    fulfillment: "Livrare",
    fulfillmentProvider: "Furnizor de livrare",
    fulfillmentProviders: "Furnizori de livrare",
    shipping: "Livrare",
    outboundShipping: "Livrare la client",
    returnShipping: "Livrare retur",
    requiresShipping: "Necesită livrare",
    newPassword: "Parolă nouă",
    repeatPassword: "Repetă parola",
    confirmPassword: "Confirmă parola",
    repeatNewPassword: "Repetă parola nouă",
    selectCountry: "Selectează țara",
    manageInventory: "Gestionează inventarul",
    allowBackorder: "Permite comandă în așteptare",
  },

  app: {
    menus: {
      user: {
        documentation: "Documentație",
        theme: {
          // Erau „Întuneric” (substantiv) și „Aprinde” (verb).
          dark: "Întunecat",
          light: "Luminos",
        },
      },
      // „Store settings” citit ca verb: „Memorează setările”.
      store: {
        storeSettings: "Setările magazinului",
      },
      actions: {
        logout: "Deconectare",
      },
    },
    nav: {
      main: {
        storeSettings: "Setările magazinului",
      },
    },
    search: {
      noResultsMessage: "Nu am găsit nimic care să corespundă căutării.",
      groups: {
        customer: "Clienți",
        region: "Regiuni",
        returnReason: "Motive de retur",
        shippingProfile: "Profiluri de livrare",
      },
    },
    keyboardShortcuts: {
      navigation: {
        goToCustomers: "Clienți",
      },
      settings: {
        goToRegions: "Regiuni",
      },
    },
  },

  dataGrid: {
    columns: {
      view: "Afișare",
    },
    shortcuts: {
      commands: {
        undo: "Anulează",
        redo: "Refă",
        copy: "Copiază",
        // Era „Pastă”, ca pasta de dinți.
        paste: "Lipește",
        edit: "Editează",
        delete: "Șterge",
        clear: "Golește",
        // Erau reflexive („Mișcă-te în sus”, „Deplasați-vă la stânga”): mută
        // cursorul, nu utilizatorul.
        moveUp: "Mută în sus",
        moveDown: "Mută în jos",
        moveLeft: "Mută la stânga",
        moveRight: "Mută la dreapta",
        // „Mutați sus”/„Mutați în jos” nu se distingeau de moveUp/moveDown.
        moveTop: "Mută la început",
        moveBottom: "Mută la sfârșit",
        selectUp: "Selectează în sus",
        selectDown: "Selectează în jos",
        focusCancel: "Renunță la selecție",
      },
    },
    errors: {
      fixError: "Remediază eroarea",
    },
  },

  filters: {
    addFilter: "Adaugă filtru",
    date: {
      from: "De la",
      to: "Până la",
      starting: "Începând cu",
      ending: "Până la",
    },
    compare: {
      lessThan: "Mai mic decât",
      // Era „Corect”.
      exact: "Exact",
      range: "Interval",
      andLabel: "și",
    },
    sorting: {
      alphabeticallyAsc: "De la A la Z",
      alphabeticallyDesc: "De la Z la A",
    },
    radio: {
      true: "Adevărat",
    },
  },

  labels: {
    productVariant: "Variantă de produs",
    prices: "Prețuri",
    removed: "Eliminat",
    from: "De la",
    to: "Până la",
  },

  dateTime: {
    years_other: "Ani",
    // Era „Doilea”, adică numeralul ordinal.
    seconds_one: "Secundă",
    seconds_other: "Secunde",
  },

  login: {
    forgotPassword: "Ai uitat parola? <0>Resetează</0>",
  },

  invite: {
    // Rămăsese „Log in” în engleză în mijlocul frazei.
    alreadyHaveAccount: "Ai deja un cont? <0>Autentifică-te</0>",
    // Era trunchiat la „E-mailul dvs. nu poate fi schimbat. ”, fără explicație.
    emailTooltip:
      "Adresa de e-mail nu poate fi schimbată. Pentru alta trebuie trimisă o invitație nouă.",
    invalidInvite: "Invitația este invalidă sau a expirat.",
    successTitle: "Contul tău a fost creat",
    // „Token” era tradus „indicator”.
    invalidTokenTitle: "Link-ul de invitație este invalid",
    invalidTokenHint: "Cere un link de invitație nou.",
  },

  resetPassword: {
    hint: "Scrie adresa ta de e-mail mai jos și îți trimitem instrucțiuni pentru resetarea parolei.",
    sendResetInstructions: "Trimite instrucțiunile de resetare",
    newPasswordHint: "Alege mai jos o parolă nouă.",
    goToResetPassword: "Mergi la resetarea parolei",
    newPassword: "Parolă nouă",
    repeatNewPassword: "Repetă parola nouă",
    // „Token” era tradus „indicator”.
    invalidTokenTitle: "Codul de resetare este invalid",
    invalidTokenHint: "Cere un link de resetare nou.",
    expiredTokenTitle: "Codul de resetare a expirat",
    invalidLinkTitle: "Link-ul de resetare este invalid",
    invalidLinkHint: "Încearcă să resetezi parola din nou.",
    // Era „V-a trimis cu succes un e-mail”: subiectul frazei era e-mailul.
    successfulRequestTitle: "Ți-am trimis un e-mail",
    // Era trunchiat, lipsea fraza despre folderul de spam.
    successfulRequest:
      "Ți-am trimis un e-mail cu care poți reseta parola. Verifică folderul de spam dacă nu ajunge în câteva minute.",
    // Era „Resetarea parolei cu succes”.
    successfulResetTitle: "Parola a fost resetată",
    successfulReset: "Autentifică-te pe pagina de login.",
  },

  errors: {
    serverError: "Eroare de server — încearcă din nou mai târziu.",
  },

  orders: {
    // Era „Reveni”, verb la infinitiv.
    return: "Retur",
    status: {
      completed: "Finalizată",
      draft: "Ciornă",
    },
    summary: {
      requestReturn: "Solicită retur",
      allocateItems: "Alocă articole",
      editOrder: "Editează comanda",
      editOrderContinue: "Continuă editarea comenzii",
      shippingTotal: "Total livrare",
      discountTotal: "Total reduceri",
      shippingSubtotal: "Subtotal livrare",
      discountSubtotal: "Subtotal reduceri",
      // „Impozit” e taxa pe venit; aici e vorba de TVA.
      taxTotal: "Total taxe",
      taxTotalIncl: "Total taxe (incluse)",
    },
    transfer: {
      title: "Transferă proprietatea",
      currentOwner: "Proprietar actual",
    },
    payment: {
      capture: "Încasează plata",
      // Era „Capta”.
      capture_short: "Încasează",
      refund: "Rambursare",
      markAsPaid: "Marchează ca plătită",
      createRefund: "Creează rambursare",
    },
    edits: {
      title: "Editează comanda",
      create: "Editează comanda",
      confirm: "Confirmă editarea",
      cancel: "Anulează editarea",
    },
    edit: {
      email: {
        title: "Editează e-mailul",
      },
    },
    returns: {
      create: "Creează retur",
      confirm: "Confirmă returul",
      inbound: "Retur",
      note: "Notă",
      location: "Locație",
      // Era „Suma restante”, fără acord.
      outstandingAmount: "Sumă restantă",
      inboundShipping: "Livrare retur",
      sendNotification: "Trimite notificare",
      cancel: {
        title: "Anulează returul",
      },
      receive: {
        action: "Primește articole",
        restockAll: "Reaprovizionează toate articolele",
        inventoryWarning:
          "Ține minte că nivelurile de stoc se ajustează automat, pe baza datelor completate mai sus.",
      },
    },
    claims: {
      create: "Creează revendicare",
      confirm: "Confirmă revendicarea",
      manage: "Gestionează revendicarea",
      // Erau fără diacritice: „Diferenta estimata”.
      refundAmount: "Diferență estimată",
    },
    exchanges: {
      // Rămăsese cuvântul englez în text: „Creați Exchange”.
      create: "Creează schimb",
      manage: "Gestionează schimbul",
      confirm: "Confirmă schimbul",
      refundAmount: "Diferență estimată",
      cancel: {
        title: "Anulează schimbul",
      },
    },
    allocateItems: {
      action: "Alocă articole",
      itemsToAllocate: "Articole de alocat",
      search: "Caută articole",
      error: {
        quantityNotAllocated: "Există articole nealocate.",
      },
    },
    shipment: {
      // Era „Marcați îndeplinirea expediate”, fără acord.
      title: "Marchează livrarea ca expediată",
      sendNotification: "Trimite notificare",
    },
    fulfillment: {
      // „Fulfillment” era tradus „îndeplinire”/„împlinire”, care în română
      // înseamnă realizare personală, nu livrarea comenzii.
      unfulfilledItems: "Articole nelivrate",
      statusLabel: "Stare livrare",
      statusTitle: "Stare livrare",
      fulfillItems: "Livrează articolele",
      awaitingFulfillmentBadge: "În așteptarea livrării",
      itemsToFulfill: "Articole de livrat",
      create: "Creează livrare",
      requiresShipping: "Necesită livrare",
      markAsDelivered: "Marchează ca livrat",
      status: {
        notFulfilled: "Nelivrat",
        partiallyFulfilled: "Livrat parțial",
        fulfilled: "Livrat",
        returned: "Returnat",
      },
    },
    refund: {
      title: "Creează rambursare",
      // Era „Sistem de plată”, cu sensul inversat.
      systemPayment: "Plată din sistem",
      // Era trunchiat după prima frază, deci avertismentul lipsea complet.
      systemPaymentDesc:
        "Cel puțin una dintre plăți e o plată din sistem. Pentru astfel de plăți, încasările și rambursările nu sunt gestionate automat.",
      error: {
        reasonRequired: "Selectează un motiv de rambursare.",
      },
    },
    customer: {
      editEmail: "Editează e-mailul",
      transferOwnership: "Transferă proprietatea",
    },
    activity: {
      events: {
        common: {
          toReturn: "De returnat",
          toSend: "De trimis",
        },
        placed: {
          title: "Comandă plasată",
        },
      },
    },
  },

  products: {
    edit: {
      header: "Editează produsul",
      description: "Editează detaliile produsului.",
    },
    list: {
      noRecordsMessage: "Creează primul produs ca să începi să vinzi.",
    },
    create: {
      title: "Creează produs",
      tabs: {
        organize: "Organizare",
        inventory: "Kituri de inventar",
      },
      inventory: {
        heading: "Kituri de inventar",
      },
      errors: {
        variants: "Selectează cel puțin o variantă.",
        options: "Creează cel puțin o opțiune.",
      },
      variants: {
        subHeadingDescription:
          "Dacă lași nebifat, creăm automat o variantă implicită",
        productVariants: {
          hint: "Ordinea de aici se reflectă în ordinea variantelor din magazin.",
        },
        optionValues: {
          // Erau la plural („Mici, Mijlocii, Mari”), deși sunt valori de opțiune.
          placeholder: "Mic, Mediu, Mare",
        },
      },
    },
    export: {
      success: {
        title: "Se procesează exportul",
      },
    },
    import: {
      success: {
        title: "Se procesează importul",
      },
      template: {
        title: "Nu știi cum să aranjezi lista?",
        description:
          "Descarcă șablonul de mai jos, ca să te asiguri că respecți formatul corect.",
      },
    },
    editAttributes: "Editează atributele",
    editOptions: "Editează opțiunile",
    editPrices: "Editează prețurile",
    media: {
      makeThumbnail: "Setează ca miniatură",
      uploadImagesLabel: "Încarcă imagini",
      downloadImageLabel: "Descarcă imaginea curentă",
      deleteImageLabel: "Șterge imaginea curentă",
      editHint: "Adaugă imagini produsului, ca să apară în magazin.",
      emptyState: {
        // Textul livrat era copiat din `editHint` și vorbea despre adăugarea la
        // produs, deși mesajul apare pe starea goală a galeriei.
        description: "Adaugă imagini, ca produsul să apară cu ele în magazin.",
        action: "Adaugă imagini",
      },
    },
    productStatus: {
      draft: "Ciornă",
    },
    variants: {
      empty: {
        heading: "Nicio variantă",
      },
    },
    fields: {
      title: {
        hint: "Dă produsului un titlu scurt și clar.<0/>50-60 de caractere e lungimea recomandată pentru motoarele de căutare.",
      },
      description: {
        hint: "Dă produsului o descriere scurtă și clară.<0/>120-160 de caractere e lungimea recomandată pentru motoarele de căutare.",
      },
      handle: {
        label: "Identificator URL",
        // Slug-ul din URL nu poate avea diacritice; era „jachetă-de-iarnă”.
        placeholder: "jacheta-de-iarna",
        // Era trunchiat după „vitrina dvs. ”, fără fraza a doua.
        tooltip:
          "Identificatorul e folosit ca referință la produs în magazin. Dacă nu îl completezi, se generează din titlul produsului.",
      },
      variants: {
        hint: "Variantele lăsate nebifate nu se creează. Ordinea de aici se reflectă în ordinea variantelor din magazin.",
      },
      discountable: {
        label: "Acceptă reduceri",
      },
      collection: {
        label: "Colecție",
      },
      // Era „Cod mijlociu”: MID e Manufacturer Identification Code.
      mid_code: {
        label: "Cod MID",
      },
      width: {
        label: "Lățime",
      },
      height: {
        label: "Înălțime",
      },
      options: {
        add: "Adaugă opțiune",
      },
    },
    variant: {
      edit: {
        header: "Editează varianta",
      },
      create: {
        header: "Detalii variantă",
      },
      inventory: {
        editItemDetails: "Editează detaliile articolului",
        manageInventoryLabel: "Gestionează inventarul",
        manageInventoryHint:
          "Când e activat, ajustăm automat cantitatea din stoc la crearea comenzilor și a retururilor.",
        validation: {
          // Era trunchiat: „Cantitatea este necesară. ”
          quantity: "Cantitatea este obligatorie. Introdu un număr pozitiv.",
          itemId: "Selectează articolul de inventar.",
        },
      },
      tableItem_one:
        "{{availableCount}} disponibil la {{locationCount}} locație",
    },
    options: {
      edit: {
        header: "Editează opțiunea",
        successToast: "Opțiunea {{title}} a fost actualizată cu succes.",
      },
      create: {
        header: "Creează opțiune",
        successToast: "Opțiunea {{title}} a fost creată cu succes.",
      },
    },
    organization: {
      header: "Organizare",
      edit: {
        header: "Editează organizarea",
      },
    },
  },

  categories: {
    create: {
      header: "Creează categorie",
      hint: "Creează o categorie nouă ca să îți organizezi produsele.",
      tabs: {
        organize: "Organizează clasamentul",
      },
    },
    edit: {
      header: "Editează categoria",
    },
    organize: {
      header: "Organizare",
      action: "Editează clasamentul",
    },
    fields: {
      // „Children” era „Copii”, care în română înseamnă și copii de om și copii
      // (duplicate) — aici sunt subcategorii.
      children: {
        label: "Subcategorii",
      },
    },
  },

  collections: {
    createCollection: "Creează colecție",
    editCollection: "Editează colecția",
    createCollectionHint: "Creează o colecție nouă ca să îți organizezi produsele.",
    // Era trunchiat după „vitrina dvs. ”, plus „handle” tradus „Mânerul”.
    handleTooltip:
      "Identificatorul e folosit ca referință la colecție în magazin. Dacă nu îl completezi, se generează din titlul colecției.",
  },

  inventory: {
    subtitle: "Gestionează articolele de inventar",
    manageLocations: "Gestionează locațiile",
    editItemDetails: "Editează detaliile articolului",
    reservation: {
      editItemDetails: "Editează rezervarea",
      lineItemId: "ID linie comandă",
      location: "Locație",
      reservedAmount: "Cantitate rezervată",
      create: "Creează rezervare",
    },
    stock: {
      action: "Editează nivelurile de stoc",
    },
  },

  priceLists: {
    create: {
      subheader:
        "Creează o listă nouă de prețuri ca să gestionezi prețurile produselor.",
      tabs: {
        prices: "Prețuri",
      },
    },
    products: {
      actions: {
        addProducts: "Adaugă produse",
        editPrices: "Editează prețurile",
      },
    },
    fields: {
      // Era „Prețul depășește”, ca propoziție.
      priceOverrides: {
        label: "Prețuri suprascrise",
        header: "Prețuri suprascrise",
      },
      status: {
        options: {
          draft: "Ciornă",
        },
      },
      customerAvailability: {
        label: "Disponibilitate pentru clienți",
      },
    },
  },

  draftOrders: {
    // „Orders” citit ca ordine/dispoziții: „Proiecte de ordine”.
    domain: "Comenzi ciornă",
    status: {
      // Era „Deschide”, verb la imperativ, pentru o stare.
      open: "Deschisă",
      completed: "Finalizată",
    },
    markAsPaid: {
      label: "Marchează ca plătită",
      warningTitle: "Marchează ca plătită",
    },
    create: {
      createDraftOrder: "Creează comandă ciornă",
      chooseRegionHint: "Alege regiunea",
      addExistingItemsAction: "Adaugă articole existente",
      useExistingCustomerLabel: "Folosește un client existent",
      sendNotificationLabel: "Trimite notificare",
    },
  },

  stockLocations: {
    list: {
      description:
        "Gestionează locațiile de stoc ale magazinului și opțiunile de livrare.",
    },
    create: {
      header: "Creează locație de stoc",
      successToast: "Locația {{name}} a fost creată cu succes.",
    },
    edit: {
      header: "Editează locația de stoc",
      successToast: "Locația {{name}} a fost actualizată cu succes.",
      viewInventory: "Vezi inventarul",
    },
    fulfillmentProviders: {
      header: "Furnizori de livrare",
      action: "Conectează furnizorii",
    },
    sidebar: {
      header: "Configurare livrare",
      shippingProfiles: {
        label: "Profiluri de livrare",
      },
    },
    shippingOptions: {
      create: {
        action: "Creează opțiune",
        tabs: {
          prices: "Prețuri",
        },
      },
      edit: {
        // Era „Opțiune de editare”, cu termenii inversați.
        action: "Editează opțiunea",
      },
      pricing: {
        action: "Editează prețurile",
      },
      conditionalPrices: {
        actions: {
          addPrice: "Adaugă preț",
          manageConditionalPrices: "Gestionează prețurile condiționate",
        },
        summaries: {
          range:
            "Dacă <0>{{attribute}}</0> este între <1>{{gte}}</1> și <2>{{lte}}</2>",
        },
      },
      fields: {
        provider: "Furnizor de livrare",
        fulfillmentOption: "Opțiune de livrare",
      },
    },
    serviceZones: {
      manageAreas: {
        action: "Gestionează zonele",
        label: "Zone",
      },
    },
  },

  shippingProfile: {
    domain: "Profiluri de livrare",
  },

  taxRegions: {
    create: {
      header: "Creează regiune fiscală",
    },
    province: {
      header: "Provincii",
    },
    state: {
      header: "State",
    },
    county: {
      header: "Județe",
    },
    region: {
      header: "Regiuni",
    },
    territory: {
      header: "Teritorii",
    },
    governorate: {
      header: "Guvernorate",
    },
    canton: {
      header: "Cantoane",
    },
    emirate: {
      header: "Emirate",
    },
    taxOverrides: {
      // Era „Anulează” — „override” confundat cu „cancel”.
      header: "Suprascrieri",
      create: {
        header: "Creează suprascriere",
      },
      edit: {
        header: "Editează suprascrierea",
      },
    },
    fields: {
      taxRate: "Cotă de taxare",
      targets: {
        action: "Adaugă țintă",
        modal: {
          header: "Adaugă ținte",
        },
        operators: {
          and: "și",
        },
        numberOfTargets_one: "{{count}} țintă",
        additionalValues_one: "și încă {{count}} valoare",
        additionalValues_other: "și încă {{count}} valori",
        tags: {
          productCollection: "Colecție de produse",
          productTag: "Etichetă de produs",
        },
      },
      sublevels: {
        labels: {
          // Era „jud”, trunchiat.
          county: "Județ",
          prefecture: "Prefectură",
          governorate: "Guvernorat",
        },
        placeholders: {
          province: "Selectează provincia",
          // Era „Selectați starea” — „state” confundat cu „status”.
          state: "Selectează statul",
          region: "Selectează regiunea",
          stateOrTerritory: "Selectează statul/teritoriul",
          department: "Selectează departamentul",
          county: "Selectează județul",
          territory: "Selectează teritoriul",
          prefecture: "Selectează prefectura",
          district: "Selectează districtul",
          governorate: "Selectează guvernoratul",
          emirate: "Selectează emiratul",
          canton: "Selectează cantonul",
        },
      },
    },
  },

  taxes: {
    domainDescription: "Gestionează regiunea fiscală",
    settings: {
      editTaxSettings: "Editează setările fiscale",
      calculateTaxesAutomaticallyLabel: "Calculează automat taxele",
    },
    taxRate: {
      sectionTitle: "Cote de taxare",
      editRateAction: "Editează cota",
      editOverridesAction: "Editează suprascrierile",
      // Era „Anulări de produs”.
      productOverridesLabel: "Suprascrieri de produs",
    },
  },

  promotions: {
    createPromotionTitle: "Creează promoție",
    sections: {
      details: "Detalii promoție",
    },
    type: "Tip de promoție",
    conditions: {
      add: "Adaugă condiție",
    },
    fields: {
      addCondition: "Adaugă condiție",
      clearAll: "Golește tot",
    },
    edit: {
      title: "Editează detaliile promoției",
      "target-rules": {
        title: "Editează condițiile articolelor",
      },
    },
    campaign: {
      edit: {
        header: "Editează campania",
      },
    },
    form: {
      required: "Obligatoriu",
      and: "ȘI",
      selectAttribute: "Selectează atributul",
      code: {
        description: "Codul pe care clienții îl introduc la finalizarea comenzii.",
      },
      status: {
        label: "Stare",
        draft: {
          title: "Ciornă",
        },
      },
      max_quantity: {
        title: "Cantitate maximă",
      },
      type: {
        standard: {
          description: "O promoție standard",
        },
        buyget: {
          title: "Cumpără și primești",
        },
      },
      allocation: {
        across: {
          title: "Distribuit",
          // Era „Aplică valoarea articolelor”, fără prepoziție.
          description: "Distribuie valoarea între articole",
        },
      },
      campaign: {
        new: {
          title: "Campanie nouă",
        },
      },
      // Amândouă erau „Valoarea de promovare”, copiat din `value.title`, deci
      // cele două opțiuni de tip nu se puteau distinge una de alta.
      value_type: {
        fixed: {
          title: "Sumă fixă",
        },
        percentage: {
          title: "Procent",
        },
      },
    },
  },

  campaigns: {
    delete: {
      title: "Ești sigur?",
    },
    edit: {
      header: "Editează campania",
      description: "Editează detaliile campaniei.",
    },
    create: {
      title: "Creează campanie",
      header: "Creează campanie",
    },
    configuration: {
      edit: {
        header: "Editează configurarea campaniei",
        description: "Editează configurarea campaniei.",
      },
    },
    fields: {
      total_used: "Buget folosit",
    },
    budget: {
      fields: {
        currency: "Monedă",
      },
      type: {
        // Era „Petrece”, cu sensul de a-ți petrece timpul.
        spend: {
          title: "Sumă cheltuită",
        },
      },
      edit: {
        header: "Editează bugetul campaniei",
      },
    },
  },

  customers: {
    domain: "Clienți",
    create: {
      header: "Creează client",
    },
    edit: {
      header: "Editează clientul",
    },
    delete: {
      title: "Șterge clientul",
    },
    // Era „Oaspete”; aici înseamnă client fără cont.
    guest: "Vizitator",
    fields: {
      guest: "Vizitator",
    },
  },

  customerGroups: {
    create: {
      hint: "Creează un grup nou ca să îți segmentezi clienții.",
    },
    customers: {
      remove: {
        title_one: "Elimină clientul",
        title_other: "Elimină clienții",
      },
    },
  },

  giftCards: {
    editGiftCard: "Editează cardul cadou",
    createGiftCardHint:
      "Creează manual un card cadou care poate fi folosit ca metodă de plată în magazin.",
    // „Balance” era „Echilibru”.
    balance: "Sold",
    initialBalance: "Sold inițial",
  },

  regions: {
    domain: "Regiuni",
    createRegion: "Creează regiune",
    editRegion: "Editează regiunea",
    addCountries: "Adaugă țări",
    return: "Retur",
    // „Flat rate” e tarif fix, nu preț global.
    flatRate: "Tarif fix",
    shippingOption: {
      fulfillmentMethod: "Metodă de livrare",
      type: {
        return: "Retur",
        returnHint:
          "Folosește asta dacă faci o opțiune de livrare prin care clientul îți returnează produsele.",
      },
      priceType: {
        flatRate: "Tarif fix",
      },
    },
  },

  store: {
    edit: {
      header: "Editează magazinul",
    },
    manageYourStoresDetails: "Gestionează detaliile magazinului",
    defaultCurrency: "Monedă implicită",
    defaultRegion: "Regiune implicită",
    addCurrencies: "Adaugă monede",
    currencyAlreadyAdded: "Moneda a fost deja adăugată în magazin.",
    // Erau trunchiate, fără avertismentul despre prețuri.
    removeCurrencyWarning_one:
      "Ești pe punctul de a elimina {{count}} monedă din magazin. Asigură-te că ai șters toate prețurile în această monedă înainte să continui.",
    removeCurrencyWarning_other:
      "Ești pe punctul de a elimina {{count}} monede din magazin. Asigură-te că ai șters toate prețurile în aceste monede înainte să continui.",
  },

  users: {
    invite: "Invită",
    editUser: "Editează utilizatorul",
    inviteUser: "Invită utilizator",
    inviteUserHint: "Invită un utilizator nou în magazin.",
    resendInvite: "Retrimite invitația",
  },

  profile: {
    manageYourProfileDetails: "Gestionează detaliile profilului.",
    edit: {
      header: "Editează profilul",
      languagePlaceholder: "Selectează limba",
      // Era trunchiat imediat după prima frază, așa că linkul din text rămânea
      // atârnat de nimic: „…îmbunătățim Medusa.  <0>documentare</0>.”
      usageInsightsHint:
        "Trimite date despre utilizare, ca să ne ajuți să îmbunătățim panoul de administrare. Poți citi în <0>documentație</0> ce colectăm și cum folosim datele.",
    },
  },

  apiKeyManagement: {
    create: {
      createSecretHint:
        "Creează o cheie API secretă nouă, cu care să accesezi API-ul magazinului ca utilizator administrator autentificat.",
    },
    edit: {
      header: "Editează cheia API",
    },
    actions: {
      revoke: "Revocă cheia API",
      copy: "Copiază cheia API",
    },
  },

  returnReasons: {
    domain: "Motive de retur",
    editReason: "Editează motivul de retur",
    create: {
      header: "Adaugă motiv de retur",
    },
    edit: {
      header: "Editează motivul de retur",
    },
    fields: {
      label: {
        label: "Etichetă",
      },
      value: {
        // Era „dimensiune_ greșită”: spațiu în plus și diacritice, deși e o
        // valoare tehnică.
        placeholder: "dimensiune_gresita",
      },
    },
  },

  addresses: {
    locationHeading: "Locație",
    shippingAddress: {
      header: "Adresă de livrare",
      editLabel: "Adresă de livrare",
      label: "Adresă de livrare",
    },
    billingAddress: {
      header: "Adresă de facturare",
      editLabel: "Adresă de facturare",
      label: "Adresă de facturare",
    },
  },

  transferOwnership: {
    header: "Transferă proprietatea",
    label: "Transferă proprietatea",
    details: {
      order: "Detalii comandă",
      // Era „Ciornă detalii”, cu termenii inversați.
      draft: "Detalii ciornă",
    },
    currentOwner: {
      label: "Proprietar actual",
    },
  },

  metadata: {
    edit: {
      header: "Editează metadatele",
      actions: {
        deleteRow: "Șterge rândul",
      },
    },
  },

  email: {
    editHeader: "Editează e-mailul",
  },

  locations: {
    editLocation: "Editează locația",
  },

  salesChannels: {
    addProducts: "Adaugă produse",
    createSalesChannelHint:
      "Creează un canal nou de vânzare pe care să îți vinzi produsele.",
  },

  productTypes: {
    subtitle: "Organizează produsele pe tipuri.",
    create: {
      hint: "Creează un tip nou de produs ca să îți clasifici produsele.",
    },
  },

  productTags: {
    create: {
      subtitle: "Creează o etichetă nouă ca să îți clasifici produsele.",
    },
  },

  notifications: {
    accessibility: {
      // Începea cu literă mică: „notificările despre…”.
      description: "Aici vor apărea notificările despre activitatea magazinului.",
    },
  },

  workflowExecutions: {
    // Textul original trimitea la „aplicația dvs. Medusa”; marca se scoate, ca
    // pe restul ecranelor văzute de client.
    subtitle: "Vezi și urmărește execuțiile fluxurilor de lucru.",
    history: {
      // „History” ca istoric al execuției, nu ca disciplină.
      sectionTitle: "Istoric",
      runningState: "Se execută...",
      definitionLabel: "Definiție",
      outputLabel: "Rezultat",
      revertedLabel: "Anulat",
      compensateInputLabel: "Date de compensare",
      skippedState: "Omis",
    },
    state: {
      done: "Finalizat",
      reverted: "Anulat",
      invoking: "Se execută",
      compensating: "Se compensează",
    },
    transaction: {
      state: {
        waitingToCompensate: "Așteaptă compensarea",
      },
    },
    step: {
      state: {
        // Erau „Sărit”, „Adormit” și „Pauză”.
        skipped: "Omis",
        dormant: "Inactiv",
        timeout: "Expirat",
      },
    },
  },
}
