/**
 * Chei care lipsesc complet din pachetul `ro` al dashboard-ului.
 *
 * Sunt cele 268 de chei existente în `en` dar absente din `ro`, deci pentru care
 * i18next cădea pe `fallbackLng: "en"` și afișa engleză în mijlocul interfeței
 * românești. Vin în principal din funcționalități adăugate după ultima
 * actualizare a traducerii române: traduceri de conținut (`translations`),
 * vizualizări salvate (`views`), motive de rambursare (`refundReasons`), tipuri
 * de opțiuni de livrare (`shippingOptionTypes`), linii de credit și reglarea
 * soldului pe comandă, imagini pe variantă, opțiuni de ridicare personală.
 *
 * Stau separat de `ro.ts` din două motive: sunt completări, nu corecturi (dacă
 * Medusa își traduce cândva cheile, fișierul acesta poate fi șters în bloc, pe
 * când `ro.ts` rămâne relevant), iar seturile de chei fiind disjuncte nu există
 * riscul să se calce reciproc la merge.
 *
 * Aceleași convenții ca în `ro.ts`: imperativ singular pentru acțiuni,
 * substantive nearticulate pentru etichete, „livrare” pentru fulfillment.
 * Mențiunile de marcă Medusa din textele originale sunt scoase, ca pe restul
 * ecranelor văzute de client; excepție `auth.login.cloud`, unde „Medusa Cloud”
 * e numele serviciului la care te autentifici, nu o formulă de prezentare.
 */
