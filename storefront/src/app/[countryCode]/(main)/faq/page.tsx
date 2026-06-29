import { Metadata } from "next"
import { listFaq } from "@lib/data/faq"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import FaqClient from "@modules/suport/components/faq-client"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "Întrebări frecvente (FAQ) | onlybestdevice",
  description:
    "Toate răspunsurile despre comenzi, livrare, plăți, retururi și garanție. Caută în FAQ sau navighează pe categorii.",
}

export default async function FaqPage() {
  const categories = await listFaq()

  return (
    <InfoPageLayout
      eyebrow="Suport clienți"
      title="Întrebări frecvente"
      description="Caută printre întrebările frecvente sau navighează pe categorii. Dacă nu găsești ce cauți, contactează-ne."
      breadcrumbs={[
        { label: "Acasă", href: "/" },
        { label: "Suport", href: "/suport" },
        { label: "FAQ" },
      ]}
    >
      {categories.length === 0 ? (
        <div className="not-prose rounded-3xl bg-brand-dark/[0.03] p-8 text-center">
          <p className="text-brand-dark/70 mb-4">
            Întrebările frecvente sunt în curs de completare. Între timp ne poți
            scrie prin formularul de contact.
          </p>
          <LocalizedClientLink
            href="/contact"
            className="inline-block px-6 py-2.5 rounded-full bg-brand-dark text-white font-semibold hover:bg-brand-accent transition-colors"
          >
            Mergi la contact
          </LocalizedClientLink>
        </div>
      ) : (
        <div className="not-prose">
          <FaqClient categories={categories} />

          <div className="mt-16 rounded-3xl bg-brand-dark text-white p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Nu ai găsit răspunsul?
            </h2>
            <p className="text-white/70 mb-6">
              Echipa noastră îți stă la dispoziție.
            </p>
            <LocalizedClientLink
              href="/contact"
              className="inline-block px-8 py-3 rounded-full bg-white text-brand-dark font-semibold hover:bg-brand-accent hover:text-white transition-colors"
            >
              Contactează-ne
            </LocalizedClientLink>
          </div>
        </div>
      )}
    </InfoPageLayout>
  )
}
