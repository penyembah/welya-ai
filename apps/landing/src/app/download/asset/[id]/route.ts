import { NextResponse } from "next/server"
import { GITHUB_REPO, GITHUB_TOKEN, githubHeaders } from "@/lib/releases"

// Lets visitors download installers from a private repo: GitHub answers the authenticated asset
// request with a 302 to a short-lived signed URL, which we hand straight to the browser.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^\d+$/.test(id)) return new NextResponse("Not found", { status: 404 })
  if (!GITHUB_TOKEN) return NextResponse.redirect(`https://github.com/${GITHUB_REPO}/releases/latest`, 302)

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/assets/${id}`, {
    headers: githubHeaders("application/octet-stream"),
    redirect: "manual",
    cache: "no-store",
  })
  const location = res.headers.get("location")
  if (location) return NextResponse.redirect(location, 302)
  if (!res.ok || !res.body) return new NextResponse("Asset not found", { status: 404 })

  // Fallback if GitHub streams the file directly instead of redirecting.
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? "attachment",
      ...(res.headers.get("content-length") ? { "Content-Length": res.headers.get("content-length")! } : {}),
    },
  })
}
