import { getBaseURL } from "@lib/util/env"
import { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "styles/globals.css"

// Single unified sans across the whole site (body, headings, nav, logo).
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
})

export const viewport: Viewport = {
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "onlybestdevice | Gadgeturi și electronice premium",
    template: "%s | onlybestdevice",
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="ro"
      data-mode="light"
      className={`${inter.variable} scroll-smooth`}
    >
      <body className="font-sans bg-brand-light text-brand-dark antialiased selection:bg-brand-dark selection:text-white">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
