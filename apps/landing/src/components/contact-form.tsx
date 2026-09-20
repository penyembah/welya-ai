"use client"

import * as React from "react"
import { CheckCircle2Icon, SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { site } from "@/lib/site"

// No backend for the marketing site: the form composes a mailto: with the message pre-filled.
export function ContactForm() {
  const [sent, setSent] = React.useState(false)
  const [form, setForm] = React.useState({ name: "", email: "", topic: "General", message: "" })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const subject = encodeURIComponent(`[${form.topic}] Message from ${form.name || "a student"}`)
    const body = encodeURIComponent(`${form.message}\n\n— ${form.name}${form.email ? ` <${form.email}>` : ""}`)
    window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-8 text-center">
        <CheckCircle2Icon className="size-8 text-primary" />
        <p className="font-medium">Your email client should have opened.</p>
        <p className="text-sm text-muted-foreground">If it didn't, write to <a className="underline" href={`mailto:${site.email}`}>{site.email}</a>.</p>
        <Button variant="ghost" size="sm" onClick={() => setSent(false)}>Send another</Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-xl border bg-card p-6">
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="c-name">Name</FieldLabel>
            <Input id="c-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="c-email">Email</FieldLabel>
            <Input id="c-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="c-topic">Topic</FieldLabel>
          <select id="c-topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30">
            {["General", "Bug report", "Feature request", "Campus partnership", "Press"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="c-msg">Message</FieldLabel>
          <Textarea id="c-msg" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          <FieldDescription>We read every message. Expect a reply within two working days.</FieldDescription>
        </Field>
        <Button type="submit"><SendIcon data-icon="inline-start" /> Send message</Button>
      </FieldGroup>
    </form>
  )
}
