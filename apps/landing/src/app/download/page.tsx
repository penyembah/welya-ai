import Image from "next/image"
import { ArrowRightIcon, DownloadIcon, MonitorIcon, AppleIcon, LaptopIcon, GlobeIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHero, Section, SectionHeading } from "@/components/sections"
import { site } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"
import { formatSize, getLatestRelease, LATEST_RELEASE_URL, PROXIED, RELEASES_URL, type Platform } from "@/lib/releases"

export const metadata = pageMetadata({ title: "Download", description: "Use Welya AI in the browser or install the lightweight desktop app for Windows, macOS and Linux. Same account, same data.", path: "/download" })

// Re-check GitHub Releases at most once an hour so new builds show up without a redeploy.
export const revalidate = 3600

const desktop: { key: Platform; icon: typeof MonitorIcon; name: string; desc: string; cta: string }[] = [
  { key: "windows", icon: MonitorIcon, name: "Windows", desc: "Installer for Windows 10 and 11. Built with Tauri — small and fast.", cta: "Download for Windows" },
  { key: "macos", icon: AppleIcon, name: "macOS", desc: "Native .dmg for Apple Silicon and Intel Macs.", cta: "Download for macOS" },
  { key: "linux", icon: LaptopIcon, name: "Linux", desc: "AppImage and .deb builds.", cta: "Download for Linux" },
]

export default async function DownloadPage() {
  const release = await getLatestRelease()

  return (
    <>
      <PageHero eyebrow="Download" title="Welya on every screen you study at" description="The desktop app is the same Welya, wrapped in a native window with system notifications for reminders. Your account and data are shared across all of them." />
      <Section className="pt-0 sm:pt-0 -mt-10">
        {release && (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">Latest v{release.version}</Badge>
            {release.publishedAt && <span>Released {new Date(release.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
            {!PROXIED && (
              <>
                <span aria-hidden>·</span>
                <a href={RELEASES_URL} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-foreground">All releases</a>
              </>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><GlobeIcon className="size-4" /></div>
              <CardTitle>Web app</CardTitle>
              <CardDescription>Nothing to install. Works in any modern browser.</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Button className="w-full" render={<a href={`${site.appUrl}/login`} />}>
                Open Welya <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardFooter>
          </Card>

          {desktop.map((p) => {
            const dl = release?.platforms[p.key]
            const href = dl?.primary?.url ?? (PROXIED ? undefined : LATEST_RELEASE_URL)
            return (
              <Card key={p.key}>
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><p.icon className="size-4" /></div>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>{p.desc}</CardDescription>
                </CardHeader>
                {dl?.primary && (
                  <CardContent className="text-xs text-muted-foreground">
                    <p className="truncate" title={dl.primary.name}>{dl.primary.label} · {formatSize(dl.primary.size)}</p>
                    {dl.alternatives.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {dl.alternatives.map((a) => (
                          <li key={a.name}>
                            <a href={a.url} className="underline underline-offset-4 hover:text-foreground" title={a.name}>
                              {a.label} · {formatSize(a.size)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                )}
                <CardFooter className="mt-auto">
                  {href ? (
                    <Button className="w-full" variant="outline" render={<a href={href} rel="noopener" target={dl?.primary ? undefined : "_blank"} />}>
                      {dl?.primary ? <DownloadIcon data-icon="inline-start" /> : null}
                      {p.cta} {dl?.primary ? null : <ArrowRightIcon data-icon="inline-end" />}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline" disabled>Coming soon</Button>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
        {!release && !PROXIED && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Desktop installers are published on <a href={RELEASES_URL} target="_blank" rel="noopener" className="underline underline-offset-4 hover:text-foreground">GitHub Releases</a>.
          </p>
        )}
      </Section>
      <Section muted>
        <SectionHeading eyebrow="Mobile" title="Phone-friendly from day one" description="The web app is fully responsive — pin it to your home screen. Native iOS and Android apps are on the roadmap." />
        <div className="mx-auto mt-10 max-w-xs overflow-hidden rounded-[2rem] border-8 border-foreground/90 bg-background shadow-2xl">
          <Image src="/screenshots/mobile-dark.png" alt="Welya on a phone" width={780} height={1688} className="h-auto w-full" sizes="320px" />
        </div>
      </Section>
    </>
  )
}
