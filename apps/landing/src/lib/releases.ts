// Resolves the latest desktop installers from GitHub Releases so the download page always
// points at the newest build without a redeploy. Fetched server-side and cached for an hour.

export const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "penyembah/welya-ai"
export const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`
export const LATEST_RELEASE_URL = `${RELEASES_URL}/latest`
// With a token the repo may be private: downloads go through /download/asset/[id] instead of github.com.
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN
export const PROXIED = Boolean(GITHUB_TOKEN)

export function githubHeaders(accept = "application/vnd.github+json") {
  const headers: Record<string, string> = { Accept: accept, "User-Agent": "welya-landing" }
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`
  return headers
}

export type Platform = "windows" | "macos" | "linux"

export type ReleaseAsset = { name: string; url: string; size: number; label: string }

export type PlatformDownloads = { primary?: ReleaseAsset; alternatives: ReleaseAsset[] }

export type LatestRelease = {
  version: string
  publishedAt: string | null
  url: string
  platforms: Record<Platform, PlatformDownloads>
}

type GithubAsset = { id: number; name: string; browser_download_url: string; size: number }
type GithubRelease = { tag_name: string; html_url: string; published_at: string | null; assets: GithubAsset[]; draft: boolean; prerelease: boolean }

// Order matters: the first match per platform becomes the primary button.
const MATCHERS: { platform: Platform; test: (n: string) => boolean; label: string }[] = [
  { platform: "windows", test: (n) => n.endsWith(".msi"), label: "Windows installer (.msi)" },
  { platform: "windows", test: (n) => /-setup\.exe$/i.test(n) || n.endsWith(".exe"), label: "Windows setup (.exe)" },
  { platform: "macos", test: (n) => n.endsWith(".dmg") && /aarch64|arm64|universal/i.test(n), label: "macOS — Apple Silicon (.dmg)" },
  { platform: "macos", test: (n) => n.endsWith(".dmg"), label: "macOS — Intel (.dmg)" },
  { platform: "linux", test: (n) => n.endsWith(".AppImage"), label: "Linux AppImage" },
  { platform: "linux", test: (n) => n.endsWith(".deb"), label: "Debian / Ubuntu (.deb)" },
  { platform: "linux", test: (n) => n.endsWith(".rpm"), label: "Fedora / RHEL (.rpm)" },
]

function groupAssets(assets: GithubAsset[]): Record<Platform, PlatformDownloads> {
  const out: Record<Platform, PlatformDownloads> = { windows: { alternatives: [] }, macos: { alternatives: [] }, linux: { alternatives: [] } }
  const used = new Set<string>()
  for (const m of MATCHERS) {
    for (const a of assets) {
      if (used.has(a.name) || !m.test(a.name)) continue
      // Skip updater signatures / metadata that tauri-action may also upload
      if (a.name.endsWith(".sig") || a.name.endsWith(".json")) continue
      used.add(a.name)
      const url = PROXIED ? `/download/asset/${a.id}` : a.browser_download_url
      const asset: ReleaseAsset = { name: a.name, url, size: a.size, label: m.label }
      const bucket = out[m.platform]
      if (bucket.primary) bucket.alternatives.push(asset)
      else bucket.primary = asset
    }
  }
  return out
}

export async function getLatestRelease(): Promise<LatestRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, { headers: githubHeaders(), next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = (await res.json()) as GithubRelease
    if (data.draft) return null
    return {
      version: data.tag_name.replace(/^v/, ""),
      publishedAt: data.published_at,
      url: data.html_url,
      platforms: groupAssets(data.assets ?? []),
    }
  } catch {
    return null
  }
}

export function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}
