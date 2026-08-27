import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { DetailWidgetProps, AdminProduct } from "@medusajs/types"
import {
  Bookmarks,
  ReceiptPercent,
  ShieldCheck,
  Star,
  Tag,
} from "@medusajs/icons"
import { Container, Heading, TooltipProvider } from "@medusajs/ui"
import { ComponentProps, ReactNode } from "react"

import ProductFlagRow from "../components/product-flag-row"

/**
 * Cardul „Marcaje produs”: toate bifele de produs, într-un singur panou.
 *
 * Au fost patru widget-uri separate, fiecare cu antet propriu și două paragrafe
 * de explicații. În coloana dreaptă (~360px) textele se rupeau pe 6–8 rânduri,
 * deci patru switch-uri ocupau peste 800px de scroll. Aici rămâne o linie scurtă
 * per bifă, iar explicația lungă intră în tooltip — vezi `ProductFlagRow`.
 *
 * Valorile tagurilor sunt contract cu storefront-ul și cu scripturile de seed;
 * nu se redenumesc de aici singure.
 */

type Flag = Omit<ComponentProps<typeof ProductFlagRow>, "product"> & {
  /** Bifa se arată doar dacă asta lipsește sau întoarce `true`. */
  available?: (product: AdminProduct) => boolean
}

/** Produsul de serviciu însuși — el n-are cum să primească garanție pe el. */
const WARRANTY_HANDLE = "garantie-extinsa"

/**
 * Ordinea e explicită, nu alfabetică: întâi selecțiile redacționale care schimbă
 * ce se vede pe site, apoi proprietățile produsului, la final tagul inert.
 */
const FLAGS: Flag[] = [
  {
    // Secțiunea „Produse recomandate" de pe prima pagină e o selecție
    // redacțională, la fel ca Ofertele: produsele bifate aici urcă în fața
    // tabului lor. Cât timp nu e nimic bifat, secțiunea arată produsele recente
    // din fiecare categorie — deci bifa adaugă control, nu golește pagina dacă e
    // uitată. Tagul trebuie să rămână aliniat cu `FEATURED_TAG` din storefront
    // (`lib/data/rails.ts`).
    tag: "recomandat",
    icon: <Star />,
    title: "Recomandat",
    hint: "Urcă în fața tabului său, pe prima pagină.",
    details:
      "Produsele bifate apar primele în tabul categoriei lor. Fără nicio bifă, secțiunea arată cele mai noi produse din fiecare categorie.",
    onMessage: "Produs adăugat la Produse recomandate",
    offMessage: "Produs scos din Produse recomandate",
  },
  {
    // Aproape tot catalogul are un preț tăiat (`compare_at_price`), deci „are
    // reducere" nu poate fi criteriul de listare — pagina /oferte ar deveni tot
    // catalogul. Oferta e o selecție redacțională: intră doar ce e bifat aici.
    tag: "oferta",
    icon: <ReceiptPercent />,
    title: "Ofertă",
    hint: "Intră pe /oferte și primește badge-ul „Ofertă”.",
    details:
      "Doar produsele bifate apar pe pagina /oferte și primesc badge-ul „Ofertă” în listări. Prețul tăiat singur nu e suficient — aproape toate produsele au unul, așa că selecția o faci de aici.",
    onMessage: "Produs adăugat la Oferte",
    offMessage: "Produs scos din Oferte",
  },
  {
    // Spre deosebire de Ofertă sau Recomandat, aici lipsa bifei nu e o valoare
    // implicită rezonabilă, ci decizia: cardul cu +1 an / +2 ani apare pe pagina
    // produsului și în coș DOAR pentru produsele bifate. Un telefon o merită, o
    // husă de 30 lei nu — iar o garanție de 99 lei vândută pe un accesoriu e o
    // greșeală care ajunge la client.
    //
    // Tagul trebuie să rămână aliniat cu `WARRANTY_TAG` din storefront
    // (`lib/util/warranty.ts`) și din `scripts/seed-warranty-tag.ts`.
    tag: "garantie-extinsa",
    icon: <ShieldCheck />,
    title: "Garanție extinsă",
    hint: "Cardul cu +1 an / +2 ani apare la produs și în coș.",
    details:
      "Nebifat, cardul cu +1 an / +2 ani nu apare nici pe pagina produsului, nici în coș. Produsele sub pragul de preț nu-l arată oricum. Prețul celor două durate se pune în cardul „Preț” de mai jos; lăsat gol, produsul merge pe prețul standard din produsul „Garanție extinsă”.",
    onMessage: "Produsul poate primi garanție extinsă",
    offMessage: "Produsul nu mai primește garanție extinsă",
    // Fără garda asta, bifa apare și pe „Garanție extinsă", identică cu cea de
    // pe produsele reale. Bifat, produsul și-ar oferi singur garanție pe pagina
    // lui (încă accesibilă după handle, deși e ascuns din catalog).
    available: (product) => product.handle !== WARRANTY_HANDLE,
  },
  {
    tag: "outlet",
    icon: <Tag />,
    title: "Outlet / produs expus",
    // Badge-ul spune scurt ce spunea paragraful lung: nimic de pe site nu
    // citește încă tagul.
    badge: "intern",
    hint: "Produs expus în magazin sau folosit demonstrativ.",
    details:
      "Tehnic, aplică sau scoate tagul outlet de pe produs. Atenție: deocamdată site-ul nu afișează nimic pe baza acestui tag — rămâne o etichetă internă până adăugăm badge-ul și regulile de garanție pentru produsele expuse.",
    onMessage: "Produs marcat ca Outlet",
    offMessage: "Produs scos din Outlet",
  },
]

const ProductFlagsWidget = ({
  data: product,
}: DetailWidgetProps<AdminProduct>): ReactNode => (
  // `Tooltip` din @medusajs/ui randează `Radix.Root` fără provider propriu.
  // Dashboard-ul are deja unul mai sus, dar nested providers sunt permise și ne
  // scutesc de dependența de un detaliu intern al lui.
  <TooltipProvider>
    <Container className="divide-y p-0">
      <div className="flex items-center gap-3 px-6 py-4">
        <Bookmarks />
        <Heading level="h2">Marcaje produs</Heading>
      </div>
      <div className="divide-y">
        {FLAGS.filter((flag) => flag.available?.(product) ?? true).map(
          ({ available: _available, ...flag }) => (
            <ProductFlagRow key={flag.tag} product={product} {...flag} />
          )
        )}
      </div>
    </Container>
  </TooltipProvider>
)

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
})

export default ProductFlagsWidget