export default {
  general: {
    fullList: "Toate",
    original: "Original",
    selectAll: "Selectează tot",
    unselectAll: "Deselectează tot",
    remaining: "Rămase",
    areYouSureDescription:
      "Ești pe punctul de a șterge {{entity}} {{title}}. Acțiunea nu poate fi anulată.",
    noRecordsMessageFiltered:
      "Nu există înregistrări care să corespundă filtrelor",
  },

  actions: {
    saveChanges: "Salvează modificările",
    saveAndClose: "Salvează și închide",
    editImages: "Editează imaginile",
    editVariantImages: "Editează imaginile variantei",
  },

  filters: {
    collapse: {
      all: "Restrânge tot",
    },
  },

  labels: {
    beaware: "Atenție",
    loading: "Se încarcă",
    selectValue: "Selectează valoarea",
    selectValues: "Selectează valorile",
  },

  fields: {
    reference: "Referință",
    reference_id: "ID referință",
    enabledInStore: "Activat în magazin",
    isReturn: "Este retur",
    promotionCode: "Cod promoțional",
    serviceZone: "Zonă de serviciu",
    creditTotal: "Total linii de credit",
  },

  addresses: {
    title: "Adrese",
  },

  products: {
    media: {
      manageImageVariants: "Gestionează variantele asociate",
      fileTooLarge:
        "Unul sau mai multe fișiere depășesc dimensiunea maximă de {{size}}: {{name}}",
      variantImages: "Imaginile variantei",
      showAvailableImages: "Arată imaginile disponibile",
      availableImages: "Selectează imagini",
      selectToAdd:
        "Adaugă variantei imagini ale produsului. Pentru imagini noi, adaugă-le mai întâi la produs.",
      removeSelected: "Elimină selecția",
    },
    variantMedia: {
      label: "Imagini variantă",
      manageVariants: "Gestionează variantele",
      addToMultipleVariants: "Adaugă la mai multe variante",
      manageVariantsDescription: "Gestionează variantele asociate imaginii",
      successToast: "Variantele imaginii au fost actualizate.",
      emptyState: {
        header: "Încă nu există imagini",
        description: "Adaugă imagini variantei, ca să apară în magazin.",
        action: "Adaugă imagini",
      },
    },
    columns: {
      product_display: "Produs",
      variants_count: "Variante",
      sales_channels_display: "Canale de vânzare",
      collection: "Colecție",
      status: "Stare",
      thumbnail: "Miniatură",
      title: "Titlu",
      handle: "Identificator URL",
      created_at: "Creat",
      updated_at: "Actualizat",
    },
    fields: {
      shipping_profile: {
        label: "Profil de livrare",
        hint: "Leagă produsul la un profil de livrare",
      },
    },
    shippingProfile: {
      header: "Configurare livrare",
      edit: {
        header: "Configurare livrare",
        toasts: {
          success: "Profilul de livrare pentru {{title}} a fost actualizat.",
        },
      },
      create: {
        errors: {
          required: "Profilul de livrare este obligatoriu",
        },
      },
    },
  },

  inventory: {
    manageLocationQuantity: "Gestionează cantitatea pe locație",
    quantityAcrossLocations: "{{quantity}} în {{locations}} locații",
    levelDeleted: "Nivelul de stoc a fost șters.",
  },

  customers: {
    addresses: {
      title: "Adrese",
      fields: {
        addressName: "Nume adresă",
        address1: "Adresă 1",
        address2: "Adresă 2",
        city: "Oraș",
        province: "Provincie",
        postalCode: "Cod poștal",
        country: "Țară",
        phone: "Telefon",
        company: "Companie",
        countryCode: "Cod țară",
        provinceCode: "Cod provincie",
      },
      create: {
        header: "Creează adresă",
        hint: "Creează o adresă nouă pentru client.",
        successToast: "Adresa a fost creată.",
      },
    },
  },

  orders: {
    giftCardsStoreCreditLines: "Carduri cadou și credit",
    creditLines: {
      title: "Linii de credit",
      total: "Totalul liniilor de credit",
      creditOrDebit: "Credit / Debit",
      createCreditLine: "Creează linie de credit",
      createCreditLineSuccess: "Linia de credit a fost creată",
      createCreditLineError: "Eroare la crearea liniei de credit",
      createCreditLineDescription:
        "Creează o linie de credit pentru suma {{amount}}",
      operation: "Operațiune",
      credit: "Credit",
      creditDescription: "Adaugă o sumă la comandă",
      debit: "Debit",
      debitDescription: "Scade o sumă din comandă",
    },
    balanceSettlement: {
      title: "Reglarea soldului",
      settlementType: "Tip de reglare",
      settlementTypes: {
        paymentMethod: "Metodă de plată",
        paymentMethodDescription: "Rambursează suma pe metoda de plată",
        creditLine: "Credit în magazin",
        creditLineDescription: "Rambursează suma ca credit în magazin",
      },
    },
    export: {
      header: "Exportă lista de comenzi",
      description: "Exportă lista de comenzi într-un fișier CSV.",
      success: {
        title: "Exportul a început",
        description: "Te anunțăm când exportul e gata.",
      },
      filters: {
        title: "Filtre",
        description: "Exportul se face cu filtrele de mai jos aplicate.",
      },
    },
    summary: {
      totalAfterDiscount: "Total după reducere",
    },
    payment: {
      totalStoreCreditRefunds: "Total rambursări în credit",
    },
    returns: {
      estDifference: "Diferență estimată",
    },
    claims: {
      carryOverPromotion: "Preia promoțiile",
      carryOverPromotionHint:
        "Aplică promoțiile comenzii pe articolele revendicării",
      carryOverPromotionTooltip:
        "Se pot preia pe articolele trimise doar promoțiile cu sumă fixă și alocare EACH, plus cele procentuale cu alocare EACH sau ACROSS.",
    },
    exchanges: {
      carryOverPromotion: "Preia promoțiile",
      carryOverPromotionHint:
        "Aplică promoțiile comenzii pe articolele schimbului",
      carryOverPromotionTooltip:
        "Se pot preia pe articolele trimise doar promoțiile cu sumă fixă și alocare EACH, plus cele procentuale cu alocare EACH sau ACROSS.",
    },
    allocateItems: {
      toast: {
        error: "Nu s-au putut aloca articolele: {{items}}",
      },
    },
    shipment: {
      trackingUrl: "Link de urmărire",
      labelUrl: "Link etichetă",
    },
    fulfillment: {
      differentOptionSelected:
        "Opțiunea de livrare selectată e diferită de cea aleasă de client.",
      disabledItemTooltip:
        "Opțiunea de livrare selectată nu permite livrarea acestui articol",
      markAsPickedUp: "Marchează ca ridicat",
      error: {
        noShippingOption: "Opțiunea de livrare este obligatorie",
        noLocation: "Locația este obligatorie",
      },
      status: {
        awaitingPickup: "În așteptarea ridicării",
        awaitingShipping: "În așteptarea expedierii",
        awaitingDelivery: "În așteptarea livrării",
      },
      toast: {
        fulfillmentPickedUp: "Livrarea a fost marcată ca ridicată",
      },
    },
  },

  draftOrders: {
    list: {
      noRecordsMessage: "Nu există comenzi ciornă",
      description: "Creează o comandă ciornă pentru a începe.",
      filtered: {
        heading: "Niciun rezultat",
        description: "Nicio comandă ciornă nu corespunde filtrelor.",
      },
    },
  },

  stockLocations: {
    list: {
      noRecordsMessage: "Fără înregistrări",
      noRecordsMessageEmpty: "Nicio locație",
      noRecordsMessageFiltered: "Nicio locație nu corespunde filtrelor",
    },
    delete: {
      successToast: "Locația „{{name}}” a fost ștearsă.",
    },
    sidebar: {
      shippingOptionTypes: {
        label: "Tipuri de opțiuni de livrare",
        description: "Grupează opțiunile de livrare pe tipuri",
      },
    },
    salesChannels: {
      hint: "Gestionează canalele de vânzare legate de această locație.",
    },
    pickupOptions: {
      edit: {
        header: "Editează opțiunea de ridicare",
      },
    },
    shippingOptions: {
      create: {
        pickup: {
          header: "Creează opțiune de ridicare pentru {{zone}}",
          hint: "Creează o opțiune de ridicare, ca să definești cum se ridică produsele din această locație.",
          label: "Opțiuni de ridicare",
          successToast: "Opțiunea de ridicare {{name}} a fost creată.",
        },
      },
      fields: {
        type: "Tip de opțiune de livrare",
        count: {
          pickup_one: "{{count}} opțiune de ridicare",
          pickup_other: "{{count}} opțiuni de ridicare",
        },
      },
    },
  },

  shippingOptionTypes: {
    domain: "Tipuri de opțiuni de livrare",
    subtitle: "Organizează opțiunile de livrare pe tipuri.",
    create: {
      header: "Creează tip de opțiune de livrare",
      hint: "Creează un tip nou pentru clasificarea opțiunilor de livrare.",
      successToast: "Tipul de opțiune de livrare {{label}} a fost creat.",
    },
    edit: {
      header: "Editează tipul de opțiune de livrare",
      successToast: "Tipul de opțiune de livrare {{label}} a fost actualizat.",
    },
    delete: {
      confirmation:
        "Ești pe punctul de a șterge tipul de opțiune de livrare „{{label}}”. Acțiunea nu poate fi anulată.",
      successToast: "Tipul de opțiune de livrare „{{label}}” a fost șters.",
    },
    fields: {
      label: "Etichetă",
      code: "Cod",
      description: "Descriere",
    },
  },

  taxRegions: {
    create: {
      errors: {
        missingProvider:
          "Furnizorul este obligatoriu la crearea unei regiuni fiscale.",
        missingCountry: "Țara este obligatorie la crearea unei regiuni fiscale.",
      },
    },
    edit: {
      header: "Editează regiunea fiscală",
      hint: "Editează detaliile regiunii fiscale.",
      successToast: "Regiunea fiscală a fost actualizată.",
    },
    provider: {
      header: "Furnizor de taxe",
    },
    fields: {
      taxProvider: "Furnizor de taxe",
      targets: {
        options: {
          shippingOption: "Opțiuni de livrare",
        },
        placeholders: {
          shippingOption: "Caută opțiuni de livrare",
        },
        tags: {
          shippingOption: "Opțiune de livrare",
        },
      },
    },
  },

  promotions: {
    fields: {
      allocationTooltip:
        "„Fiecare” aplică limita de cantitate pe fiecare articol, iar „O singură dată” o aplică pe tot coșul",
      taxInclusive: "Include taxe",
      usageLimit: "Limită de utilizări",
      usage: "Utilizări",
      conditions: {
        "target-rules": {
          order: {
            title: "Pe ce articole se aplică promoția?",
            description:
              "Promoția se aplică articolelor care îndeplinesc condițiile de mai jos.",
          },
          shipping_methods: {
            title: "Pe ce metode de livrare se aplică promoția?",
            description:
              "Promoția se aplică metodelor de livrare care îndeplinesc condițiile de mai jos.",
          },
          items: {
            title: "Pe ce articole se aplică promoția?",
            description:
              "Promoția se aplică articolelor care îndeplinesc condițiile de mai jos.",
          },
        },
      },
    },
    form: {
      taxInclusive: {
        title: "Promoția include taxele?",
        description:
          "Activează acest câmp pentru a aplica promoția după calcularea taxelor",
      },
      allocation: {
        once: {
          title: "O singură dată",
          description: "Aplică valoarea unui număr limitat de articole",
        },
      },
      value: {
        invalid: "Valoare de promoție invalidă",
      },
      limit: {
        title: "Limită de utilizări",
        description:
          "De câte ori poate fi folosită promoția, pe toate comenzile la un loc. Lasă gol pentru utilizări nelimitate.",
      },
    },
    templates: {
      amount_off_products: {
        title: "Sumă redusă la produse",
        description: "Reduce anumite produse sau o colecție de produse",
      },
      amount_off_order: {
        title: "Sumă redusă la comandă",
        description: "Reduce totalul comenzii",
      },
      percentage_off_product: {
        title: "Procent redus la produs",
        description: "Reduce un procent din produsele selectate",
      },
      percentage_off_order: {
        title: "Procent redus la comandă",
        description: "Reduce un procent din totalul comenzii",
      },
      buy_get: {
        title: "Cumperi X, primești Y",
        description: "Cumperi X produs(e), primești Y produs(e)",
      },
      shipping_discount: {
        title: "Livrare gratuită",
        description: "Aplică o reducere de 100% la costul livrării",
      },
    },
  },

  campaigns: {
    fields: {
      totalUsedByAttribute: "Total utilizări",
    },
    budget: {
      attribute: {
        customer_id: "client",
        customer_email: "e-mail",
      },
      fields: {
        budgetAttribute: "Limitează utilizarea pe",
        budgetAttributeTooltip:
          "Stabilește de câte ori poate fi folosită promoția de fiecare client sau adresă de e-mail.",
        totalUsedByAttribute: "Limită de buget pe: {{attribute}}",
        totalUsedByAttributeCustomerId: "Limită de buget pe client",
        totalUsedByAttributeEmail: "Limită de buget pe e-mail",
      },
      type: {
        useByAttribute: {
          title: "Utilizări pe atribut (ID client, e-mail etc.)",
          titleCustomerId: "Utilizări pe client",
          titleEmail: "Utilizări pe e-mail",
          description:
            "Stabilește o limită de utilizări pentru o anumită valoare a atributului.",
        },
      },
    },
  },

  refundReasons: {
    domain: "Motive de rambursare",
    subtitle: "Gestionează motivele pentru care se fac rambursări.",
    calloutHint: "Gestionează motivele folosite la clasificarea rambursărilor.",
    editReason: "Editează motivul de rambursare",
    create: {
      header: "Adaugă motiv de rambursare",
      subtitle: "Specifică motivele cele mai frecvente de rambursare.",
      hint: "Creează un motiv nou pentru clasificarea rambursărilor.",
      successToast: "Motivul de rambursare {{label}} a fost creat.",
    },
    edit: {
      header: "Editează motivul de rambursare",
      subtitle: "Editează valoarea motivului de rambursare.",
      successToast: "Motivul de rambursare {{label}} a fost actualizat.",
    },
    delete: {
      confirmation:
        "Ești pe punctul de a șterge motivul de rambursare „{{label}}”. Acțiunea nu poate fi anulată.",
      successToast: "Motivul de rambursare a fost șters.",
    },
    fields: {
      label: {
        label: "Etichetă",
        placeholder: "Gest comercial",
      },
      code: {
        label: "Cod",
        placeholder: "gest_comercial",
      },
      description: {
        label: "Descriere",
        placeholder: "Clientul a avut o experiență de cumpărare neplăcută",
      },
    },
  },

  translations: {
    domain: "Traduceri",
    subtitle: "Gestionează traducerile datelor din magazin",
    settings: {
      header: "Gestionează entitățile traductibile",
      successToast: "Setările au fost actualizate",
    },
    actions: {
      manage: "Gestionează traducerile",
      manageEntities: "Gestionează entitățile",
      manageLocales: "Gestionează limbile",
    },
    list: {
      metrics: "{{translated}} din {{total}} traduceri",
    },
    edit: {
      successToast: "Traducerile au fost actualizate",
      unsavedChanges: {
        title: "Traduceri nesalvate",
        description: "Ai modificări care nu au fost încă salvate.",
      },
    },
    bulk: {
      header: "Editor de traduceri în masă",
      mainColumn: "Limbă",
    },
    activeLocales: {
      heading: "Limbi",
      subtitle: "Traduceri activate",
      noLocalesTip:
        "Configurează cel puțin o limbă pentru a începe traducerea datelor",
      noLocalesTipConfigureAction: "Configurează",
    },
    completion: {
      heading: "Câmpuri traduse",
      translated: "Traduse",
      toTranslate: "Lipsă",
      footer: "Limbi",
    },
  },

  store: {
    defaultLocale: "Limbă implicită",
    defaultSalesChannel: "Canal de vânzare implicit",
    defaultLocation: "Locație implicită",
    locales: "Limbi",
    localeAlreadyAdded: "Limba a fost deja adăugată în magazin.",
    removeLocaleWarning_one:
      "Ești pe punctul de a elimina {{count}} limbă din magazin. Orice traducere în această limbă va fi ștearsă.",
    removeLocaleWarning_other:
      "Ești pe punctul de a elimina {{count}} limbi din magazin. Orice traducere în aceste limbi va fi ștearsă.",
    toast: {
      localesUpdated: "Limbile au fost actualizate",
      localesRemoved: "Limbile au fost eliminate din magazin",
    },
  },

  salesChannels: {
    list: {
      empty: {
        heading: "Niciun canal de vânzare",
        description: "Canalele de vânzare create vor apărea aici.",
      },
      filtered: {
        heading: "Niciun rezultat",
        description: "Niciun canal de vânzare nu corespunde filtrelor.",
      },
    },
  },

  views: {
    save: "Salvează",
    saveAsNew: "Salvează ca vizualizare nouă",
    updateDefaultForEveryone: "Actualizează implicitul pentru toți",
    updateViewName: "Actualizează vizualizarea",
    prompts: {
      updateDefault: {
        title: "Actualizează vizualizarea implicită",
        description:
          "Asta schimbă vizualizarea implicită pentru toți utilizatorii. Ești sigur?",
        confirmText: "Actualizează pentru toți",
        cancelText: "Anulează",
      },
      updateView: {
        title: "Actualizează vizualizarea",
        description: "Sigur vrei să actualizezi „{{name}}”?",
        confirmText: "Actualizează",
        cancelText: "Anulează",
      },
    },
  },

  auth: {
    login: {
      authenticationFailed: "Autentificare eșuată",
      cloud: "Autentificare cu Medusa Cloud",
    },
  },
}
