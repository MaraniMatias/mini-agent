import { chat, type Message, type LLMProvider } from "./src/llm.ts";
import { loadSkills, type Skill } from "./src/skills.ts";
import { buildSystem } from "./src/system.ts";
import { extractTag, extractTool, extractSkillCall } from "./src/parsers.ts";
import { handleTool, tools } from "./src/tools.ts";
import { logSkill, logToolCall, logToolResult } from "./src/log.ts";
import { resolve } from "path";
import { existsSync } from "fs";
import readline from "readline";

// Usage:
//   bun run agent.ts --project <path> "prompt"                    ← single prompt
//   bun run agent.ts --project <path>                             ← interactive chat
//   bun run agent.ts --project <path> --local [--verbose] [...]   ← ollama

function parseArgs(): { projectPath: string; prompt: string | null; provider: LLMProvider; verbose: boolean } {
  const args = process.argv.slice(2);

  const flagIndex = args.indexOf("--project");
  if (flagIndex === -1 || !args[flagIndex + 1]) {
    console.error("Usage: bun run agent.ts --project <path> [--local] [--verbose] [\"<prompt>\"]");
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

// Runs one agentic turn starting from the last user message already in `messages`.
// Mutates messages in place (pushes assistant replies, tool results, etc.).
async function runTurn(
  messages: Message[],
  skills: Skill[],
  projectPath: string,
  provider: LLMProvider,
  verbose: boolean
): Promise<void> {
  let allowedTools: string[] | null = null;

  while (true) {
    const reply = await chat(messages, provider, verbose);
    console.log("\n[model]:", reply);

    // file output
    const codeBlock = extractTag(reply, "code");
    if (codeBlock) {
      const file = JSON.parse(codeBlock) as { filename: string; content: string };
      const dest = `${projectPath}/${file.filename}`;
      await Bun.write(dest, file.content);
      console.log(`[written]: ${dest}`);
      messages.push({ role: "assistant", content: reply });
      break;
    }

    // skill call
    const skillName = extractSkillCall(reply);
    if (skillName) {
      const skill = skills.find((s) => s.name === skillName);
      if (skill) {
        allowedTools = skill.tools ?? null;
        let body = skill.content;
        if (skill.tools) body = `[Available tools: ${skill.tools.join(", ")}]\n${body}`;
        console.log(`\n[skill]: ${skillName}`);
        if (verbose) logSkill(skillName, allowedTools, body);
        messages.push({ role: "assistant", content: reply });
        messages.push({ role: "user", content: `<[skill_result] name="${skillName}">\n${body}\n</[skill_result]>` });
        continue;
      }
      // skill name not found — fall through to tool check
    }

    // tool call
    const tool = extractTool(reply);
    if (tool) {
      if (allowedTools !== null && !allowedTools.includes(tool.name)) {
        const err = `Tool "${tool.name}" is not allowed in this skill context. Allowed: ${allowedTools.join(", ")}`;
        console.log(`\n[tool blocked]: ${tool.name}`);
        messages.push({ role: "assistant", content: reply });
        messages.push({ role: "user", content: `<[tool_result]>${err}</[tool_result]>` });
        continue;
      }
      console.log(`\n[tool]: ${tool.name}`);
      if (verbose) logToolCall(tool.name, tool.params);
      const result = await handleTool(tool, projectPath);
      if (verbose) logToolResult(result);
      messages.push({ role: "assistant", content: reply });
      messages.push({ role: "user", content: `<[tool_result]>${result}</[tool_result]>` });
      continue;
    }

    messages.push({ role: "assistant", content: reply });
    break;
  }
}

async function run(
  userPrompt: string,
  skills: Skill[],
  projectPath: string,
  provider: LLMProvider,
  verbose: boolean
): Promise<void> {
  const messages: Message[] = [
    buildSystem(skills, projectPath),
    { role: "user", content: userPrompt },
  ];
  await runTurn(messages, skills, projectPath, provider, verbose);
}

async function runInteractive(
  skills: Skill[],
  projectPath: string,
  provider: LLMProvider,
  verbose: boolean
): Promise<void> {
  const messages: Message[] = [buildSystem(skills, projectPath)];

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

  console.log('Chat started. Type "exit" to quit.\n');

  while (true) {
    const input = (await ask("you: ")).trim();
    if (!input) continue;
    if (input === "exit" || input === "quit") break;

    messages.push({ role: "user", content: input });
    await runTurn(messages, skills, projectPath, provider, verbose);
    console.log();
  }

  rl.close();
}

// --- main ---

const { projectPath, prompt, provider, verbose } = parseArgs();
const model = provider === "ollama" ? process.env.OLLAMA_MODEL : process.env.ANTHROPIC_MODEL;
console.log(`[project]: ${projectPath}`);
console.log(`[provider]: ${provider} ${model}`);
console.log(`[tools]: ${tools.map((t) => t.name).join(", ")}`);

const skills = loadSkills(projectPath);
console.log(`[skills]: ${skills.map((s) => s.name).join(", ") || "none"}`);

const agentMdExists = existsSync(`${projectPath}/AGENT.md`);
console.log(`[AGENT.md]: ${agentMdExists ? "found" : "not found"}`);

if (prompt) {
  await run(prompt, skills, projectPath, provider, verbose);
} else {
  await runInteractive(skills, projectPath, provider, verbose);
}