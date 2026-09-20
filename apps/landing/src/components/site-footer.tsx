import Link from "next/link"
import { WelyaLogo } from "@/components/welya-logo"
import { nav, site } from "@/lib/site"

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <WelyaLogo className="size-4.5" />
            </span>
            <span className="font-heading text-base font-semibold">{site.name}</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">{site.tagline}. Capture → Understand → Organize → Plan → Act → Review.</p>
          <p className="text-xs text-muted-foreground">
            <a href={`mailto:${site.email}`} className="hover:text-foreground">{site.email}</a>
          </p>
        </div>
        {nav.footer.map((group) => (
          <div key={group.title}>
            <p className="mb-3 text-sm font-medium">{group.title}</p>
            <ul className="space-y-2">
              {group.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} {site.name}. Made for students.</p>
          <p>Built with Next.js, shadcn/ui and Azure AI Foundry.</p>
        </div>
      </div>
    </footer>
  )
}
