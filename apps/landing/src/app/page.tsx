import Link from "next/link"
import { ArrowRightIcon, CheckIcon, MailIcon, MessageSquareIcon, FileTextIcon, ImageIcon, PencilLineIcon, CalendarIcon, SparklesIcon, ShieldCheckIcon, MonitorIcon, ZapIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CTA, Screenshot, Section, SectionHeading } from "@/components/sections"
import { features, pipeline, site, stats, testimonials } from "@/lib/site"
import { JsonLd } from "@/lib/seo"

const SOURCES = [
  { icon: MailIcon, label: "Email" },
  { icon: MessageSquareIcon, label: "Group chat" },
  { icon: FileTextIcon, label: "PDF" },
  { icon: ImageIcon, label: "Screenshot" },
  { icon: PencilLineIcon, label: "Paste" },
  { icon: CalendarIcon, label: "Calendar" },
]

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    { "@type": "Question", name: "What is Welya AI?", acceptedAnswer: { "@type": "Answer", text: "Welya is an AI academic secretary that turns emails, messages and documents into connected tasks, deadlines and schedules." } },
    { "@type": "Question", name: "Is Welya free?", acceptedAnswer: { "@type": "Answer", text: "Yes — Welya is completely free for students. Every feature is included, with no paid tier." } },
  ],
}

