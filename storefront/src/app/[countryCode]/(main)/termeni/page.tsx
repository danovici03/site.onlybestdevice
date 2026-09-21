import { Metadata } from "next"
import InfoPageLayout from "@modules/suport/components/info-page-layout"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { COMPANY } from "@lib/util/company-info"

export const metadata: Metadata = {
  title: "Termeni și condiții",
  description:
    "Termenii și condițiile de vânzare ONLY BEST DEVICE S.R.L.: comandă, plată, livrare, garanție, retur și regimul special de TVA pe marjă (art. 312 Cod Fiscal).",
}

const REVISION_DATE = "septembrie 2026"

export default function TermeniPage() {
  return (
    <InfoPageLayout
      eyebrow="Documente"
      title="Termeni și condiții"
      description={`Document actualizat în ${REVISION_DATE}. În caz de modificări, se aplică versiunea în vigoare la momentul comenzii.`}
      breadcrumbs={[{ label: "Acasă", href: "/" }, { label: "Termeni" }]}
    >
      <h2>Proprietatea conținutului</h2>
      <p>
        Îți mulțumim că ai ales produsele și serviciile noastre. Acestea îți
        sunt oferite de <strong>{COMPANY.ragioneSociale}</strong>, persoană
        juridică de naționalitate română, înmatriculată la Registrul Comerțului
        sub nr. {COMPANY.rea}, având cod unic de înregistrare fiscală{" "}
        {COMPANY.piva} („onlybestdevice” sau „operator” sau „noi”), care este
        operatorul datelor tale și entitatea care îți furnizează, prin
        intermediul magazinului online {COMPANY.baseUrl}, produse din
        categoriile tehnologie, electronice și electrocasnice.
      </p>
      <p>Ne poți contacta oricând la:</p>
      <p>
        Adresă: {COMPANY.sedeOperativa.via}, {COMPANY.sedeOperativa.citta},{" "}
        {COMPANY.sedeOperativa.cap}, jud. {COMPANY.adresaRetur.judet} · telefon{" "}
        {COMPANY.telefono}
        <br />
        E-mail: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      </p>
      <p>
        Prin utilizarea magazinului nostru virtual, ești de acord cu termenii și
        condițiile noastre. Te rugăm să îi citești cu atenție. Informarea ta cu
        privire la termenii și condițiile noastre va preceda orice act sau fapt
        de natură să determine obligații pentru părțile contractante.
      </p>
      <p>
        Produsele și serviciile noastre sunt variate și, prin urmare, este
        posibil ca uneori să se aplice termeni și condiții suplimentare.
      </p>
      <p>
        Termenii și condițiile generale prevăzute în continuare se aplică
        tuturor vânzărilor de bunuri și servicii oferite prin intermediul
        magazinului virtual {COMPANY.baseUrl}.
      </p>

      <h2>Utilizarea site-ului</h2>
      <p>
        Plasarea unei comenzi pentru achiziționarea unui produs se face sub
        rezerva acestor termeni și condiții. Expedierea produselor poate varia
        atât în funcție de disponibilitatea produselor, cât și de modalitatea de
        livrare aleasă. {COMPANY.dominio} nu se face vinovată de orice
        întârziere rezultată din cauza serviciului de curierat sau a unor
        situații de forță majoră.
      </p>
      <p>
        {COMPANY.dominio} garantează utilizatorului acces limitat, în interes
        personal, pe acest site și nu îi conferă dreptul de a descărca sau de a
        modifica parțial ori integral site-ul, de a reproduce parțial sau
        integral site-ul, de a copia, vinde sau exploata site-ul în scopuri
        comerciale sau contrare intereselor noastre, fără acordul nostru scris.
      </p>

      <h2>Condiții de utilizare</h2>
      <p>
        Folosirea, incluzând vizitarea și cumpărarea produselor de pe site-ul{" "}
        {COMPANY.baseUrl}, implică acceptarea termenilor și condițiilor
        detaliate în prezentul document.
      </p>
      <p>
        {COMPANY.dominio} furnizează serviciile care fac obiectul termenilor și
        condițiilor de mai jos și își desfășoară activitatea de vânzare în
        conformitate cu legea română. Pentru folosirea în cele mai bune condiții
        a site-ului, care este întreținut și administrat de {COMPANY.dominio},
        se recomandă citirea cu atenție a acestor termeni și condiții.{" "}
        {COMPANY.dominio} își asumă dreptul de a efectua orice modificări ale
        acestor prevederi, precum și orice modificări ale site-ului{" "}
        {COMPANY.baseUrl}, ale structurii acestuia sau orice alte modificări ce
        ar putea afecta site-ul, fără a fi necesară o notificare prealabilă
        către utilizatori în acest sens.
      </p>
      <p>
        Site-ul {COMPANY.baseUrl} nu va putea fi făcut responsabil pentru
        eventualele erori apărute pe site din orice cauză, inclusiv din cauza
        unor modificări, setări, upgrade-uri etc.
      </p>
      <p>
        {COMPANY.dominio} nu răspunde de conținutul, calitatea sau natura
        site-urilor la care se ajunge prin legături de pe site-ul{" "}
        {COMPANY.baseUrl}, indiferent de natura acestor legături. Pentru
        respectivele site-uri, răspunderea o poartă integral proprietarii
        site-urilor în cauză.
      </p>

      <h2>Comunicări electronice</h2>
      <p>
        Prin accesarea site-ului {COMPANY.baseUrl}, folosirea, vizitarea,
        cumpărarea de produse sau trimiterea de e-mailuri adresate{" "}
        {COMPANY.dominio}, comunicarea se realizează în mod electronic,
        considerându-se astfel că utilizatorul consimte primirea notificărilor
        de la {COMPANY.dominio} în modalitate electronică, incluzând și
        comunicări prin e-mail sau prin anunțuri/opinii pe site.
      </p>
      <p>
        Comunicările comerciale prin poștă electronică primite din partea
        noastră se realizează în cazul în care destinatarul și-a exprimat în
        prealabil consimțământul expres pentru a primi asemenea comunicări.
        Destinatarul comunicărilor comerciale are dreptul de a-și revoca
        consimțământul de a primi asemenea comunicări prin simpla notificare a
        furnizorului. Revocarea efectivă a comunicării comerciale se realizează
        din cutia poștală electronică a destinatarului.
      </p>
      <p>
        {COMPANY.dominio} nu furnizează adresa ta de e-mail unor terți, nu
        încurajează spam-ul și nu face publice datele furnizate de clienții săi
        fără acordul explicit al acestora. Orice utilizator are posibilitatea să
        șteargă din baza de date adresa de e-mail furnizată. Ne rezervăm dreptul
        de a ne selecta clienții.
      </p>
      <p>
        Nu este considerată „spam” trimiterea unor e-mailuri de comunicări
        comerciale de către {COMPANY.dominio} către cumpărător dacă acestea sunt
        trimise cu acordul destinatarului.
      </p>

      <h2>Securitatea informațiilor</h2>
      <p>
        {COMPANY.dominio} garantează securitatea și confidențialitatea datelor
        găzduite și transmise prin sistemul său informatic. {COMPANY.dominio} nu
        își asumă însă responsabilitatea pentru pierderile de informații cauzate
        de orice defecțiuni sau erori ale softului cu care este conceput și
        găzduit site-ul și nici nu garantează faptul că site-ul,
        serverul/serverele sau e-mailurile expediate de {COMPANY.dominio} nu
        conțin viruși sau alte componente dăunătoare.
      </p>
      <p>
        {COMPANY.dominio} nu solicită și nu stochează niciun fel de detalii
        referitoare la cardul bancar. Procesarea datelor de card se face
        exclusiv pe platforma securizată a procesatorului{" "}
        <strong>Netopia Payments</strong>, unde îți introduci datele cardului.
        Cererile de finanțare în rate sunt procesate pe platformele partenerilor
        de creditare — <strong>TBI Bank</strong> și{" "}
        <strong>UniCredit Consumer Financing</strong> — cărora le transmitem
        doar datele necesare analizei cererii tale.
      </p>

      <h2>Prețuri și plăți</h2>
      <p>
        Toate prețurile sunt exprimate în lei (RON) și sunt prețuri finale către
        consumator. Pentru o parte dintre produse se aplică regimul special de
        TVA la marja de profit, descris la secțiunea{" "}
        <em>Originea produselor</em> de mai jos; în acest caz TVA nu se
        evidențiază distinct pe factură.
      </p>
      <p>
        Taxa de transport este afișată separat în coș, înainte de plasarea
        comenzii, și este inclusă în totalul comenzii. La plata cu cardul, în
        rate sau prin ordin de plată, transportul se achită odată cu produsele,
        în aceeași tranzacție. La plata la livrare (ramburs), curierul încasează
        o singură sumă — produsele și transportul — și reține taxa de transport.
      </p>
      <p>
        Sunt acceptate metodele de plată afișate la finalizarea comenzii: card
        bancar, plata în rate prin partenerii noștri de creditare, ordin de
        plată (transfer bancar) și plata la livrare (ramburs). Plățile cu cardul
        sunt procesate de furnizori autorizați, cu autentificare securizată
        conform normelor în vigoare.
      </p>

      <h2>Livrare</h2>
      <p>
        Modalitățile, termenele și costurile de livrare sunt descrise pe pagina{" "}
        <LocalizedClientLink href="/livrare">
          Livrarea comenzilor
        </LocalizedClientLink>{" "}
        și sunt comunicate înainte de încheierea contractului. Taxa de transport
        este inclusă în totalul comenzii. Eventualele întârzieri cauzate de
        forță majoră (greve ale curierilor, evenimente naturale, restricții
        administrative) nu constituie neexecutare.
      </p>

      <h2>Condiții generale de rezolvare a garanțiilor</h2>
      <p>
        Pentru a beneficia de garanție, clientul trebuie să prezinte documentul
        de achiziție al produsului (factura) și certificatul de garanție care
        conține seria sau IMEI-ul produsului achiziționat.
      </p>
      <p>
        Toate produsele comercializate de către magazinul online{" "}
        {COMPANY.dominio} beneficiază de condiții de garanție conforme
        legislației românești în vigoare (OG 21/1992, OUG 140/2021 și OUG
        174/2008).
      </p>
      <p>
        În funcție de situația fiecărui bun, produsele comercializate pot avea
        următoarele categorii juridice:
      </p>
      <ul>
        <li>
          produse noi, aflate în stare sigilată sau desigilate ulterior
          achiziției de către proprietarul inițial;
        </li>
        <li>produse folosite (second-hand), cu grad de uzură variabil;</li>
        <li>
          produse recondiționate (refurbished), care au fost supuse unor
          verificări tehnice și, după caz, unor intervenții de întreținere sau
          reparare.
        </li>
      </ul>

      <h3>Garanția legală de conformitate</h3>
      <p>
        Se referă la protecția juridică a consumatorului rezultată prin efectul
        legii în raport cu lipsa de conformitate, reprezentând obligația legală
        a vânzătorului față de consumator ca, fără solicitarea unor costuri
        suplimentare, să aducă produsul la conformitate, incluzând restituirea
        prețului plătit de consumator, repararea sau înlocuirea produsului, dacă
        acesta nu corespunde cu specificațiile pe care el s-a angajat că le
        vinde sau în publicitatea aferentă.
      </p>
      <p>
        Răspunderea vânzătorului privind garanția legală de conformitate,
        potrivit prevederilor art. 9 alin. 1 din OUG 140/2021, este angajată
        dacă lipsa de conformitate apare într-un termen de 2 ani, calculat de la
        livrarea produsului. Pentru produsele a căror durată medie de utilizare
        este mai mică de 2 ani, acest termen se va reduce la durata medie de
        utilizare.
      </p>
      <p>
        În primul an de la livrarea bunului, consumatorul nu trebuie să
        dovedească neconformitatea, deoarece se consideră că a existat la data
        cumpărării, până la proba contrarie sau cu excepția cazurilor când
        această prezumție este incompatibilă cu natura bunului sau a
        neconformității. Pentru perioada cuprinsă între 12 luni și 24 de luni de
        la livrare, lipsa conformității va trebui să fie dovedită de către
        consumator.
      </p>
      <p>
        Garanția de conformitate și durata medie de utilizare este de 12 luni
        pentru persoanele juridice și alți profesioniști (persoane fizice
        autorizate, liber-profesioniști etc.).
      </p>

      <h3>Garanția comercială</h3>
      <p>
        Așa cum este definită de art. 2 alin. 12 din OUG 140/2021, garanția
        comercială este „orice angajament din partea garantului față de
        consumator, prevăzut în certificatul de garanție sau în publicitatea
        disponibilă în momentul sau înaintea încheierii contractului, în plus
        față de obligațiile legale care îi revin vânzătorului referitoare la
        garanția de conformitate, de a rambursa prețul plătit sau de a înlocui,
        a repara ori a întreține bunurile în orice mod, în cazul în care acestea
        nu corespund specificațiilor sau oricărei alte cerințe care nu este
        legată de conformitate”. Se adresează consumatorilor și poate fi
        diferită pentru diverse loturi de produse în funcție de existența sau nu
        a unor promoții și este oferită de producător, distribuitor sau vânzător
        în condițiile specificate în declarațiile referitoare la garanție și în
        publicitatea aferentă fiecărui produs.
      </p>
      <p>
        În cazul extinderilor de garanție condiționate de înscrierea pe site
        într-o perioadă de timp limitată, sarcina probei revine cumpărătorului.
        De asemenea, pentru a beneficia de garanția comercială, consumatorul are
        în sarcină să dețină documentele (factura, bonul și certificatul de
        garanție) din care să reiasă clar datele de identificare ale produsului
        și durata clară a garanției comerciale oferite; în caz contrar se pierde
        dreptul la această garanție.
      </p>

      <h3>Garanția legală (tehnică)</h3>
      <p>
        Certificatul de garanție emis pe baza garanției comerciale trebuie să
        precizeze elementele de identificare a produsului, termenul de garanție,
        durata medie de utilizare, modalitățile de asigurare a garanției —
        întreținere, reparare, înlocuire — și termenul de realizare a acestora,
        denumirea și adresa vânzătorului sau ale unității specializate de
        service. În cazul certificatelor de garanție emise de producător sau
        importator în care unitățile de service sunt precizate explicit,
        produsele defecte pot fi trimise sau predate de client la centrul de
        service indicat în certificat pentru acordarea garanției.
      </p>
      <p>
        Cele 15 zile în care este soluționată problema neconformității
        produsului decurg din momentul în care este înregistrat în service, din
        a doua zi în care coletul ajunge la punctul de lucru.
      </p>
      <p>
        În momentul sosirii coletelor în serviciul specializat se va face o
        scurtă verificare vizuală a coletului în prezența curierului. Dacă se
        constată urme de loviri sau manipulări defectuoase ale coletului, sau
        dacă starea acestuia nu este impecabilă din punct de vedere al
        integrității, se va face un proces-verbal care să semnaleze aceste
        probleme, iar o copie va fi înmânată curierului. Toate coletele primite
        care respectă aceste condiții de preluare în garanție vor fi desfăcute
        și fotografiate pentru a consemna starea la recepție a produselor și
        pentru a verifica dacă starea produselor este identică cu cea declarată
        de client la trimiterea coletului. Orice inadvertență între starea
        declarată de client la completarea formularului și recepția
        propriu-zisă a produselor de către personalul nostru specializat va
        conduce la eliminarea acelor defecte din lista celor acoperite de
        garanție, {COMPANY.dominio} neputând fi făcută răspunzătoare de acele
        defecte apărute în timpul transportului. Este posibil ca starea
        produsului recepționat la garanție să nu permită înlocuirea acestuia
        decât după remedierea defectelor apărute pe timpul transportului, caz în
        care clientul va fi înștiințat de aceste costuri, el putând alege între
        înlocuire și reparare cu plata acestor costuri sau returnarea
        contravalorii produsului mai puțin costurile respective.
      </p>
      <p>
        După readucerea produsului în stare de funcționare, clientul are
        posibilitatea de a ridica produsul direct din centrul de service{" "}
        {COMPANY.dominio} sau să solicite expedierea sa prin curier. Timpul de
        nefuncționare prelungește în mod corespunzător termenul de garanție.
        Acest interval se consideră din momentul înregistrării în unitatea de
        service (recepția coletului conform indicațiilor de mai sus), până la
        aducerea produsului în stare de utilizare normală și notificarea în
        scris, în vederea ridicării produsului, sau până la predarea efectivă a
        produsului către client.
      </p>
      <p>
        În cazul solicitărilor nejustificate, se percepe o taxă de constatare în
        valoare de <strong>40 RON</strong>, precum și plata transportului
        dus-întors.
      </p>
      <p>
        Nu fac obiectul garanției produsele care au etichete sau sigilii de
        garanție deteriorate, îndepărtate sau modificate, produsele utilizate în
        condiții neadecvate (tensiuni de alimentare necorespunzătoare, supunerea
        la variații mari de temperatură și presiune, șocuri mecanice, manipulare
        incorectă, utilizarea produselor în condiții de umiditate, praf, noxe
        sau sub acțiunea substanțelor chimice etc.), setări și instalări
        incorecte, surse defecte, prize fără împământare, pătrunderea de
        lichide, metale sau alte substanțe în interiorul echipamentelor,
        intervenția mecanică asupra produselor, conectarea sau deconectarea
        anumitor componente în timpul funcționării echipamentelor. Ne rezervăm
        dreptul de a refuza preluarea unui produs în service dacă nu se poate
        face dovada că programele instalate sunt licențiate.
      </p>
      <p>
        Modalitățile de activare a garanției și remediile disponibile sunt
        descrise pe pagina{" "}
        <LocalizedClientLink href="/garantie">
          Garanție și service
        </LocalizedClientLink>
        .
      </p>

      <h2>Returnarea produselor</h2>
      <p>
        Conform legislației românești în vigoare, renunțarea la cumpărare prin
        denunțarea unilaterală a contractului este aplicabilă doar consumatorilor
        clienți persoane fizice (OUG 34/2014 art. 2 alin. 1).
      </p>
      <p>
        Consumatorul are dreptul să notifice, prin metodele disponibile,
        comerciantului că renunță la cumpărare, fără penalități și fără
        invocarea unui motiv, în termen de <strong>14 zile</strong> de la
        primirea produsului sau, în cazul prestărilor de servicii, de la
        încheierea contractului (OUG 34/2014 art. 9 alin. 1).
      </p>
      <p>
        Încheierea contractului de vânzare-cumpărare are loc în momentul
        emiterii facturii fiscale (acest document ține loc de contract conform
        legislației românești) și nu la plasarea comenzii sau la trimiterea prin
        e-mail (ori alte mijloace de comunicare) a confirmării automate de
        primire a comenzii.
      </p>
      <p>
        Pentru returnarea banilor în întregime (suma achitată), produsele
        returnate trebuie să fie în aceeași stare în care au fost livrate (în
        ambalajul original nedeteriorat, cu toate accesoriile și documentele
        care l-au însoțit, fără să prezinte modificări fizice, lovituri,
        zgârieturi etc.).
      </p>
      <p>
        Cheltuielile directe de returnare a produselor vor fi suportate de
        client, iar rambursarea contravalorii acestora se va face în cel mult 14
        zile de la data denunțării și numai prin transfer bancar.
      </p>
      <p>
        Produsele marca Apple (iPhone, iPad, iPod etc.) al căror software a fost
        activat nu pot fi returnate în termenul legal de 14 zile decât în cazul
        unui eventual defect de fabricație.
      </p>
      <p>
        Produsele ce urmează a fi returnate nu vor fi primite de către
        service-ul specializat {COMPANY.dominio} decât ambalate corespunzător.
        Cele 14 zile în care vom rambursa contravaloarea produselor se scurg din
        momentul în care formularul de denunțare unilaterală a contractului, cu
        număr de autorizare și semnat de către client, ajunge în posesia
        serviciului nostru specializat împreună cu produsele returnate.
      </p>
      <p>
        În momentul sosirii coletelor în serviciul specializat se va face o
        scurtă verificare vizuală a coletului în prezența curierului. Dacă se
        constată urme de loviri sau manipulări defectuoase ale coletului, sau
        dacă starea acestuia nu este impecabilă din punct de vedere al
        integrității, se va face un proces-verbal care să semnaleze aceste
        probleme, iar o copie va fi înmânată curierului. Toate coletele primite
        care respectă aceste condiții de retur vor fi desfăcute și fotografiate
        pentru a consemna starea la recepție a produselor și pentru a verifica
        dacă starea produselor este identică cu cea declarată de client la
        trimiterea coletului. Orice inadvertență între starea declarată de
        client la completarea formularului de retur și recepția propriu-zisă a
        produselor de către personalul nostru specializat va conduce la
        eliminarea acelor defecte din lista celor acoperite, {COMPANY.dominio}{" "}
        neputând fi făcută răspunzătoare de acele defecte apărute în timpul
        transportului.
      </p>
      <p>
        Procedura completă și formularul de retragere sunt descrise pe pagina{" "}
        <LocalizedClientLink href="/retur">Retur produse</LocalizedClientLink>,
        parte integrantă a prezentelor condiții.
      </p>

      <h2>
        Originea produselor. Regimul juridic al comercializării. TVA — regim
        special (marjă de profit)
      </h2>

      <h3>1. Proveniența produselor comercializate</h3>
      <p>
        (1) Produsele oferite spre vânzare de către {COMPANY.ragioneSociale},
        atât în magazinul fizic, cât și prin intermediul platformei online{" "}
        {COMPANY.baseUrl}, provin în principal din achiziții realizate de la
        persoane juridice și persoane fizice în baza unor contracte de
        vânzare-cumpărare, sau sunt preluate în regim de consignație, în
        conformitate cu legislația civilă și fiscală aplicabilă.
      </p>
      <p>
        (2) În funcție de situația fiecărui bun, produsele comercializate pot
        avea următoarele categorii juridice: produse noi, aflate în stare
        sigilată sau desigilate ulterior achiziției de către proprietarul
        inițial; produse folosite (second-hand), cu grad de uzură variabil;
        produse recondiționate (refurbished), care au fost supuse unor
        verificări tehnice și, după caz, unor intervenții de întreținere sau
        reparare.
      </p>
      <p>
        (3) {COMPANY.ragioneSociale} efectuează o verificare amănunțită și în
        detaliu a conformității produselor la momentul preluării, însă, având în
        vedere proveniența acestora din surse private, nu poate garanta exclusiv
        istoricul complet de utilizare, intervențiile anterioare sau eventualele
        vicii ascunse nedetectabile la data recepției.
      </p>

      <h3>2. Regimul juridic al produselor preluate în consignație</h3>
      <p>
        (1) În cazul produselor preluate în regim de consignație, dreptul de
        proprietate asupra bunului aparține în continuare persoanei fizice care
        l-a predat, până la momentul transferului către cumpărătorul final.
      </p>
      <p>
        (2) {COMPANY.ragioneSociale} acționează în această situație în calitate
        de consignatar, având rolul de a expune, promova și comercializa bunul
        în numele și pe seama proprietarului, conform prevederilor Codului civil
        privind contractul de consignație.
      </p>
      <p>(3) În această calitate:</p>
      <ul>
        <li>
          {COMPANY.ragioneSociale} nu garantează pentru eventuale vicii ascunse
          care nu puteau fi identificate printr-o verificare rezonabilă la
          momentul predării bunului;
        </li>
        <li>
          proprietarul bunului rămâne responsabil pentru exactitatea
          informațiilor furnizate cu privire la starea tehnică, proveniență și
          conformitate.
        </li>
      </ul>

      <h3>3. Regimul juridic al produselor achiziționate de la persoane fizice</h3>
      <p>
        (1) Pentru produsele achiziționate în mod direct de la persoane fizice,
        dreptul de proprietate se transferă către {COMPANY.ragioneSociale} la
        data cumpărării, conform contractului încheiat.
      </p>
      <p>
        (2) Ulterior achiziției, {COMPANY.ragioneSociale} comercializează
        produsele în calitate de vânzător profesionist, asumându-și obligațiile
        ce decurg din legislația privind protecția consumatorilor, în limita
        naturii bunului și a informațiilor disponibile.
      </p>

      <h3>4. Regimul fiscal aplicabil. TVA — regim special (marjă de profit)</h3>
      <p>
        (1) Pentru o parte dintre produsele comercializate,{" "}
        {COMPANY.ragioneSociale} aplică Regimul special pentru bunuri
        second-hand, obiecte de artă, de colecție sau antichități, reglementat
        de art. 312 din Codul fiscal și de Directiva 2006/112/CE privind
        sistemul comun al TVA.
      </p>
      <p>(2) Regimul special TVA-marjă se aplică exclusiv produselor achiziționate de la:</p>
      <ul>
        <li>persoane fizice neînregistrate în scopuri de TVA;</li>
        <li>alte entități care nu au colectat TVA pentru respectivele bunuri;</li>
        <li>furnizori care aplică același regim special.</li>
      </ul>
      <p>(3) În cadrul regimului special:</p>
      <ul>
        <li>TVA se aplică doar asupra marjei de profit realizate de comerciant;</li>
        <li>
          marja reprezintă diferența dintre prețul de vânzare și prețul de
          achiziție al produsului;
        </li>
        <li>
          TVA nu se evidențiază în mod distinct pe factură, conform art. 312
          alin. (10) Cod fiscal.
        </li>
      </ul>
      <p>
        (4) Factura emisă în acest regim va conține, conform obligațiilor
        legale, mențiunea: „TVA inclusă în marja de profit — Regim special
        conform art. 312 Cod fiscal.”
      </p>
      <p>
        (5) Clientul înțelege și acceptă faptul că, în cazul bunurilor vândute
        sub regim special, nu se poate deduce TVA, întrucât acesta nu este
        evidențiat separat și nu reprezintă o taxă aferentă valorii integrale a
        bunului.
      </p>

      <h3>5. Caracteristicile bunurilor și transparența informațiilor</h3>
      <p>
        (1) Dat fiind specificul aprovizionării (achiziții de la persoane fizice
        și bunuri cu uzură variabilă), caracteristicile, gradul de utilizare,
        accesoriile incluse și istoricul pot diferi de la un produs la altul.
      </p>
      <p>
        (2) {COMPANY.ragioneSociale} se obligă să ofere, în măsura informațiilor
        disponibile și a verificărilor efectuate: o descriere clară și obiectivă
        a stării produsului; fotografii reale la cerere; mențiuni privind
        eventuale defecte, intervenții, uzură sau particularități.
      </p>
      <p>
        (3) Cumpărătorul declară că înțelege natura produselor comercializate și
        acceptă că unele bunuri pot prezenta uzură sau limitări inerente stării
        lor de second-hand sau refurbished.
      </p>

      <h3>6. Garanția legală și comercială</h3>
      <p>
        (1) Garanția oferită este stabilită în funcție de natura produsului și
        proveniența acestuia, conform OUG nr. 140/2021 și normelor aplicabile
        bunurilor second-hand.
      </p>
      <p>
        (2) Termenul de garanție se comunică individual pentru fiecare produs,
        iar pentru bunurile second-hand poate fi mai redus, în conformitate cu
        legea, fără a putea fi inferior limitei minime prevăzute de normele
        legale aplicabile.
      </p>
      <p>
        (3) Pentru produsele în regim de consignație, garanția este acordată de{" "}
        {COMPANY.ragioneSociale} exclusiv în măsura în care defecțiunile pot fi
        asociate uzurii normale și nu pot fi atribuite unor intervenții sau
        utilizări anterioare necomunicate de proprietar.
      </p>

      <h2>Răspundere</h2>
      <p>
        Depunem maximă diligență în descrierea și prezentarea produselor.
        Specificațiile și imaginile sunt furnizate de producători și pot suferi
        mici variații. În limitele permise de lege, răspunderea noastră față de
        consumator este limitată la prețul produsului, rămânând neatinse
        drepturile imperative ale consumatorului prevăzute de lege.
      </p>

      <h2>Soluționarea litigiilor</h2>
      <p>
        Pentru orice litigiu te invităm să ne contactezi întâi, pentru o
        soluționare amiabilă. Conform OG 38/2015, te poți adresa în mod voluntar
        unei entități de soluționare alternativă a litigiilor (SAL). Autoritatea
        competentă este{" "}
        <a href="https://anpc.ro/" target="_blank" rel="noreferrer">
          ANPC
        </a>{" "}
        (Autoritatea Națională pentru Protecția Consumatorilor), iar platforma
        europeană de soluționare online a litigiilor (SOL) este disponibilă la{" "}
        <a
          href="https://ec.europa.eu/consumers/odr"
          target="_blank"
          rel="noreferrer"
        >
          ec.europa.eu/consumers/odr
        </a>
        .
      </p>

      <h2>Legea aplicabilă</h2>
      <p>
        Prezentele condiții și contractele încheiate prin site sunt guvernate de
        legea română. Pentru litigiile derivate din contract sunt competente
        instanțele de la domiciliul consumatorului, conform legii.
      </p>

      <h2>Modificări</h2>
      <p>
        Ne rezervăm dreptul de a modifica prezentele condiții oricând;
        modificările intră în vigoare la momentul publicării pe site și se
        aplică comenzilor ulterioare. Versiunea aplicabilă comenzii tale este
        cea în vigoare la momentul confirmării comenzii.
      </p>

      <hr />
      <p className="text-xs text-brand-dark/50">
        Document actualizat în {REVISION_DATE}.
      </p>
    </InfoPageLayout>
  )
}
