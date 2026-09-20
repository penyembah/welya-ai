import { PageHero, Prose, Section } from "@/components/sections"
import { site } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Terms of Service", description: "The terms that govern your use of Welya AI.", path: "/terms" })

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of Service" description="Last updated: 20 September 2026" />
      <Section>
        <Prose className="mx-auto max-w-3xl">
          <h2>1. Acceptance</h2>
          <p>By creating an account or using {site.name} you agree to these terms and to our Privacy Policy.</p>
          <h2>2. The service</h2>
          <p>Welya helps you organise academic information using automated interpretation and planning. Suggestions are aids, not guarantees: you remain responsible for checking deadlines and requirements against official sources from your institution.</p>
          <h2>3. Your account</h2>
          <p>You must provide accurate information and keep your password confidential. You are responsible for activity under your account. One person per account.</p>
          <h2>4. Acceptable use</h2>
          <ul>
            <li>Do not upload content you do not have the right to share.</li>
            <li>Do not attempt to access other users&apos; data or disrupt the service.</li>
            <li>Do not use Welya to violate your institution&apos;s academic integrity rules.</li>
          </ul>
          <h2>5. Content</h2>
          <p>You own the content you add. You grant us a limited licence to store and process it solely to provide the service to you.</p>
          <h2>6. Beta and availability</h2>
          <p>Welya is provided in beta “as is”. We aim for high availability but do not guarantee it, and features may change. AI features depend on third-party model providers and may fall back to non-AI behaviour.</p>
          <h2>7. Fees</h2>
          <p>Welya is free of charge. We do not sell subscriptions, collect payment details or charge for any feature.</p>
          <h2>8. Termination</h2>
          <p>You may delete your account at any time. We may suspend accounts that violate these terms.</p>
          <h2>9. Liability</h2>
          <p>To the extent permitted by law, Welya is not liable for indirect damages, including missed deadlines or academic outcomes.</p>
          <h2>10. Contact</h2>
          <p><a href={`mailto:${site.email}`} className="underline">{site.email}</a></p>
        </Prose>
      </Section>
    </>
  )
}
