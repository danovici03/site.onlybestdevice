"use server"

import { z } from "zod"
import { Resend } from "resend"
import { COMPANY } from "@lib/util/company-info"

const ContactSchema = z.object({
  nome: z.string().min(2, "Introdu numele tău").max(100),
  email: z.string().email("Email invalid").max(150),
  telefono: z.string().max(40).optional().or(z.literal("")),
  oggetto: z.enum(
    ["ordine", "spedizione", "resi", "garanzia", "informazioni", "altro"],
    { message: "Selectează un subiect" }
  ),
  numeroOrdine: z.string().max(60).optional().or(z.literal("")),
  messaggio: z
    .string()
    .min(10, "Mesajul trebuie să conțină cel puțin 10 caractere")
    .max(5000),
  consensoPrivacy: z
    .union([z.literal("on"), z.literal("true"), z.literal(true)])
    .transform(() => true),
  // honeypot — trebuie să rămână gol. Boții îl completează de obicei.
  website: z.string().max(0).optional().or(z.literal("")),
})

const SUBJECT_LABELS: Record<string, string> = {
  ordine: "Întrebare despre o comandă",
  spedizione: "Livrare",
  resi: "Retur / Drept de retragere",
  garanzia: "Garanție",
  informazioni: "Solicitare de informații",
  altro: "Altul",
}

export type ContactState = {
  ok: boolean
  message: string
  fieldErrors?: Record<string, string[]>
}

export async function sendContactMessage(
  _prev: ContactState | null,
  formData: FormData
): Promise<ContactState> {
  const raw = {
    nome: formData.get("nome"),
    email: formData.get("email"),
    telefono: formData.get("telefono"),
    oggetto: formData.get("oggetto"),
    numeroOrdine: formData.get("numeroOrdine"),
    messaggio: formData.get("messaggio"),
    consensoPrivacy: formData.get("consensoPrivacy"),
    website: formData.get("website"),
  }

  const parsed = ContactSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      message: "Verifică câmpurile evidențiate.",
      fieldErrors: parsed.error.flatten().fieldErrors as any,
    }
  }

  // Honeypot triggered — silently succeed to avoid signaling bots.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return { ok: true, message: "Mesaj primit." }
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_EMAIL_TO || COMPANY.email
  const from = process.env.CONTACT_EMAIL_FROM || `noreply@${COMPANY.dominio}`

  if (!apiKey) {
    console.error(
      "[contact] RESEND_API_KEY lipsește — mesajul nu va fi trimis."
    )
    return {
      ok: false,
      message:
        "Serviciul de trimitere este temporar indisponibil. Scrie-ne direct la " +
        COMPANY.email,
    }
  }

  const data = parsed.data
  const subjectLabel = SUBJECT_LABELS[data.oggetto] ?? data.oggetto
  const subject = `[Contact site] ${subjectLabel} — ${data.nome}`

  const html = renderEmailHtml({
    nome: data.nome,
    email: data.email,
    telefono: data.telefono || "—",
    oggetto: subjectLabel,
    numeroOrdine: data.numeroOrdine || "—",
    messaggio: data.messaggio,
  })

  const text = [
    `Mesaj nou din formularul de contact al ${COMPANY.marchio}`,
    "",
    `Nume: ${data.nome}`,
    `Email: ${data.email}`,
    `Telefon: ${data.telefono || "—"}`,
    `Subiect: ${subjectLabel}`,
    `Număr comandă: ${data.numeroOrdine || "—"}`,
    "",
    "Mesaj:",
    data.messaggio,
  ].join("\n")

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: data.email,
      subject,
      html,
      text,
    })
    if (error) {
      console.error("[contact] Resend error", error)
      return {
        ok: false,
        message:
          "A apărut o problemă la trimitere. Încearcă din nou sau scrie-ne la " +
          COMPANY.email,
      }
    }
  } catch (err) {
    console.error("[contact] send failed", err)
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
      "Mesaj trimis. Îți răspundem în 24–48 de ore lucrătoare.",
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

function renderEmailHtml(d: {
  nome: string
  email: string
  telefono: string
  oggetto: string
  numeroOrdine: string
  messaggio: string
}): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;font-weight:600;color:#111;width:140px;">${escapeHtml(
      label
    )}</td><td style="padding:6px 12px;color:#222;">${escapeHtml(value)}</td></tr>`

  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f5f3;padding:24px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:32px;">
    <h2 style="margin:0 0 16px 0;color:#111;">Mesaj nou de pe site</h2>
    <p style="color:#555;margin:0 0 24px 0;">Formular de contact — ${escapeHtml(
      COMPANY.marchio
    )}</p>
    <table style="width:100%;border-collapse:collapse;background:#f9f9f8;border-radius:12px;overflow:hidden;">
      ${row("Nume", d.nome)}
      ${row("Email", d.email)}
      ${row("Telefon", d.telefono)}
      ${row("Subiect", d.oggetto)}
      ${row("Nr. comandă", d.numeroOrdine)}
    </table>
    <h3 style="margin:24px 0 8px 0;color:#111;">Mesaj</h3>
    <div style="white-space:pre-wrap;color:#222;line-height:1.6;background:#f9f9f8;padding:16px;border-radius:12px;">${escapeHtml(
      d.messaggio
    )}</div>
    <p style="margin-top:24px;font-size:12px;color:#888;">Răspunde direct la acest email pentru a-i scrie lui ${escapeHtml(
      d.nome
    )} (${escapeHtml(d.email)}).</p>
  </div>
</body></html>`
}
