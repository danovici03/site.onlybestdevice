import { useQueryClient } from "@tanstack/react-query"

/**
 * Clientul react-query al dashboard-ului, dacă widgetul chiar rulează în
 * arborele lui. Îl folosim doar ca să împrospătăm pagina după salvare, deci
 * lipsa lui nu justifică un widget care crapă.
 */
export const useOptionalQueryClient = () => {
  try {
    return useQueryClient()
  } catch {
    return null
  }
}
