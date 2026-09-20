import type { MetadataRoute } from "next"
import { features, posts, site } from "@/lib/site"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const statics: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "", priority: 1, changeFrequency: "weekly" },
    { path: "/features", priority: 0.9, changeFrequency: "monthly" },
    { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
    { path: "/download", priority: 0.8, changeFrequency: "monthly" },
    { path: "/faq", priority: 0.7, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "yearly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/changelog", priority: 0.6, changeFrequency: "weekly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
    { path: "/security", priority: 0.5, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ]
  return [
    ...statics.map((s) => ({ url: `${site.url}${s.path}`, lastModified: now, changeFrequency: s.changeFrequency, priority: s.priority })),
    ...features.map((f) => ({ url: `${site.url}/features/${f.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${site.url}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "yearly" as const, priority: 0.6 })),
  ]
}
