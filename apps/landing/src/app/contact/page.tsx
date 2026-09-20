import { MailIcon, MessageSquareIcon, BuildingIcon } from "lucide-react"
import { PageHero, Section } from "@/components/sections"
import { ContactForm } from "@/components/contact-form"
import { site } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Contact", description: "Talk to the Welya AI team — support, feature requests, press, or Campus plans for your university.", path: "/contact" })

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to a human" description="Support, ideas, partnerships — we answer everything ourselves." />
      <Section className="pt-0 sm:pt-0 -mt-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            {[
              { icon: MailIcon, title: "Email", text: site.email, href: `mailto:${site.email}` },
              { icon: MessageSquareIcon, title: "Support", text: "Bugs, questions and how-tos. Include the page and what you expected.", href: `mailto:${site.email}?subject=Support` },
              { icon: BuildingIcon, title: "Campus partnerships", text: "Student associations, faculties and universities.", href: `mailto:${site.email}?subject=Campus%20partnership` },
            ].map((c) => (
              <a key={c.title} href={c.href} className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><c.icon className="size-4" /></div>
                <div>
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </div>
              </a>
            ))}
          </div>
          <ContactForm />
        </div>
      </Section>
    </>
  )
}
