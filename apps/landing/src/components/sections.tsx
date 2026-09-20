import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { site } from "@/lib/site"

export function Section({ id, className, children, muted = false }: { id?: string; className?: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <section id={id} className={cn("py-16 sm:py-24", muted && "bg-muted/30", className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">{children}</div>
    </section>
  )
}

export function SectionHeading({ eyebrow, title, description, align = "center", className }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; align?: "center" | "left"; className?: string }) {
  return (
    <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="text-xs font-medium tracking-wider text-primary uppercase">{eyebrow}</p>}
      <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className="text-base text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  )
}

export function PageHero({ eyebrow, title, description, children, className }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <section className={cn("relative overflow-hidden", className)}>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent)]" />
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          {eyebrow && <p className="text-xs font-medium tracking-wider text-primary uppercase">{eyebrow}</p>}
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
          {description && <p className="text-lg text-muted-foreground text-balance">{description}</p>}
          {children && <div className="flex flex-wrap items-center justify-center gap-3 pt-2">{children}</div>}
        </div>
      </div>
    </section>
  )
}

export function Screenshot({ src, alt, priority = false, className, sizes = "(min-width: 1024px) 1100px, 100vw" }: { src: string; alt: string; priority?: boolean; className?: string; sizes?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-2xl shadow-black/10 ring-1 ring-foreground/5 dark:shadow-black/40", className)}>
      <Image src={src} alt={alt} width={2880} height={1800} priority={priority} sizes={sizes} className="h-auto w-full" />
    </div>
  )
}

export function CTA({ title = "Let Welya handle the secretarial work.", description = "Completely free for students. Web and desktop.", className }: { title?: string; description?: string; className?: string }) {
  return (
    <Section className={className}>
      <div className="relative overflow-hidden rounded-2xl border bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-primary-foreground/5 blur-3xl" />
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">{description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="secondary" render={<a href={`${site.appUrl}/register`} />}>
            Create your free account <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <Button size="lg" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" render={<Link href="/download" />}>
            Download for desktop
          </Button>
        </div>
      </div>
    </Section>
  )
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-5 text-base leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-medium [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground", className)}>{children}</div>
}
