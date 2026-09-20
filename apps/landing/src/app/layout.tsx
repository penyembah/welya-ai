import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { site } from "@/lib/site"
import { ThemeProvider } from "@/components/theme-provider"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { JsonLd, organizationLd, softwareLd } from "@/lib/seo"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"], display: "swap" })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" })

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: site.keywords,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  category: "education",
  alternates: { canonical: site.url },
  openGraph: {
    type: "website",
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: `${site.name} — ${site.tagline}` }],
  },
  twitter: { card: "summary_large_image", site: site.twitter, creator: site.twitter, title: `${site.name} — ${site.tagline}`, description: site.description, images: ["/opengraph-image"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  icons: { icon: [{ url: "/welya-logo.svg", type: "image/svg+xml" }, { url: "/app-icon.png", sizes: "1024x1024", type: "image/png" }], apple: "/app-icon.png" },
  manifest: "/manifest.webmanifest",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#151b1d" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full antialiased", geistSans.variable, geistMono.variable, "font-sans")}>
      <head>
        <JsonLd data={organizationLd} />
        <JsonLd data={softwareLd} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  )
}
