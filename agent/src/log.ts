import type { Message } from "./llm.ts";

const c = {
  reset:     "\x1b[0m",
  dim:       "\x1b[2m",
  bold:      "\x1b[1m",
  system:    "\x1b[36m",   // cyan
  user:      "\x1b[32m",   // green
  assistant: "\x1b[33m",   // yellow
  model:     "\x1b[97m",   // bright white
  label:     "\x1b[35m",   // magenta  — [tool], [skill], [written]
  meta:      "\x1b[2m",    // dim gray — verbose metadata lines
};

const W = 51;

function roleColor(role: string): string {
  return (c as Record<string, string>)[role] ?? c.reset;
}

function box(title: string, lines: string[]): void {
  const bar = "─".repeat(W);
  const body = lines.flatMap((l) => l.split("\n").map((s) => `${c.dim}│${c.reset} ${s}`));
  console.log(`\n${c.dim}┌─── ${title} ${bar.slice(title.length + 5)}${c.reset}`);
  console.log(body.join("\n"));
  console.log(`${c.dim}└${"─".repeat(W + 2)}${c.reset}\n`);
}

export function logRequest(messages: Message[]): void {
  console.log(`\n${c.meta}[verbose] sending ${messages.length} messages to model${c.reset}`);
  box("payload", messages.flatMap((m, i) => {
    const color = roleColor(m.role);
    return [
      `${color}[${i}] ${m.role}${c.reset}${c.dim} (${m.content.length} chars)${c.reset}`,
      m.content,
      "",
    ];
  }));
}

export function logResponse(meta: string, text: string): void {
  console.log(`\n${c.meta}[verbose] model response  ${meta}${c.reset}`);
  box("payload", [text]);
}

export function logSkill(name: string, tools: string[] | null, content: string): void {
  console.log(`\n${c.meta}[verbose] skill loaded${c.reset}`);
  box(name, [
    ...(tools ? [`${c.dim}tools: ${tools.join(", ")}${c.reset}`] : []),
    ...(tools ? [""] : []),
    content,
  ]);
}

export function logToolCall(name: string, params: Record<string, string>): void {
  const paramLines = Object.entries(params).map(([k, v]) => `  ${c.dim}${k}:${c.reset} ${v}`);
  console.log(`\n${c.meta}[verbose] tool call${c.reset}`);
  box(name, paramLines.length ? ["params:", ...paramLines] : []);
}

export function logToolResult(result: string): void {
  console.log(`${c.meta}[verbose] tool result${c.reset}`);
  box("result", [result]);
}

// colored labels for the main chat flow
export const label = {
  model:   (text: string) => `${c.bold}${c.assistant}agent:${c.reset} ${text}`,
  user:    (text: string) => `${c.bold}${c.user}you:${c.reset} ${text}`,
  tool:    (name: string) => `${c.label}[tool]${c.reset} ${name}`,
  skill:   (name: string) => `${c.label}[skill]${c.reset} ${name}`,
  written: (path: string) => `${c.label}[written]${c.reset} ${path}`,
  blocked: (name: string) => `${c.label}[tool blocked]${c.reset} ${name}`,
};
