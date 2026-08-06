/**
 * Oprește build-ul când lista de căi prerandate nu poate fi construită.
 *
 * `generateStaticParams` prindea eroarea și întorcea `[]`, adică „n-am nicio
 * cale de prerandat" — build-ul ieșea verde, dar deployul rămânea fără nicio
 * pagină de categorie, colecție sau produs prerandată.
 *
 * Consecința nu e doar „mai lent la prima cerere": paginile de categorie și de
 * colecție citesc `searchParams` (filtre, sortare, pagină). Pentru o cale care
 * NU e în manifestul de prerandare, Next le randează la cerere în regim
 * static, iar acolo `searchParams` e API dinamic — randarea crapă cu
 * `DYNAMIC_SERVER_USAGE` și clientul primește 500 pe fiecare categorie.
 *
 * S-a întâmplat pe 6 august 2026: build-ul de pe Vercel a prins backend-ul în
 * timpul unui redeploy (Traefik răspunde 404 cât timp containerul nu e sus),
 * cele trei liste au ieșit goale, iar /categories/* a servit 500 până la
 * următorul deploy — deși backend-ul își revenise în două minute.
 *
 * De aceea eșecul e acum fatal: Vercel păstrează deployul anterior, care
 * funcționează. Un build fără catalog nu merită publicat.
 */
export const failStaticParams = (what: string, error: unknown): never => {
  const reason = error instanceof Error ? error.message : String(error)
  throw new Error(
    `Nu am putut construi căile statice pentru ${what}: ${reason}. ` +
      `Build-ul se oprește intenționat — fără prerandare, paginile astea ` +
      `răspund 500 în producție. Verifică MEDUSA_BACKEND_URL, cheia ` +
      `publicabilă și că backend-ul e pornit, apoi reia build-ul.`
  )
}
