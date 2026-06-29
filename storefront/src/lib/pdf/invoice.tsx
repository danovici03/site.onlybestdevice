import React from "react"
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer"
import { HttpTypes } from "@medusajs/types"
void React

// Brand tokens mirrored from tailwind config so the PDF stays visually
// consistent with the storefront.
const COLORS = {
  dark: "#1C1B1A",
  accent: "#A46754",
  muted: "#666666",
  border: "#E5E5E5",
  surface: "#F4F3F0",
  white: "#FFFFFF",
}

const COMPANY = {
  brand: "Arredovita",
  legalName: "Premium Transport S.r.l.",
  vat: "P.IVA 03264470216",
  rea: "REA BZ-245628",
  sedeLegale: "Sede legale: Bolzano (BZ)",
  sedeOperativa: "Sede operativa: Carpenedolo (BS)",
  email: "info@arredovita.it",
  website: "arredovita.it",
}

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.dark,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 32,
    paddingBottom: 16,
    borderBottom: `2px solid ${COLORS.dark}`,
  },
  brandLockup: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: COLORS.dark,
  },
  brandAccent: { color: COLORS.accent },
  companyMeta: {
    fontSize: 8,
    color: COLORS.muted,
    textAlign: "right",
    lineHeight: 1.5,
  },
  companyLine: { fontSize: 8, color: COLORS.muted },
  docTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 24,
  },
  docTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.dark,
  },
  docMeta: { fontSize: 9, color: COLORS.muted, textAlign: "right" },
  docMetaValue: { color: COLORS.dark, fontFamily: "Helvetica-Bold" },
  blocksRow: { flexDirection: "row", gap: 24, marginBottom: 28 },
  block: { flex: 1 },
  blockLabel: {
    fontSize: 8,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  blockLine: { fontSize: 10, color: COLORS.dark },
  table: { marginTop: 8 },
  th: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottom: `1px solid ${COLORS.dark}`,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottom: `1px solid ${COLORS.border}`,
  },
  cellProduct: { flex: 4 },
  cellQty: { flex: 1, textAlign: "center" },
  cellUnit: { flex: 1.5, textAlign: "right" },
  cellTotal: { flex: 1.5, textAlign: "right" },
  variant: { fontSize: 8, color: COLORS.muted, marginTop: 2 },
  totalsBox: {
    marginTop: 16,
    marginLeft: "auto",
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: { color: COLORS.muted },
  totalValue: { color: COLORS.dark },
  totalGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginTop: 6,
    borderTop: `2px solid ${COLORS.dark}`,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    paddingTop: 12,
    borderTop: `1px solid ${COLORS.border}`,
  },
  footerText: { fontSize: 7, color: COLORS.muted, textAlign: "center" },
  footerDisclaimer: {
    fontSize: 7,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
})

const formatMoney = (amount: number | null | undefined, currency: string) => {
  if (amount == null) return "—"
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

const AddressBlock = ({
  label,
  address,
}: {
  label: string
  address?: HttpTypes.StoreOrder["billing_address"] | null
}) => (
  <View style={styles.block}>
    <Text style={styles.blockLabel}>{label}</Text>
    {address ? (
      <>
        <Text style={styles.blockLine}>
          {address.first_name} {address.last_name}
        </Text>
        {address.company ? (
          <Text style={styles.blockLine}>{address.company}</Text>
        ) : null}
        <Text style={styles.blockLine}>
          {address.address_1}
          {address.address_2 ? `, ${address.address_2}` : ""}
        </Text>
        <Text style={styles.blockLine}>
          {address.postal_code} {address.city}
          {address.province ? ` (${address.province})` : ""}
        </Text>
        <Text style={styles.blockLine}>
          {address.country_code?.toUpperCase()}
        </Text>
        {address.phone ? (
          <Text style={styles.blockLine}>{address.phone}</Text>
        ) : null}
      </>
    ) : (
      <Text style={styles.blockLine}>—</Text>
    )}
  </View>
)

export const InvoiceDocument = ({
  order,
}: {
  order: HttpTypes.StoreOrder
}) => {
  const currency = order.currency_code
  const money = (n: number | null | undefined) => formatMoney(n, currency)

  return (
    <Document title={`Riepilogo ordine #${order.display_id}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandLockup}>
              ARREDO VITA<Text style={styles.brandAccent}>.</Text>
            </Text>
          </View>
          <View style={styles.companyMeta}>
            <Text style={styles.companyLine}>{COMPANY.legalName}</Text>
            <Text style={styles.companyLine}>{COMPANY.vat}</Text>
            <Text style={styles.companyLine}>{COMPANY.rea}</Text>
            <Text style={styles.companyLine}>{COMPANY.sedeLegale}</Text>
            <Text style={styles.companyLine}>{COMPANY.sedeOperativa}</Text>
            <Text style={styles.companyLine}>{COMPANY.email}</Text>
          </View>
        </View>

        {/* Doc title + meta */}
        <View style={styles.docTitleRow}>
          <Text style={styles.docTitle}>Riepilogo ordine</Text>
          <View style={styles.docMeta}>
            <Text>
              Numero ordine:{" "}
              <Text style={styles.docMetaValue}>#{order.display_id}</Text>
            </Text>
            <Text>
              Data ordine:{" "}
              <Text style={styles.docMetaValue}>
                {formatDate(order.created_at)}
              </Text>
            </Text>
            {order.email ? (
              <Text>
                Cliente:{" "}
                <Text style={styles.docMetaValue}>{order.email}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.blocksRow}>
          <AddressBlock
            label="Indirizzo di fatturazione"
            address={order.billing_address}
          />
          <AddressBlock
            label="Indirizzo di spedizione"
            address={order.shipping_address}
          />
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={styles.cellProduct}>Prodotto</Text>
            <Text style={styles.cellQty}>Q.tà</Text>
            <Text style={styles.cellUnit}>Prezzo unit.</Text>
            <Text style={styles.cellTotal}>Totale</Text>
          </View>
          {(order.items ?? []).map((item) => (
            <View key={item.id} style={styles.tr}>
              <View style={styles.cellProduct}>
                <Text>{item.product_title || item.title}</Text>
                {item.variant_title ? (
                  <Text style={styles.variant}>{item.variant_title}</Text>
                ) : null}
              </View>
              <Text style={styles.cellQty}>{item.quantity}</Text>
              <Text style={styles.cellUnit}>{money(item.unit_price)}</Text>
              <Text style={styles.cellTotal}>{money(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotale</Text>
            <Text style={styles.totalValue}>{money(order.subtotal)}</Text>
          </View>
          {order.discount_total > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sconto</Text>
              <Text style={styles.totalValue}>
                - {money(order.discount_total)}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Spedizione</Text>
            <Text style={styles.totalValue}>{money(order.shipping_total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA</Text>
            <Text style={styles.totalValue}>{money(order.tax_total)}</Text>
          </View>
          <View style={styles.totalGrand}>
            <Text>Totale</Text>
            <Text>{money(order.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {COMPANY.brand} · {COMPANY.legalName} · {COMPANY.vat} ·{" "}
            {COMPANY.website}
          </Text>
          <Text style={styles.footerDisclaimer}>
            Documento di riepilogo dell&apos;acquisto, non valido ai fini
            fiscali. La fattura elettronica, se richiesta, viene inviata
            separatamente tramite il Sistema di Interscambio.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
