import type { Metadata } from "next"
import { site } from "@/lib/site"

type PageSeo = { title: string; description: string; path: string; image?: string; type?: "website" | "article"; publishedTime?: string; tags?: string[] }

export function pageMetadata({ title, description, path, image = "/opengraph-image", type = "website", publishedTime, tags }: PageSeo): Metadata {
  const url = `${site.url}${path}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${site.name}`,
      description,
      url,
      siteName: site.name,
      type,
      locale: site.locale,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      ...(type === "article" ? { publishedTime, tags } : {}),
    },
    twitter: { card: "summary_large_image", site: site.twitter, title: `${title} · ${site.name}`, description, images: [image] },
  }
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}/app-icon.png`,
  email: site.email,
  sameAs: [`https://twitter.com/${site.twitter.replace("@", "")}`],
}

export const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web, Windows, macOS, Linux",
  description: site.description,
  url: site.url,
  image: `${site.url}/screenshots/dashboard-dark.png`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free for students" },
  featureList: ["AI inbox interpretation", "Task breakdown", "Automatic day and week planning", "Course workspaces", "Document analysis", "Weekly review"],
}

export function breadcrumbLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${site.url}${it.path}` })),
  }
}
