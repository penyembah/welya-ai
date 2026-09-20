"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon, ArrowRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { WelyaLogo } from "@/components/welya-logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { nav, site } from "@/lib/site"

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className={cn("sticky top-0 z-40 w-full border-b border-transparent bg-background/70 backdrop-blur transition-colors", scrolled && "border-border/60 bg-background/85")}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <WelyaLogo className="size-4.5" />
          </span>
          <span className="font-heading text-base font-semibold tracking-tight">{site.name}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {nav.main.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link key={item.href} href={item.href} className={cn("rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground", active && "bg-muted text-foreground")}>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <Button variant="ghost" size="sm" render={<a href={`${site.appUrl}/login`} />}>
            Sign in
          </Button>
          <Button size="sm" render={<a href={`${site.appUrl}/register`} />}>
            Get started <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Open menu" />}>
              <MenuIcon />
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <WelyaLogo className="size-4 text-primary" /> {site.name}
                </SheetTitle>
                <SheetDescription>{site.tagline}</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
                {nav.main.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm hover:bg-muted">
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-2 p-4">
                <Button variant="outline" render={<a href={`${site.appUrl}/login`} />}>
                  Sign in
                </Button>
                <Button render={<a href={`${site.appUrl}/register`} />}>
                  Get started <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
