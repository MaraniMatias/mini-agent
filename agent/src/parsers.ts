// Parsers for extracting tags, tools, and skill calls from LLM responses

export function extractTag(text: string, tagName: string): string | null {
  const regex = new RegExp(`<\\[${tagName}\\]>([\\s\\S]*?)<\\[/${tagName}\\]>`);
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

export function extractTool(text: string): { name: string; params: Record<string, string> } | null {
  const regex = /<\[tool\] name="([^"]+)"([^>]*)\/?>/;
  const match = text.match(regex);
  if (!match) return null;

  const name = match[1];
  const paramsStr = match[2];
  const params: Record<string, string> = {};

  const paramRegex = /(\w+)="([^"]*)"/g;
  let paramMatch;
  while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
    params[paramMatch[1]] = paramMatch[2];
  }

  return { name, params };
}

export function extractSkillCall(text: string): string | null {
  const regex = /<\[skill\] name="([^"]+)"[^>]*\/?>/;
  const match = text.match(regex);
  return match ? match[1] : null;
}
