import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CTA, PageHero, Screenshot, Section, SectionHeading } from "@/components/sections"
import { pipeline, site } from "@/lib/site"
import { JsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "How it works", description: "Capture, Understand, Organize, Plan, Act, Review — the six steps Welya AI uses to turn academic information into a plan you can follow.", path: "/how-it-works" })

const howToLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How Welya AI turns a lecturer's message into a scheduled task",
  step: pipeline.map((p, i) => ({ "@type": "HowToStep", position: i + 1, name: p.title, text: p.text })),
}

const SHOTS: Record<string, string> = { "01": "/screenshots/inbox-dark.png", "02": "/screenshots/inbox-dark.png", "03": "/screenshots/tasks-dark.png", "04": "/screenshots/calendar-dark.png", "05": "/screenshots/dashboard-dark.png", "06": "/screenshots/review-dark.png" }

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={howToLd} />
      <PageHero eyebrow="How it works" title="Six steps, one secretary" description="Welya is opinionated about the flow of academic information: it should be captured once, understood by a machine, confirmed by you, and planned around your real timetable.">
        <Button size="lg" render={<a href={`${site.appUrl}/register`} />}>Start for free <ArrowRightIcon data-icon="inline-end" /></Button>
      </PageHero>

      {pipeline.map((p, i) => (
        <Section key={p.step} muted={i % 2 === 1} className="py-14 sm:py-20">
          <div className={`grid items-center gap-10 lg:grid-cols-[1fr_1.4fr] ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
            <div className="space-y-4">
              <span className="font-mono text-sm text-primary">Step {p.step}</span>
              <h2 className="font-heading text-3xl font-semibold tracking-tight">{p.title}</h2>
              <p className="text-lg text-muted-foreground">{p.text}</p>
              <p className="text-sm text-muted-foreground">{DETAILS[p.step]}</p>
            </div>
            <Screenshot src={SHOTS[p.step]} alt={`${p.title} in Welya`} sizes="(min-width: 1024px) 640px, 100vw" />
          </div>
        </Section>
      ))}

      <Section>
        <SectionHeading eyebrow="Under the hood" title="Deterministic where it should be, generative where it helps" description="Planning free time is an algorithm: it respects your classes, task durations and priorities exactly. Understanding messages and writing summaries uses a language model — constrained to your data and validated before display." />
        <div className="mt-8 text-center">
          <Button variant="outline" render={<Link href="/blog/ai-that-does-not-make-things-up" />}>Read how we keep the AI grounded <ArrowRightIcon data-icon="inline-end" /></Button>
        </div>
      </Section>
      <CTA />
    </>
  )
}

const DETAILS: Record<string, string> = {
  "01": "Paste a message, upload a PDF or screenshot, or type a note. Later, connected Gmail and LMS accounts will feed the inbox automatically.",
  "02": "Welya extracts the type, course, dates, times and requirements, and shows a confidence score. Low confidence? It tells you to double-check.",
  "03": "One click creates a task with subtasks, a calendar event, a reminder or a note — all linked to the course and to the original message.",
  "04": "Plan my day / Plan my week look at 08:00–18:00, find hour-long gaps between classes, and propose sessions sized to each task's remaining effort.",
  "05": "Work from the dashboard's priority list. Tick subtasks, schedule more time, or ask Welya what to do next.",
  "06": "The weekly review reports completed vs remaining work, your busiest day and course, and one suggestion for the week ahead.",
}
