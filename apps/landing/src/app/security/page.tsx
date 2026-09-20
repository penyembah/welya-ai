import { LockIcon, KeyRoundIcon, DatabaseIcon, FileLockIcon, ShieldCheckIcon, TrashIcon } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CTA, PageHero, Prose, Section, SectionHeading } from "@/components/sections"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Security & privacy", description: "How Welya AI protects student data: per-account isolation, hashed passwords, token auth, grounded AI with validated output, export and delete at any time.", path: "/security" })

const practices = [
  { icon: KeyRoundIcon, title: "Authentication", text: "Passwords are hashed with bcrypt. Sessions use signed JWT bearer tokens; email verification and password reset use single-use, expiring codes." },
  { icon: DatabaseIcon, title: "Per-account isolation", text: "Every table is scoped by user id and every query is filtered by the authenticated user. Deleting an account cascades to all of its data." },
  { icon: FileLockIcon, title: "Files", text: "Uploads (≤ 25 MB, PDF/DOCX/images/text) are stored outside the web root and streamed only to their owner after authentication." },
  { icon: ShieldCheckIcon, title: "Grounded AI", text: "Prompts contain only your own data. Model output must match a strict JSON schema; referenced ids are verified before display. Nothing is used to train models." },
  { icon: LockIcon, title: "Transport", text: "Production traffic is served over HTTPS. CORS is restricted to the Welya web and desktop origins." },
  { icon: TrashIcon, title: "Your controls", text: "Export all data as JSON or permanently delete your account from Settings → Privacy. AI processing of emails and documents can be switched off per category." },
]

export default function SecurityPage() {
  return (
    <>
      <PageHero eyebrow="Security & privacy" title="Your academic life, handled carefully" description="A secretary is only useful if you can trust it with everything. Here is how Welya earns that." />
      <Section className="pt-0 sm:pt-0 -mt-10">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {practices.map((p) => (
            <Card key={p.title}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><p.icon className="size-4" /></div>
                <CardTitle>{p.title}</CardTitle>
                <CardDescription>{p.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>
      <Section muted>
        <SectionHeading title="AI processing, specifically" align="left" className="max-w-3xl" />
        <Prose className="mt-6 max-w-3xl">
          <p>When you chat with Welya, confirm an inbox item, break down a task or analyze a document, the relevant slice of your data (tasks, schedule, the message or document text) is sent to a language model hosted on <strong>Azure AI Foundry</strong>. Requests are not stored by us beyond the resulting conversation you can see and delete, and are not used for model training.</p>
          <p>If the model is unavailable or returns something that fails validation, Welya uses its built-in rule engine instead and labels the answer accordingly.</p>
          <p>Found a vulnerability? Email <a href="mailto:security@welya.app" className="underline">security@welya.app</a>. We respond within 72 hours.</p>
        </Prose>
      </Section>
      <CTA />
    </>
  )
}
