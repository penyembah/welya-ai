import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { CTA, PageHero, Section } from "@/components/sections"
import { faqs } from "@/lib/site"
import { JsonLd, pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "FAQ", description: "Answers about how Welya AI works, which languages and sources it supports, how your data is protected, and what it costs.", path: "/faq" })

export default function FaqPage() {
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
  return (
    <>
      <JsonLd data={ld} />
      <PageHero eyebrow="FAQ" title="Questions students ask us" description="Can't find yours? Write to us — a human answers." >
        <Button variant="outline" render={<Link href="/contact" />}>Contact <ArrowRightIcon data-icon="inline-end" /></Button>
      </PageHero>
      <Section>
        <Accordion className="mx-auto max-w-3xl">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Section>
      <CTA />
    </>
  )
}
