"use server"

import { z } from "zod"
import { Resend } from "resend"
import { COMPANY } from "@lib/util/company-info"

/**
 * Cererea de service — trimisă pe email, ca formularul de contact. Nu creează
 * nimic în Medusa: reparațiile se urmăresc în afara comenzii, iar clientul
 * expediază produsul abia după confirmarea noastră.
 */
const checkbox = (message: string) =>
  z
    .string()
    .refine((v) => v === "on" || v === "true", { message })
    .transform(() => true)

const ServiceSchema = z.object({
  nume: z.string().min(2, "Introdu numele tău").max(100),
  email: z.string().email("Email invalid").max(150),
  telefon: z
    .string()
    .min(6, "Introdu un număr de telefon — curierul are nevoie de el")
    .max(40),
  numarComanda: z
    .string()
    .min(1, "Introdu numărul comenzii sau al facturii")
    .max(60),
  produs: z.string().min(2, "Scrie ce produs trimiți în service").max(150),
  serie: z.string().max(80).optional().or(z.literal("")),
  problema: z
    .string()
    .min(10, "Descrie problema în cel puțin 10 caractere")
    .max(5000),
  adresaRetur: z
    .string()
    .min(10, "Scrie adresa la care îți trimitem aparatul reparat")
    .max(400),
  codAcces: z.string().max(200).optional().or(z.literal("")),
  // Checkbox-urile ajung „on" sau lipsesc; `refine` ne lasă să dăm mesajul
  // potrivit în loc de eroarea generică de tip a lui zod.
  resetatConfirmat: checkbox(
    "Confirmă condițiile de trimitere în service sau completează codul de acces"
  ),
  consensoPrivacy: checkbox("Acceptă politica de confidențialitate"),
  // honeypot — trebuie să rămână gol. Boții îl completează de obicei.
  website: z.string().max(0).optional().or(z.literal("")),
})

export type ServiceState = {
  ok: boolean
  message: string
  fieldErrors?: Record<string, string[]>
}

export async function sendServiceRequest(
  _prev: ServiceState | null,
  formData: FormData
): Promise<ServiceState> {
  const raw = {
    nume: formData.get("nume"),
    email: formData.get("email"),
    telefon: formData.get("telefon"),
    numarComanda: formData.get("numarComanda"),
    produs: formData.get("produs"),
    serie: formData.get("serie"),
    problema: formData.get("problema"),
    adresaRetur: formData.get("adresaRetur"),
    codAcces: formData.get("codAcces"),
    // Un checkbox nebifat nu ajunge deloc în FormData: `null` ar da eroarea de
    // tip a lui zod, nu mesajul nostru.
    resetatConfirmat: formData.get("resetatConfirmat") ?? "",
    consensoPrivacy: formData.get("consensoPrivacy") ?? "",
    website: formData.get("website"),
  }

  const parsed = ServiceSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Verifică câmpurile evidențiate.",
      fieldErrors: parsed.error.flatten().fieldErrors as any,
    }
  }

  // Honeypot completat — răspundem „ok" ca botul să nu afle că l-am prins.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { ok: true, message: "Cerere primită." }
  }

  const apiKey = process.env.RESEND_API_KEY
  const to =
    process.env.SERVICE_EMAIL_TO ||
    process.env.CONTACT_EMAIL_TO ||
    COMPANY.email
  const from = process.env.CONTACT_EMAIL_FROM || `noreply@${COMPANY.dominio}`

  if (!apiKey) {
    console.error(
      "[service] RESEND_API_KEY lipsește — cererea nu va fi trimisă."
    )
    return {
      ok: false,
      message:
        "Serviciul de trimitere este temporar indisponibil. Scrie-ne direct la " +
        COMPANY.email,
    }
  }

  const d = parsed.data
  const subject = `[Service] ${d.produs} — comanda ${d.numarComanda} — ${d.nume}`

  const fields: [string, string][] = [
    ["Nume", d.nume],
    ["Email", d.email],
    ["Telefon", d.telefon],
    ["Nr. comandă / factură", d.numarComanda],
    ["Produs", d.produs],
    ["Serie / IMEI", d.serie || "—"],
    ["Adresă retur aparat", d.adresaRetur],
    ["Cod de acces", d.codAcces || "—"],
    ["Aparat resetat", d.resetatConfirmat ? "Da, confirmat de client" : "—"],
  ]

  const text = [
    `Cerere de service nouă pe ${COMPANY.marchio}`,
    "",
    ...fields.map(([k, v]) => `${k}: ${v}`),
    "",
    "Descrierea problemei:",
    d.problema,
  ].join("\n")

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: d.email,
      subject,
      html: renderEmailHtml(fields, d.problema),
      text,
    })
    if (error) {
      console.error("[service] Resend error", error)
      return {
        ok: false,
        message:
          "A apărut o problemă la trimitere. Încearcă din nou sau scrie-ne la " +
          COMPANY.email,
      }
    }
  } catch (err) {
    console.error("[service] send failed", err)
    return {
      ok: false,
      message:
        "A apărut o problemă la trimitere. Încearcă din nou sau scrie-ne la " +
        COMPANY.email,
    }
  }

  return {
    ok: true,
    message:
      "Cerere de service înregistrată. Îți răspundem în 24–48 de ore lucrătoare cu confirmarea preluării.",
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function renderEmailHtml(fields: [string, string][], problema: string): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;font-weight:600;color:#111;width:180px;">${escapeHtml(
      label
    )}</td><td style="padding:6px 12px;color:#222;">${escapeHtml(value)}</td></tr>`

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f5f3;padding:24px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:32px;">
    <h2 style="margin:0 0 16px 0;color:#111;">Cerere de service nouă</h2>
    <p style="color:#555;margin:0 0 24px 0;">Formular de service — ${escapeHtml(
      COMPANY.marchio
    )}</p>
    <table style="width:100%;border-collapse:collapse;background:#f9f9f8;border-radius:12px;overflow:hidden;">
      ${fields.map(([k, v]) => row(k, v)).join("\n      ")}
    </table>
    <h3 style="margin:24px 0 8px 0;color:#111;">Descrierea problemei</h3>
    <div style="white-space:pre-wrap;color:#222;line-height:1.6;background:#f9f9f8;padding:16px;border-radius:12px;">${escapeHtml(
      problema
    )}</div>
  </div>
</body></html>`
}
