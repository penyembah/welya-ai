import type { MetadataRoute } from "next"
import { site } from "@/lib/site"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#151b1d",
    theme_color: "#151b1d",
    icons: [{ src: "/app-icon.png", sizes: "1024x1024", type: "image/png", purpose: "any" }],
  }
}
