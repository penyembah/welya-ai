import Image from "next/image"
import { ArrowRightIcon, MonitorIcon, AppleIcon, LaptopIcon, GlobeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHero, Section, SectionHeading } from "@/components/sections"
import { site } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Download", description: "Use Welya AI in the browser or install the lightweight desktop app for Windows, macOS and Linux. Same account, same data.", path: "/download" })

const RELEASES = process.env.NEXT_PUBLIC_RELEASES_URL ?? "https://github.com/welya/welya/releases/latest"

const platforms = [
  { icon: GlobeIcon, name: "Web app", desc: "Nothing to install. Works in any modern browser.", href: `${site.appUrl}/login`, cta: "Open Welya" },
  { icon: MonitorIcon, name: "Windows", desc: "Installer (.msi) for Windows 10 and 11. Built with Tauri — under 15 MB.", href: RELEASES, cta: "Download for Windows" },
  { icon: AppleIcon, name: "macOS", desc: "Universal .dmg for Apple Silicon and Intel Macs.", href: RELEASES, cta: "Download for macOS" },
  { icon: LaptopIcon, name: "Linux", desc: ".deb and .AppImage builds.", href: RELEASES, cta: "Download for Linux" },
]

export default function DownloadPage() {
  return (
    <>
      <PageHero eyebrow="Download" title="Welya on every screen you study at" description="The desktop app is the same Welya, wrapped in a native window with system notifications for reminders. Your account and data are shared across all of them." />
      <Section className="pt-0 sm:pt-0 -mt-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((p) => (
            <Card key={p.name}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><p.icon className="size-4" /></div>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.desc}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button className="w-full" variant={p.name === "Web app" ? "default" : "outline"} render={<a href={p.href} target={p.href.startsWith("http") && !p.href.startsWith(site.appUrl) ? "_blank" : undefined} rel="noopener" />}>
                  {p.cta} <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
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
