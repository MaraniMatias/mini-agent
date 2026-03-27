import { resolve } from "path";
import readline from "readline";
import { buildSystem } from "./system.ts";
import { runTurn } from "./loop.ts";
import { label } from "./log.ts";
import type { Message, LLMProvider, Skill } from "./types.ts";

export function parseArgs(): { projectPath: string; prompt: string | null; provider: LLMProvider; verbose: boolean } {
  const args = process.argv.slice(2);

  const flagIndex = args.indexOf("--project");
  if (flagIndex === -1 || !args[flagIndex + 1]) {
    console.error('Usage: bun run agent.ts --project <path> [--local] [--verbose] ["<prompt>"]');
    process.exit(1);
  }

  const projectPath = resolve(args[flagIndex + 1]);
  const provider: LLMProvider = args.includes("--local") ? "ollama" : "anthropic";
  const verbose = args.includes("--verbose");

  const prompt =
    args
      .filter((_, i) => i !== flagIndex && i !== flagIndex + 1)
      .filter((a) => a !== "--local" && a !== "--verbose")
      .join(" ") || null;

  return { projectPath, prompt, provider, verbose };
}

export async function run(
  userPrompt: string,
  skills: Skill[],
  projectPath: string,
  provider: LLMProvider,
  verbose: boolean,
): Promise<void> {
  const messages: Message[] = [buildSystem(skills, projectPath, provider), { role: "user", content: userPrompt }];
  await runTurn(messages, skills, projectPath, provider, verbose);
}

export async function runInteractive(
  skills: Skill[],
  projectPath: string,
  provider: LLMProvider,
  verbose: boolean,
): Promise<void> {
  const messages: Message[] = [buildSystem(skills, projectPath, provider)];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

  console.log('Chat started. Type "exit" to quit.\n');

  while (true) {
    const input = (await ask(label.user(""))).trim();
    if (!input) continue;
    if (input === "exit" || input === "quit") break;

    messages.push({ role: "user", content: input });
    await runTurn(messages, skills, projectPath, provider, verbose);
    console.log();
  }

  rl.close();
}
