import { Badge } from "@/components/ui/badge"
import { PageHero, Section } from "@/components/sections"
import { changelog } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Changelog", description: "What's new in Welya AI — every release, feature and fix.", path: "/changelog" })

export default function ChangelogPage() {
  return (
    <>
      <PageHero eyebrow="Changelog" title="What's new in Welya" description="Shipped changes, newest first." />
      <Section className="pt-4">
        <ol className="mx-auto max-w-3xl space-y-10 border-l pl-6">
          {changelog.map((r, i) => (
            <li key={r.version} className="relative">
              <span className={`absolute -left-[1.85rem] top-1.5 size-3 rounded-full border-2 border-background ${i === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={i === 0 ? "default" : "secondary"}>v{r.version}</Badge>
                <time dateTime={r.date} className="text-sm text-muted-foreground">{new Date(r.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time>
              </div>
              <h2 className="mt-2 font-heading text-xl font-semibold">{r.title}</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {r.items.map((it) => <li key={it} className="ml-4 list-disc">{it}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </Section>
    </>
  )
}
