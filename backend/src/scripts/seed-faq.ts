import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FAQ_MODULE } from "../modules/faq"
import type FaqModuleService from "../modules/faq/service"

type SeedItem = { question: string; answer: string }
type SeedCategory = {
  slug: string
  title: string
  description: string
  items: SeedItem[]
}

const SEED: SeedCategory[] = [
  {
    slug: "ordini-account",
    title: "Ordini & Account",
    description:
      "Come acquistare, gestire l'account e seguire lo stato dei tuoi ordini.",
    items: [
      {
        question: "Devo registrarmi per acquistare?",
        answer:
          "No. Puoi acquistare come ospite inserendo solo i dati necessari alla spedizione e alla fatturazione. Registrarti ti permette però di **seguire i tuoi ordini, salvare gli indirizzi** e velocizzare gli acquisti successivi.",
      },
      {
        question: "Come posso modificare o annullare un ordine?",
        answer:
          "Contattaci il prima possibile tramite [il modulo di contatto](/contatti) o per telefono. Se l'ordine non è ancora stato preso in carico dal corriere, possiamo modificare l'indirizzo o annullarlo. Una volta spedito, dovrai esercitare il diritto di recesso (vedi [Resi](/resi)).",
      },
      {
        question: "Ho dimenticato la password, come la reimposto?",
        answer:
          "Nella pagina di login clicca su **Password dimenticata?** e inserisci la mail con cui ti sei registrato. Ti invieremo un link per impostarne una nuova.",
      },
      {
        question: "Dove trovo le mie fatture e ricevute?",
        answer:
          "Nella tua **Area Personale → Ordini**. Se hai richiesto fattura, riceverai il documento via Sistema di Interscambio (SdI) all'indirizzo PEC o al codice destinatario che hai indicato.",
      },
    ],
  },
  {
    slug: "spedizioni-consegna",
    title: "Spedizioni e consegna",
    description: "Tempi, costi, zone servite, consegna al piano.",
    items: [
      {
        question: "Quali sono i tempi di consegna?",
        answer:
          "I prodotti **pronti in magazzino** vengono spediti entro 48–72 ore lavorative e consegnati in genere in 2–5 giorni in Italia continentale. I prodotti **realizzati su ordinazione** hanno tempi indicati nella scheda prodotto (di norma 3–6 settimane).",
      },
      {
        question: "Quanto costa la spedizione?",
        answer:
          "Il costo dipende dal volume e dalla destinazione. Lo vedrai in modo trasparente nel **carrello**, prima di completare l'ordine, ai sensi dell'art. 49 D.Lgs. 206/2005. Spedizioni in **isole, Calabria e zone disagiate** possono prevedere un supplemento indicato in fase di checkout.",
      },
      {
        question: "Cos'è la differenza tra consegna stradale e al piano?",
        answer:
          "- **Consegna stradale (standard)**: il corriere consegna a piano strada, davanti all'ingresso o al portone.\n- **Consegna al piano**: con due operatori che portano la merce all'interno dell'abitazione, anche ai piani superiori, su prenotazione. È un servizio aggiuntivo e prevede un costo extra mostrato in checkout.",
      },
      {
        question: "Cosa devo fare se il pacco arriva danneggiato?",
        answer:
          "Controlla l'imballo **prima di firmare**. Se vedi danni evidenti, **rifiuta la merce** oppure firma con la dicitura *\"accetto con riserva di controllo per danni esterni\"*. Scatta foto al pacco e contattaci entro **48 ore** dalla consegna tramite [il modulo di contatto](/contatti).",
      },
      {
        question: "Posso seguire la spedizione?",
        answer:
          "Sì. Appena il corriere prende in carico il pacco riceverai una mail con il **link di tracking**.",
      },
    ],
  },
  {
    slug: "pagamenti-fatturazione",
    title: "Pagamenti e Fatturazione",
    description: "Metodi di pagamento accettati, fattura, pagamento sicuro.",
    items: [
      {
        question: "Quali metodi di pagamento accettate?",
        answer:
          "Accettiamo **carte di credito/debito** (Visa, Mastercard, American Express) tramite Stripe, **bonifico bancario** e altri metodi indicati al checkout. Tutti i pagamenti con carta sono protetti dall'autenticazione forte del cliente (SCA) ai sensi della direttiva PSD2.",
      },
      {
        question: "I miei dati di pagamento sono al sicuro?",
        answer:
          "Sì. Non memorizziamo mai i dati della tua carta. I pagamenti sono gestiti da provider certificati **PCI-DSS Level 1** (Stripe).",
      },
      {
        question: "Posso richiedere fattura?",
        answer:
          "Sì. Al checkout puoi indicare **Ragione Sociale, Partita IVA, Codice Destinatario o PEC**. Per i clienti privati che ne fanno richiesta emetteremo fattura elettronica via Sistema di Interscambio (SdI). Per le imprese italiane la fattura elettronica è sempre obbligatoria.",
      },
    ],
  },
  {
    slug: "resi-rimborsi",
    title: "Resi e Rimborsi (diritto di recesso)",
    description: "Termini, modalità e tempi di rimborso.",
    items: [
      {
        question: "Posso restituire un prodotto?",
        answer:
          "Sì. Hai **14 giorni** dalla consegna per esercitare il diritto di recesso, ai sensi dell'art. 52 D.Lgs. 206/2005, **senza dover fornire alcuna motivazione**. Trovi la procedura completa nella [pagina Resi](/resi).",
      },
      {
        question: "Quanto tempo ci vuole per ricevere il rimborso?",
        answer:
          "Effettuiamo il rimborso entro **14 giorni** dal ricevimento della tua comunicazione di recesso, con lo **stesso metodo di pagamento** utilizzato per l'acquisto (art. 56 D.Lgs. 206/2005). Possiamo trattenere il rimborso fino a quando non riceviamo il prodotto reso, salvo che tu fornisca prova della spedizione.",
      },
      {
        question: "Chi paga le spese di restituzione?",
        answer:
          "Salvo diversa indicazione in promozione, **le spese di restituzione sono a carico del cliente** (art. 57 D.Lgs. 206/2005). Ti forniremo l'indirizzo a cui spedire e ti consigliamo un corriere assicurato per articoli di valore o ingombranti.",
      },
      {
        question: "Posso restituire un prodotto fatto su misura?",
        answer:
          "**No.** I prodotti realizzati su misura o chiaramente personalizzati su tua richiesta (es. dimensioni custom, finiture non a catalogo, tessuti su ordinazione) sono **esclusi dal diritto di recesso** ai sensi dell'art. 59 lett. c) D.Lgs. 206/2005. La scheda prodotto lo indica esplicitamente quando applicabile.",
      },
    ],
  },
  {
    slug: "garanzia",
    title: "Garanzia",
    description: "Garanzia legale di conformità e procedura di reclamo.",
    items: [
      {
        question: "Quanto dura la garanzia?",
        answer:
          "Tutti i prodotti venduti a consumatori beneficiano della **garanzia legale di conformità di 24 mesi** dalla consegna, ai sensi degli artt. 128 e seguenti D.Lgs. 206/2005 (come modificato dal D.Lgs. 170/2021).",
      },
      {
        question: "Cosa copre la garanzia legale?",
        answer:
          "La garanzia copre i **difetti di conformità** presenti al momento della consegna. Hai diritto a richiedere, a tua scelta, la **riparazione** o la **sostituzione** del bene; in caso di impossibilità o ritardo eccessivo, puoi chiedere una **riduzione del prezzo** o la **risoluzione del contratto**. Per i primi 12 mesi il difetto si presume esistente alla consegna, salvo prova contraria.",
      },
      {
        question: "Come attivo la garanzia?",
        answer:
          "Contattaci tramite [il modulo di contatto](/contatti) descrivendo il difetto e allegando foto/video. Ti risponderemo entro 24–48 ore lavorative con le istruzioni per il ritiro o la riparazione.",
      },
    ],
  },
  {
    slug: "montaggio-postvendita",
    title: "Montaggio e Post-vendita",
    description: "Istruzioni, ricambi, assistenza post-vendita.",
    items: [
      {
        question: "Offrite servizio di montaggio?",
        answer:
          "Per alcuni prodotti complessi è disponibile il **servizio di montaggio a domicilio** (a pagamento), selezionabile in checkout. Per i prodotti che richiedono solo assemblaggio semplice trovi le istruzioni in confezione e in formato PDF nella scheda prodotto.",
      },
      {
        question: "Dove trovo le istruzioni di montaggio?",
        answer:
          "Le trovi all'interno della confezione e scaricabili in PDF dalla **scheda prodotto**, sezione *Documenti*.",
      },
      {
        question: "Posso ordinare ricambi o pezzi mancanti?",
        answer:
          "Sì, scrivici a **[info@arredovita.it](mailto:info@arredovita.it)** o tramite [il modulo di contatto](/contatti) indicando il numero d'ordine e il pezzo necessario.",
      },
    ],
  },
  {
    slug: "prodotti-su-misura",
    title: "Prodotti su misura",
    description: "Personalizzazioni, tempi e condizioni speciali.",
    items: [
      {
        question: "Posso richiedere dimensioni personalizzate?",
        answer:
          "Per molti prodotti sì. La scheda prodotto indica le opzioni disponibili (dimensioni, tessuti, finiture). Per richieste specifiche, contattaci e ti faremo un preventivo dedicato.",
      },
      {
        question: "Quali sono i tempi di realizzazione su misura?",
        answer:
          "Dipende dalla complessità: in genere **3–8 settimane** dalla conferma dell'ordine. La data stimata di consegna ti viene comunicata in fase di preventivo.",
      },
      {
        question: "I prodotti su misura possono essere restituiti?",
        answer:
          "No. I prodotti realizzati su misura o chiaramente personalizzati sono **esclusi dal diritto di recesso** ai sensi dell'art. 59 lett. c) D.Lgs. 206/2005. Resta valida la **garanzia legale di conformità** di 24 mesi per eventuali difetti.",
      },
    ],
  },
  {
    slug: "contatti-reclami",
    title: "Contatti e Reclami",
    description: "Come raggiungerci e gestione dei reclami.",
    items: [
      {
        question: "Come posso contattarvi?",
        answer:
          "- **Modulo di contatto**: [/contatti](/contatti)\n- **Email**: info@arredovita.it\n- **Telefono**: indicato in [pagina contatti](/contatti)\n\nRispondiamo entro **24–48 ore lavorative** (lun–ven).",
      },
      {
        question: "Come posso presentare un reclamo formale?",
        answer:
          "Invia il reclamo per iscritto via email o PEC indicando numero d'ordine, descrizione del problema e documentazione (foto, video). Ti risponderemo entro 30 giorni con la nostra valutazione e proposta di soluzione.",
      },
      {
        question: "Se non troviamo un accordo?",
        answer:
          "Puoi rivolgerti volontariamente a un **organismo ADR** (Risoluzione Alternativa delle Controversie) iscritto presso il Ministero, ai sensi dell'art. 141 e seguenti D.Lgs. 206/2005. Resta sempre fermo il tuo diritto di rivolgerti al **giudice ordinario** competente.",
      },
    ],
  },
]

