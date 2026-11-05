import { z } from "zod"

import { isValidCnp, normalizeCnp } from "./cnp"

/**
 * Datele pentru borderoul de achiziție (cumpărare de la persoană fizică).
 * Le cerem abia când oferta finală e acceptată: cine primește refuz la
 * verificare nu-și lasă niciodată CNP-ul la noi.
 */
export const IdentitySchema = z.object({
  cnp: z.string().refine(isValidCnp, "CNP invalid").transform(normalizeCnp),
  id_document: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/\s+/g, " "))
    .pipe(z.string().regex(/^[A-Z]{1,3} ?\d{6,9}$/, "Seria și numărul actului sunt invalide")),
  home_address: z.string().trim().min(5).max(250),
})

/** Oferta e finală și acceptată, dar lipsesc datele pentru act. */
export const needsIdentity = (o: { status: string; cnp?: string | null }) => o.status === "accepted" && !o.cnp

/** AWB Fan Courier: cifre, eventual litere; spațiile se scot. */
export const AwbSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6,30}$/, "AWB invalid"))

/**
 * Unde trimite clientul coletul. AWB-ul îl face el pe site-ul Fan Courier,
 * cu plata transportului la destinatar (la noi).
 *
 * `BUYBACK_COURIER_URL` = pagina Fan Courier de unde își comandă curierul;
 * destinatarul vine din aceleași variabile ca ridicarea din magazin.
 */
export function courierInfo() {
  return {
    url: process.env.BUYBACK_COURIER_URL || "https://www.fancourier.ro/",
    recipient: process.env.BUYBACK_SHIP_TO_NAME || "ONLY BEST DEVICE S.R.L.",
    address: process.env.STORE_PICKUP_ADDRESS || "",
    phone: process.env.STORE_PICKUP_PHONE || "",
  }
}
