import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CTA, Prose, Section } from "@/components/sections"
import { posts, site } from "@/lib/site"
import { JsonLd, breadcrumbLd, pageMetadata } from "@/lib/seo"

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params
  const p = posts.find((x) => x.slug === slug)
  if (!p) return {}
  return pageMetadata({ title: p.title, description: p.excerpt, path: `/blog/${p.slug}`, type: "article", publishedTime: p.date, tags: p.tags })
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params
  const idx = posts.findIndex((x) => x.slug === slug)
  if (idx === -1) notFound()
  const post = posts[idx]
  const others = posts.filter((p) => p.slug !== post.slug).slice(0, 2)
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: { "@type": "Organization", name: site.name },
    publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: `${site.url}/app-icon.png` } },
    mainEntityOfPage: `${site.url}/blog/${post.slug}`,
    keywords: post.tags.join(", "),
  }

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "" }, { name: "Blog", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }])} />
      <Section className="pb-8">
        <article className="mx-auto max-w-3xl">
          <Button variant="ghost" size="sm" className="-ml-2 mb-6 text-muted-foreground" render={<Link href="/blog" />}><ArrowLeftIcon data-icon="inline-start" /> Blog</Button>
          <div className="mb-2 flex flex-wrap gap-1.5">{post.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{post.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{post.excerpt}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            <time dateTime={post.date}>{new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</time> · {post.readingTime} · {site.name} team
          </p>
          <Separator className="my-8" />
          <Prose>
            {post.body.map((para, i) => <p key={i}>{para}</p>)}
          </Prose>
        </article>
      </Section>
      <Section muted className="py-12">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-medium">Keep reading</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {others.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="rounded-xl border bg-card p-4 text-sm transition-colors hover:bg-muted/40">
                <p className="font-medium">{p.title}</p>
                <p className="mt-1 line-clamp-2 text-muted-foreground">{p.excerpt}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-primary">Read <ArrowRightIcon className="size-3.5" /></span>
              </Link>
            ))}
          </div>
        </div>
      </Section>
      <CTA />
    </>
  )
}
