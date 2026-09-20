import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CTA, PageHero, Prose, Section, SectionHeading } from "@/components/sections"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "About", description: "Why we built Welya AI: students shouldn't have to be their own secretaries. Our principles: grounded AI, you confirm, your data is yours.", path: "/about" })

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title="Students shouldn't have to be their own secretaries" description="Welya started as a college project with a simple frustration: the hardest part of an assignment was often just knowing it existed." />
      <Section>
        <Prose className="mx-auto max-w-3xl">
          <p>Between lecture announcements, group chats, emails and LMS notifications, a typical semester generates hundreds of small pieces of information that each need to become <strong>a task with a date</strong>. Most of that translation work falls on the student — and it's precisely the work that gets dropped during the busiest weeks.</p>
          <p>We asked a different question: what if the software did the secretarial part? Not another list to fill in, but something that <strong>reads what arrives</strong>, works out what it means, and hands back a plan that respects your actual timetable.</p>
          <h2>What we believe</h2>
          <ul>
            <li><strong>Understanding beats recording.</strong> Capturing is easy; the value is in interpretation — type, course, date, next step.</li>
            <li><strong>You confirm.</strong> AI proposes; the student decides. Every automatic action is visible and reversible.</li>
            <li><strong>Grounded or nothing.</strong> Welya never invents a task, course or date. If it can't answer from your data, it says so.</li>
            <li><strong>Plans respect reality.</strong> Free time is computed from real classes and events, not wished into existence.</li>
            <li><strong>Your data is yours.</strong> Export everything, delete everything, any time.</li>
          </ul>
          <h2>Where we are</h2>
          <p>Welya V2 is in open beta and completely free for students — there is no paid tier. The core loop — Capture → Understand → Organize → Plan → Act → Review — is complete; integrations with Gmail, Google Calendar and campus LMS systems are next.</p>
        </Prose>
      </Section>
      <Section muted>
        <SectionHeading title="Follow the build" description="We publish what we ship and what we learn." />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="outline" render={<Link href="/changelog" />}>Changelog <ArrowRightIcon data-icon="inline-end" /></Button>
          <Button variant="outline" render={<Link href="/blog" />}>Blog <ArrowRightIcon data-icon="inline-end" /></Button>
          <Button variant="outline" render={<Link href="/contact" />}>Contact <ArrowRightIcon data-icon="inline-end" /></Button>
        </div>
      </Section>
      <CTA />
    </>
  )
}
