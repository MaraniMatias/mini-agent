const W = 51;
const BAR = "─".repeat(W);

function box(title: string, lines: string[]): void {
  const body = lines.flatMap((l) => l.split("\n").map((s) => `│ ${s}`));
  console.log(`\n┌─── ${title} ${BAR.slice(title.length + 5)}`);
  console.log(body.join("\n"));
  console.log(`└${"─".repeat(W + 2)}\n`);
}

import type { Message } from "./llm.ts";

export function logRequest(messages: Message[]): void {
  console.log(`\n[verbose] sending ${messages.length} messages to model`);
  box("payload", messages.flatMap((m, i) => [
    `[${i}] ${m.role} (${m.content.length} chars)`,
    m.content,
    "",
  ]));
}

export function logResponse(meta: string, text: string): void {
  console.log(`\n[verbose] model response  ${meta}`);
  box("payload", [text]);
}

export function logSkill(name: string, tools: string[] | null, content: string): void {
  box("[verbose] skill loaded", [
    `name: ${name}`,
    ...(tools ? [`tools: ${tools.join(", ")}`] : []),
    "",
    content,
  ]);
}

export function logToolCall(name: string, params: Record<string, string>): void {
  const paramLines = Object.entries(params).map(([k, v]) => `  ${k}: ${v}`);
  box("[verbose] tool call", [`name: ${name}`, ...(paramLines.length ? ["params:", ...paramLines] : [])]);
}

export function logToolResult(result: string): void {
  box("[verbose] tool result", [result]);
}
