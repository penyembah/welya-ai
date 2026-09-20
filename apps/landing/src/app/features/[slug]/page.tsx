import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CTA, PageHero, Screenshot, Section } from "@/components/sections"
import { features, site } from "@/lib/site"
import { JsonLd, breadcrumbLd, pageMetadata } from "@/lib/seo"

export function generateStaticParams() {
  return features.map((f) => ({ slug: f.slug }))
}

export async function generateMetadata({ params }: PageProps<"/features/[slug]">) {
  const { slug } = await params
  const f = features.find((x) => x.slug === slug)
  if (!f) return {}
  return pageMetadata({ title: f.title, description: f.description, path: `/features/${f.slug}`, image: f.screenshot })
}

export default async function FeatureDetailPage({ params }: PageProps<"/features/[slug]">) {
  const { slug } = await params
  const index = features.findIndex((x) => x.slug === slug)
  if (index === -1) notFound()
  const f = features[index]
  const next = features[(index + 1) % features.length]

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "" }, { name: "Features", path: "/features" }, { name: f.title, path: `/features/${f.slug}` }])} />
      <PageHero eyebrow={f.eyebrow} title={f.title} description={f.description}>
        <Button size="lg" render={<a href={`${site.appUrl}/register`} />}>Try it free <ArrowRightIcon data-icon="inline-end" /></Button>
        <Button size="lg" variant="outline" render={<Link href="/features" />}><ArrowLeftIcon data-icon="inline-start" /> All features</Button>
      </PageHero>
      <Section className="pt-10">
        <Screenshot src={f.screenshot} alt={f.title} priority />
        {f.screenshotLight && (
          <div className="mt-6">
            <p className="mb-3 text-center text-xs text-muted-foreground">Also in light mode</p>
            <Screenshot src={f.screenshotLight} alt={`${f.title} — light theme`} />
          </div>
        )}
      </Section>
      <Section muted>
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {f.bullets.map((b) => (
            <div key={b} className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {b}
            </div>
          ))}
        </div>
        <div className="mt-10 flex items-center justify-center">
          <Button variant="outline" render={<Link href={`/features/${next.slug}`} />}>Next: {next.title} <ArrowRightIcon data-icon="inline-end" /></Button>
        </div>
      </Section>
      <CTA />
    </>
  )
}
