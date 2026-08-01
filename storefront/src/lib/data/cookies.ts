import "server-only"
import { cookies as nextCookies } from "next/headers"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_jwt")?.value

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

/**
 * ATENȚIE: fără `cookies()` aici. Tag-urile astea ajung pe fetch-urile din
 * paginile partajate (catalog), iar orice apel `cookies()` la prerender —
 * chiar prins în try/catch — marchează ruta dinamică și anulează tot cache-ul.
 * Vechea variantă lipea `_medusa_cache_id` (per sesiune) de tag; cum fetch-ul
 * și revalidarea folosesc acum același tag global, invalidarea funcționează
 * la fel, doar că pentru toți vizitatorii odată — exact ce vrem la un catalog
 * comun.
 */
export const getCacheTag = async (tag: string): Promise<string> => {
  return tag
}

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== "undefined") {
    return {}
  }

  return { tags: [tag] }
}

/**
 * Cookie martor, citibil din client. `_medusa_jwt` și `_medusa_cart_id` sunt
 * httpOnly, deci browserul nu poate ști singur dacă vizitatorul are cont sau
 * coș. Fără martor, `SessionProvider` ar cere `/api/session` la fiecare
 * vizitator — inclusiv la cei veniți prima dată și la crawlere, care sunt
 * majoritatea traficului. Nu conține nimic secret: doar „1”.
 */
const SESSION_MARKER = "_medusa_session"

const setSessionMarker = async (present: boolean) => {
  const cookies = await nextCookies()
  cookies.set(SESSION_MARKER, present ? "1" : "", {
    maxAge: present ? 60 * 60 * 24 * 7 : -1,
    httpOnly: false, // trebuie citit din browser
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
  await setSessionMarker(true)
}

export const removeAuthToken = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", "", {
    maxAge: -1,
  })
  // Martorul acoperă și contul, și coșul: rămâne pus dacă mai există coș.
  await setSessionMarker(!!cookies.get("_medusa_cart_id")?.value)
}

export const getCartId = async () => {
  const cookies = await nextCookies()
  return cookies.get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
  await setSessionMarker(true)
}

export const removeCartId = async () => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", "", {
    maxAge: -1,
  })
  await setSessionMarker(!!cookies.get("_medusa_jwt")?.value)
}
