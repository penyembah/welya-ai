import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

// Renders Welya's replies. Links stay in-app friendly (open external ones in a new tab).
export function Markdown({ children, className, compact = true }) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words",
        "prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-headings:font-heading prose-headings:font-medium prose-h1:text-base prose-h2:text-sm prose-h3:text-sm",
        "prose-strong:font-semibold prose-code:rounded prose-code:bg-background/60 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:my-2 prose-pre:rounded-lg prose-pre:bg-background/70 prose-pre:text-foreground prose-table:my-2 prose-th:py-1 prose-td:py-1 prose-blockquote:my-2 prose-blockquote:border-primary/40 prose-hr:my-3",
        compact && "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: c }) => {
            const external = /^https?:\/\//.test(href ?? "")
            return (
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer noopener" : undefined} className="text-primary underline underline-offset-2">
                {c}
              </a>
            )
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
