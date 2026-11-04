/** Accept one JSON document, optionally wrapped in a Markdown code fence. Never extract prose fragments. */
export function parseModelJson(text: string): unknown {
  const value = text.trim()
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/iu.exec(value)
  return JSON.parse(fenced?.[1] ?? value) as unknown
}