export default function HomePage() {
  const showcase = features.filter((f) => ["inbox", "calendar", "tasks", "assistant"].includes(f.slug))
  return (
    <>
      <JsonLd data={faqLd} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_50%_-10%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]" />
        <div className="mx-auto w-full max-w-6xl px-4 pt-16 pb-10 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <Badge variant="secondary" className="h-6 gap-1.5 px-2.5">
              <SparklesIcon /> Now powered by gpt-5-mini via Azure AI Foundry
            </Badge>
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Your lecturers send it. <span className="text-primary">Welya</span> turns it into a plan.
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground text-balance">
              Welya is an AI secretary for university students. It reads emails, class group messages and PDFs, understands what they mean, and gives you back tasks, deadlines and a week that actually fits around your classes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button size="lg" render={<a href={`${site.appUrl}/register`} />}>
                Start for free <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/how-it-works" />}>
                See how it works
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">100% free · No credit card · Web, Windows, macOS, Linux</p>
          </div>

          <div className="relative mt-14">
            <div className="pointer-events-none absolute inset-x-8 -bottom-6 h-24 rounded-full bg-primary/20 blur-3xl" />
            <Screenshot src="/screenshots/dashboard-dark.png" alt="Welya dashboard showing today's schedule, priority tasks and AI recommendations" priority className="hidden dark:block" />
            <Screenshot src="/screenshots/dashboard-light.png" alt="Welya dashboard showing today's schedule, priority tasks and AI recommendations" priority className="dark:hidden" />
          </div>
        </div>
      </section>

      {/* Sources strip */}
      <Section className="py-10 sm:py-12">
        <p className="mb-5 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">Understands information from</p>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
          {SOURCES.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm">
              <s.icon className="size-4 text-muted-foreground" /> {s.label}
            </span>
          ))}
        </div>
      </Section>

      {/* Pipeline */}
      <Section muted id="pipeline">
        <SectionHeading eyebrow="How Welya thinks" title="Capture → Understand → Organize → Plan → Act → Review" description="Every piece of academic information follows the same six steps. You stay in control at the moment that matters: confirmation." />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pipeline.map((p) => (
            <li key={p.step} className="rounded-xl border bg-card p-5">
              <span className="font-mono text-xs text-primary">{p.step}</span>
              <h3 className="mt-2 font-heading text-lg font-medium">{p.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Example */}
      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <SectionHeading align="left" eyebrow="A real example" title="From one message to a scheduled task in seconds" description="Paste a message from your lecturer. Welya identifies what it is, which course it belongs to, when it's due, and what to do about it." />
            <ul className="space-y-2 text-sm">
              {["Type: Academic Task · confidence 96%", "Course: Database Systems (IF3210)", "Deadline: Friday 23:59 · format PDF, max 10 pages", "Suggested action: Create task + reminder the day before"].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {t}
                </li>
              ))}
            </ul>
            <Button variant="outline" render={<Link href="/features/inbox" />}>
              Explore the Inbox <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              <p className="mb-1 text-xs text-muted-foreground">Email · Dr. Rina Kusuma · 09:05</p>
              <p className="font-medium">Laporan praktikum Modul 4</p>
              <p className="mt-1 text-muted-foreground">“Laporan praktikum Modul 4 dikumpulkan Jumat pukul 23.59 melalui LMS. Format PDF, maksimal 10 halaman.”</p>
            </div>
            <div className="flex justify-center text-muted-foreground">
              <ArrowRightIcon className="size-5 rotate-90" />
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="mb-2 flex items-center gap-1.5 font-medium">
                <SparklesIcon className="size-4 text-primary" /> Welya&apos;s interpretation
              </p>
              <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Type</dt><dd><Badge>Academic Task</Badge></dd>
                <dt className="text-muted-foreground">Course</dt><dd className="font-medium">Database Systems</dd>
                <dt className="text-muted-foreground">Deadline</dt><dd className="font-medium">Friday 23:59</dd>
                <dt className="text-muted-foreground">Format</dt><dd className="font-medium">PDF, max 10 pages</dd>
              </dl>
              <div className="mt-3 flex gap-2">
                <Button size="sm">Confirm: Create Task</Button>
                <Button size="sm" variant="outline">Create Reminder</Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Feature showcase tabs */}
      <Section muted id="features">
        <SectionHeading eyebrow="Features" title="Everything a secretary would do, if you had one" description="Inbox, calendar, tasks and an assistant that share one brain." />
        <Tabs defaultValue={showcase[0].slug} className="mt-10">
          <TabsList className="mx-auto flex-wrap">
            {showcase.map((f) => (
              <TabsTrigger key={f.slug} value={f.slug} className="capitalize">{f.slug}</TabsTrigger>
            ))}
          </TabsList>
          {showcase.map((f) => (
            <TabsContent key={f.slug} value={f.slug} className="mt-6">
              <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.6fr]">
                <div className="space-y-4">
                  <p className="text-xs font-medium tracking-wider text-primary uppercase">{f.eyebrow}</p>
                  <h3 className="font-heading text-2xl font-semibold tracking-tight">{f.title}</h3>
                  <p className="text-muted-foreground">{f.description}</p>
                  <ul className="space-y-1.5 text-sm">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2"><CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {b}</li>
                    ))}
                  </ul>
                  <Button variant="link" className="px-0" render={<Link href={`/features/${f.slug}`} />}>
                    Learn more <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
                <Screenshot src={f.screenshot} alt={f.title} sizes="(min-width: 1024px) 700px, 100vw" />
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <div className="mt-8 text-center">
          <Button variant="outline" render={<Link href="/features" />}>
            All features <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </Section>

      {/* Stats */}
      <Section>
        <div className="grid gap-6 rounded-2xl border bg-card p-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Trust */}
      <Section muted>
        <SectionHeading eyebrow="Built to be trusted" title="AI that stays grounded in your data" description="Welya never invents a task, a course or a date. Every answer is checked against what's actually in your account." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { icon: ShieldCheckIcon, title: "Grounded answers", text: "Replies are generated from your own tasks, schedule and documents, in a strict schema. Referenced items are verified before they're shown." },
            { icon: ZapIcon, title: "Always available", text: "If the AI service is down, Welya falls back to its deterministic rule engine. You never lose planning or reminders." },
            { icon: MonitorIcon, title: "Your data, your call", text: "Export everything as JSON or delete your account and all its data from Settings. Uploaded files are only accessible to you." },
          ].map((c) => (
            <Card key={c.title}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><c.icon className="size-4" /></div>
                <CardTitle>{c.title}</CardTitle>
                <CardDescription>{c.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Button variant="link" render={<Link href="/security" />}>
            Read about security & privacy <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </Section>

      {/* Testimonials */}
      <Section>
        <SectionHeading eyebrow="Students say" title="Less remembering. More studying." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.name} className="gap-3">
              <CardContent className="pt-1">
                <p className="text-sm leading-relaxed">“{t.quote}”</p>
              </CardContent>
              <CardHeader className="pt-0">
                <div className="flex items-center gap-3">
                  <Avatar><AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{t.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback></Avatar>
                  <div>
                    <CardTitle className="text-sm">{t.name}</CardTitle>
                    <CardDescription className="text-xs">{t.role}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      <CTA />
    </>
  )
}
