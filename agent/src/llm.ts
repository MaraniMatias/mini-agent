import Anthropic from "@anthropic-ai/sdk";
import { logRequest, logResponse } from "./log.ts";
import { ANTHROPIC_MAX_TOKENS } from "./constants.ts";
import type { ToolDefinition, Message, LLMProvider, ChatResult, ContentBlock } from "./types.ts";

export function contentAsText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .map((b) =>
      b.type === "text" ? b.text : b.type === "tool_use" ? `[tool_use: ${b.name}]` : `[tool_result: ${b.content}]`,
    )
    .join("\n");
}

const anthropic = new Anthropic();

function toAnthropicTool(t: ToolDefinition): Anthropic.Tool {
  return {
    name: t.name,
    description: t.description,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(t.params).map(([k, desc]) => [k, { type: "string", description: desc }]),
      ),
      required: Object.keys(t.params),
    },
  };
}

async function chatAnthropic(messages: Message[], toolDefs: ToolDefinition[], verbose = false): Promise<ChatResult> {
  const system = messages.find((m) => m.role === "system");
  const systemText = system ? contentAsText(system.content) : "";
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as any,
    }));

  if (verbose) logRequest(messages);

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    system: systemText,
    messages: rest,
    ...(toolDefs.length > 0 ? { tools: toolDefs.map(toAnthropicTool) } : {}),
  });

  for (const block of response.content) {
    if (block.type === "thinking") console.log("\n[thinking]:", block.thinking);
  }

  if (verbose) {
    const displayText = response.content
      .map((b) => (b.type === "text" ? b.text : b.type === "tool_use" ? `[tool_use: ${b.name}]` : ""))
      .join("\n");
    logResponse(
      `input_tokens: ${response.usage.input_tokens}  output_tokens: ${response.usage.output_tokens}`,
      displayText,
    );
  }

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (toolBlock?.type === "tool_use") {
    return {
      type: "tool_use",
      block: {
        type: "tool_use",
        id: toolBlock.id,
        name: toolBlock.name,
        input: toolBlock.input as Record<string, unknown>,
      },
    };
  }

  const textBlock = response.content.find((b) => b.type === "text");
  return { type: "text", text: textBlock?.type === "text" ? textBlock.text : "" };
}

async function chatOllama(messages: Message[], verbose = false): Promise<ChatResult> {
  const serialized = messages.map((m) => ({ role: m.role, content: contentAsText(m.content) }));

  if (verbose) logRequest(messages);

  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OLLAMA_MODEL, messages: serialized, stream: false }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Ollama error: ${JSON.stringify(data)}`);

  const raw: string = data.message.content;

  if (verbose) {
    logResponse(`eval_count: ${data.eval_count ?? "?"}  prompt_eval_count: ${data.prompt_eval_count ?? "?"}`, raw);
  }

  const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) console.log("\n[thinking]:", thinkMatch[1].trim());

  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return { type: "text", text };
}

export async function chat(
  messages: Message[],
  provider: LLMProvider,
  toolDefs: ToolDefinition[],
  verbose = false,
): Promise<ChatResult> {
  switch (provider) {
    case "anthropic":
      return chatAnthropic(messages, toolDefs, verbose);
    case "ollama":
      return chatOllama(messages, verbose);
  }
}
