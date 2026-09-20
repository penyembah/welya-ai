import { PageHero, Prose, Section } from "@/components/sections"
import { site } from "@/lib/site"
import { pageMetadata } from "@/lib/seo"

export const metadata = pageMetadata({ title: "Privacy Policy", description: "What Welya AI collects, why, how long it is kept, and the controls you have over your data.", path: "/privacy" })

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" description="Last updated: 20 September 2026" />
      <Section>
        <Prose className="mx-auto max-w-3xl">
          <h2>1. Who we are</h2>
          <p>{site.name} (“Welya”, “we”) provides an AI academic secretary for students at {site.url}. Contact: <a href={`mailto:${site.email}`} className="underline">{site.email}</a>.</p>
          <h2>2. What we collect</h2>
          <ul>
            <li><strong>Account data</strong>: name, email, university, program, semester, hashed password, avatar (optional).</li>
            <li><strong>Content you add</strong>: tasks, events, courses, workspaces, notes, inbox items (including pasted messages), uploaded files and their extracted text, conversations with Welya, settings.</li>
            <li><strong>Technical data</strong>: request logs (IP address, user agent, timestamps) retained for up to 30 days for security and debugging.</li>
          </ul>
          <h2>3. How we use it</h2>
          <p>To provide the service: interpreting your inbox, planning your calendar, answering questions, sending reminders you configure, and keeping your data in sync across devices. We do not sell personal data and do not show advertising.</p>
          <h2>4. AI processing</h2>
          <p>Selected content (the message, document or your task/schedule context) is sent to a language model hosted on Microsoft Azure AI Foundry to generate interpretations, plans and replies. Content is not used to train models. You can disable AI processing of emails and documents in Settings → Privacy.</p>
          <h2>5. Storage and retention</h2>
          <p>Data is stored in a PostgreSQL database and file storage operated by us. It is retained until you delete it or your account. Deleting your account removes all associated data immediately; backups expire within 30 days.</p>
          <h2>6. Your rights</h2>
          <p>You can access and export all your data (Settings → Privacy → Export data), correct it in the app, or delete your account at any time. For any other request, email us.</p>
          <h2>7. Cookies</h2>
          <p>The marketing site sets no tracking cookies. The application stores an authentication token and your theme preference in local storage on your device.</p>
          <h2>8. Changes</h2>
          <p>We will post changes to this policy here and update the date above. Material changes will be announced in the app.</p>
        </Prose>
      </Section>
    </>
  )
}
