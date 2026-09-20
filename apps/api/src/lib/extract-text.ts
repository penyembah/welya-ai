// Pulls plain text out of uploads so the LLM has something to read. Images need OCR (not wired yet).
export async function extractText(buffer: Buffer, mimetype: string, filename: string): Promise<{ text: string; pages: number | null }> {
  const name = filename.toLowerCase()
  if (mimetype === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const result = await parser.getText()
        return { text: result.text.trim(), pages: result.pages?.length ?? null }
      } finally {
        await parser.destroy()
      }
    } catch {
      return { text: "", pages: null }
    }
  }
  if (mimetype.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    return { text: buffer.toString("utf8").trim(), pages: null }
  }
  return { text: "", pages: null }
}
