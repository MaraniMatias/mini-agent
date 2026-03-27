// Parsers for extracting tags, tools, and skill calls from LLM responses

export function extractTag(text: string, tagName: string): string | null {
  const regex = new RegExp(`<\\[${tagName}\\]>([\\s\\S]*?)<\\[/${tagName}\\]>`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

export function extractTool(text: string): { name: string; params: Record<string, string> } | null {
  // Body-content form: <tool name="write_file" path="README.md">\ncontent\n</tool>
  // Also accepts legacy: <[tool] name="...">...</[tool]>
  const bodyPrimary = text.match(/<tool\s+name="([^"]+)"([^>]*)>\n?([\s\S]*?)<\/tool>/);
  const bodyLegacy = text.match(/<\[tool\]\s+name="([^"]+)"([^>]*)>\n?([\s\S]*?)<\/\[tool\]>/);
  const bodyMatch = bodyPrimary ?? bodyLegacy;
  if (bodyMatch) {
    const name = bodyMatch[1];
    const paramsStr = bodyMatch[2];
    const body = bodyMatch[3];
    const params: Record<string, string> = {};
    const paramRegex = /(\w+)="([^"]*)"/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
      params[paramMatch[1]] = paramMatch[2];
    }
    params.content = body;
    return { name, params };
  }

  // Self-closing forms:
  //   canonical:   <tool name="write_file" path="..." content="..."/>
  //   legacy:      <[tool] name="write_file" path="..." content="..."/>
  //   tag-as-name: <write_file path="..." content="..."/>
  const regex = /<tool\s+name="([^"]+)"([^>]*)\/?>|<\[tool\]\s+name="([^"]+)"([^>]*)\/?>|<([a-z][a-z_]+)\s+([^>]*)\/?>/;
  const match = text.match(regex);
  if (!match) return null;

  // Group 1+2 = canonical new, 3+4 = legacy with brackets, 5+6 = tag-as-name
  const name = match[1] ?? match[3] ?? match[5];
  const paramsStr = match[2] ?? match[4] ?? match[6];

  const params: Record<string, string> = {};

  const paramRegex = /(\w+)="([^"]*)"/g;
  let paramMatch;
  while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
    params[paramMatch[1]] = paramMatch[2];
  }

  return { name, params };
}

export function extractSkillCall(text: string): string | null {
  // Accept canonical <skill name="..."/> and legacy <[skill] name="..."/> / <skill> name="..."/>
  const regex =
    /<skill\s+name="([^"]+)"[^>]*\/?>|<\[skill\]\s+name="([^"]+)"[^>]*\/?>|<skill[>\s]+name="([^"]+)"[^>]*\/?>/;
  const match = text.match(regex);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3];
}

export type MalformedToolResult = {
  name: string | null; // tool name if extractable, null otherwise
  reason: string; // what went wrong
};

export function detectMalformedTool(text: string): MalformedToolResult | null {
  // Only fire if there's clear tool-call intent
  if (!/<tool[\s>]|<\[tool\][\s]/.test(text)) return null;

  // Well-formed tag: all attribute values properly quoted and self-closed (both forms)
  if (/<tool\s+(?:\w+="[^"]*"\s*)*\/>/.test(text) || /<\[tool\]\s+(?:\w+="[^"]*"\s*)*\/>/.test(text)) return null;

  // Try to extract the name (permissive — stop at space, quote, or >)
  const nameMatch = text.match(/(?:<\[tool\]|<tool)\s+name="([^"\s>]+)/);
  const name = nameMatch?.[1] ?? null;

  // 1. Unescaped " inside a value: strip well-formed key="value" pairs; leftover " means embedded quotes
  const attrRegion = text.match(/<(?:\[tool\]|tool)([\s\S]*?)(?:\/?>|$)/)?.[1] ?? "";
  const stripped = attrRegion.replace(/\s*\w+="[^"]*"/g, "").replace(/\s/g, "");
  if (stripped.includes('"')) {
    return { name, reason: 'attribute value contains unescaped `"` — values must not contain raw double quotes' };
  }

  // 2. Tag not self-closed with />
  const tagChunk = text.match(/<(?:\[tool\]|tool)[^>]*>?/)?.[0] ?? "";
  if (!tagChunk.endsWith("/>") && !text.includes("/>")) {
    return { name, reason: 'tag is not self-closed — add `/>` at the end: `<tool name="..." param="value"/>`' };
  }

  // Generic fallback
  return { name, reason: "malformed attribute syntax — check that all values are quoted and the tag ends with `/>`" };
}