export default async function seedFaq({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const faqService = container.resolve(FAQ_MODULE) as FaqModuleService

  const existing = await faqService.listFaqCategories({})
  const existingBySlug = new Map(existing.map((c: any) => [c.slug, c]))

  let createdCats = 0
  let updatedCats = 0
  let createdItems = 0
  let updatedItems = 0

  for (let i = 0; i < SEED.length; i++) {
    const seed = SEED[i]
    const existingCat = existingBySlug.get(seed.slug)

    let categoryId: string
    if (existingCat) {
      categoryId = (existingCat as any).id
      await faqService.updateFaqCategories([
        {
          id: categoryId,
          title: seed.title,
          description: seed.description,
          display_order: i,
          is_published: true,
        },
      ])
      updatedCats++
    } else {
      const created = await faqService.createFaqCategories({
        slug: seed.slug,
        title: seed.title,
        description: seed.description,
        display_order: i,
        is_published: true,
      })
      categoryId = (created as any).id ?? (Array.isArray(created) ? created[0].id : null)
      createdCats++
    }

    const existingItems = await faqService.listFaqItems({ category_id: categoryId })
    const existingByQuestion = new Map(
      existingItems.map((it: any) => [it.question, it])
    )

    for (let j = 0; j < seed.items.length; j++) {
      const it = seed.items[j]
      const existing = existingByQuestion.get(it.question) as any | undefined
      if (existing) {
        // Upsert: aggiorna risposta, ordine e stato dal sorgente del seed.
        await faqService.updateFaqItems([
          {
            id: existing.id,
            answer: it.answer,
            display_order: j,
            is_published: true,
          },
        ])
        updatedItems++
      } else {
        await faqService.createFaqItems({
          question: it.question,
          answer: it.answer,
          display_order: j,
          is_published: true,
          category: categoryId,
        } as any)
        createdItems++
      }
    }
  }

  logger.info(
    `FAQ seed completato: ${createdCats} categorie create, ${updatedCats} aggiornate, ${createdItems} domande aggiunte, ${updatedItems} domande aggiornate.`
  )
}
