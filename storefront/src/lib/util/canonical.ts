const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "ro"

/**
 * `alternates` cu adresa canonică a unei pagini, prefixată cu regiunea.
 *
 * Relativă: `metadataBase` din layout o face absolută. Prefixul e obligatoriu —
 * `/categories/x` fără `/ro` face redirect pe `/ro/categories/x`, deci un
 * canonical fără el îi spune lui Google că pagina oficială e un redirect.
 */
export const canonical = (path: string, countryCode = DEFAULT_REGION) => ({
  canonical: `/${countryCode}${path}`,
})
