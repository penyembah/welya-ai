import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHero, Section } from "@/components/sections"
import { posts } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Blog", description: "Notes on studying smarter, planning around classes, and building an AI secretary that stays grounded.", path: "/blog" })

export default function BlogIndexPage() {
  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <>
      <PageHero eyebrow="Blog" title="Notes from the Welya team" description="On student productivity, planning, and the engineering behind a trustworthy AI secretary." />
      <Section className="pt-0 sm:pt-0 -mt-10">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                  <CardTitle className="text-lg leading-snug group-hover:underline">{p.title}</CardTitle>
                  <CardDescription>{p.excerpt}</CardDescription>
                  <p className="pt-2 text-xs text-muted-foreground">
                    <time dateTime={p.date}>{new Date(p.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time> · {p.readingTime}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm text-primary">Read <ArrowRightIcon className="size-3.5" /></span>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </Section>
    </>
  )
}
