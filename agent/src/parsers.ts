// Parsers for extracting tags, tools, and skill calls from LLM responses

export function extractTag(text: string, tagName: string): string | null {
  const regex = new RegExp(`<\\[${tagName}\\]>([\\s\\S]*?)<\\[/${tagName}\\]>`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

export function extractTool(text: string): { name: string; params: Record<string, string> } | null {
  // Accept:
  //   canonical:  <[tool] name="write_file" path="..." content="..."/>
  //   malformed:  <tool name="write_file" .../> or <tool> name="write_file" .../>
  //   tag-as-name: <write_file path="..." content="..."/>
  const regex =
    /<\[tool\]\s+name="([^"]+)"([^>]*)\/?>|<tool[>\s]+name="([^"]+)"([^>]*)\/?>|<([a-z][a-z_]+)\s+([^>]*)\/?>/;
  const match = text.match(regex);
  if (!match) return null;

  // Group 1+2 = canonical, 3+4 = <tool name=...>, 5+6 = <toolname .../>
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
  // Accept canonical <[skill] name="..."/> and malformed <skill name="..."/> / <skill> name="..."/>
  const regex = /<\[skill\]\s+name="([^"]+)"[^>]*\/?>|<skill[>\s]+name="([^"]+)"[^>]*\/?>/;
  const match = text.match(regex);
  if (!match) return null;
  return match[1] ?? match[2];
}
