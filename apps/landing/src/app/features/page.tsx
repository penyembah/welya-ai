import Link from "next/link"
import { ArrowRightIcon, CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CTA, PageHero, Screenshot, Section } from "@/components/sections"
import { features, site } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Features", description: "Inbox with AI interpretation, automatic day and week planning, task breakdown, course spaces, document analysis and a weekly review — every feature of Welya AI explained.", path: "/features" })

export default function FeaturesPage() {
  return (
    <>
      <PageHero eyebrow="Features" title="Everything a good secretary does — for your degree" description="Welya connects the pieces most student apps keep separate: what arrives, what it means, when it's due, and when you'll actually do it.">
        <Button size="lg" render={<a href={`${site.appUrl}/register`} />}>Start for free <ArrowRightIcon data-icon="inline-end" /></Button>
        <Button size="lg" variant="outline" render={<Link href="/how-it-works" />}>How it works</Button>
      </PageHero>

      {features.map((f, i) => (
        <Section key={f.slug} id={f.slug} muted={i % 2 === 1} className="py-14 sm:py-20">
          <div className={`grid items-center gap-10 lg:grid-cols-[1fr_1.5fr] ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <div className="space-y-4">
              <p className="text-xs font-medium tracking-wider text-primary uppercase">{f.eyebrow}</p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{f.title}</h2>
              <p className="text-muted-foreground">{f.description}</p>
              <ul className="space-y-1.5 text-sm">
                {f.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {b}</li>
                ))}
              </ul>
              <Button variant="link" className="px-0" render={<Link href={`/features/${f.slug}`} />}>Details <ArrowRightIcon data-icon="inline-end" /></Button>
            </div>
            <Screenshot src={f.screenshot} alt={f.title} sizes="(min-width: 1024px) 680px, 100vw" />
          </div>
        </Section>
      ))}

      <CTA />
    </>
  )
}
