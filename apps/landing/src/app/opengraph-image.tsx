import { ImageResponse } from "next/og"
import { site } from "@/lib/site"

export const alt = `${site.name} — ${site.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #151b1d 0%, #1f2428 60%, #263033 100%)", color: "#f4f6f6", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "#f4f6f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="#1f2428" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 16l9 32 10-20" />
              <path d="M27 28l10 20 9-32" opacity="0.55" />
              <path d="M56 16h0" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600 }}>{site.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>{site.tagline}.</div>
          <div style={{ display: "flex", fontSize: 30, color: "#b8c0c2", lineHeight: 1.3 }}>Lecturer emails and class messages become tasks, deadlines and a planned week.</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#b8c0c2" }}>
          {["Capture", "Understand", "Organize", "Plan", "Act", "Review"].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ display: "flex" }}>{s}</span>
              {i < 5 && <span style={{ display: "flex", color: "#5b6a6e" }}>→</span>}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
