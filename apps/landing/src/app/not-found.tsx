import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHero } from "@/components/sections"

export default function NotFound() {
  return (
    <PageHero eyebrow="404" title="This page isn't on the schedule" description="The link may be outdated. Let's get you back.">
      <Button render={<Link href="/" />}><ArrowLeftIcon data-icon="inline-start" /> Back to home</Button>
      <Button variant="outline" render={<Link href="/features" />}>Explore features</Button>
    </PageHero>
  )
}
