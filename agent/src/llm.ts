import Anthropic from "@anthropic-ai/sdk";

export type Message = { role: "system" | "user" | "assistant"; content: string };
export type LLMProvider = "anthropic" | "ollama";

const anthropic = new Anthropic();

async function chatAnthropic(messages: Message[]): Promise<string> {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const rest = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL,
    max_tokens: 4096,
    system,
    messages: rest,
  });

  for (const block of response.content) {
    if (block.type === "thinking") {
      console.log("\n[thinking]:", block.thinking);
    }
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text block in Anthropic response");
  return textBlock.text;
}

async function chatOllama(messages: Message[]): Promise<string> {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OLLAMA_MODEL, messages, stream: false }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Ollama error: ${JSON.stringify(data)}`);

  const raw: string = data.message.content;

  const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/);
  if (thinkMatch) {
    console.log("\n[thinking]:", thinkMatch[1].trim());
  }

  return raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export async function chat(messages: Message[], provider: LLMProvider): Promise<string> {
  switch (provider) {
    case "anthropic":
      return chatAnthropic(messages);
    case "ollama":
      return chatOllama(messages);
  }
}

