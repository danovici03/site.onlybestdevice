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
  brand: "onlybestdevice",
  legalName: "ONLY BEST DEVICE S.R.L.",
  vat: "CUI 43546040",
  rea: "Reg. Com. J06/26/2021",
  sedeLegale: "Sediu social: Bistrița (BN)",
  sedeOperativa: "Punct de lucru: Bistrița (BN)",
  email: "contact@onlybestdevice.ro",
  website: "onlybestdevice.ro",
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
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount} ${currency}`
  }
}

const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("ro-RO", {
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
    <Document title={`Rezumat comandă #${order.display_id}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandLockup}>
              onlybestdevice<Text style={styles.brandAccent}>.</Text>
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
          <Text style={styles.docTitle}>Rezumat comandă</Text>
          <View style={styles.docMeta}>
            <Text>
              Număr comandă:{" "}
              <Text style={styles.docMetaValue}>#{order.display_id}</Text>
            </Text>
            <Text>
              Data comenzii:{" "}
              <Text style={styles.docMetaValue}>
                {formatDate(order.created_at)}
              </Text>
            </Text>
            {order.email ? (
              <Text>
                Client:{" "}
                <Text style={styles.docMetaValue}>{order.email}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {/* Addresses */}
        <View style={styles.blocksRow}>
          <AddressBlock
            label="Adresă de facturare"
            address={order.billing_address}
          />
          <AddressBlock
            label="Adresă de livrare"
            address={order.shipping_address}
          />
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={styles.cellProduct}>Produs</Text>
            <Text style={styles.cellQty}>Cant.</Text>
            <Text style={styles.cellUnit}>Preț unit.</Text>
            <Text style={styles.cellTotal}>Total</Text>
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
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(order.subtotal)}</Text>
          </View>
          {order.discount_total > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Reducere</Text>
              <Text style={styles.totalValue}>
                - {money(order.discount_total)}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Livrare</Text>
            <Text style={styles.totalValue}>{money(order.shipping_total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA</Text>
            <Text style={styles.totalValue}>{money(order.tax_total)}</Text>
          </View>
          <View style={styles.totalGrand}>
            <Text>Total</Text>
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
            Document de rezumat al comenzii, fără valoare fiscală. Factura
            fiscală, dacă este solicitată, se emite și se trimite separat.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
