import { parseArgs, run, runInteractive } from "./src/cli.ts";
import { loadSkills } from "./src/skills.ts";
import { tools } from "./src/tools.ts";
import { existsSync } from "fs";

// Usage:
//   bun run agent.ts --project <path> "prompt"                    ← single prompt
//   bun run agent.ts --project <path>                             ← interactive chat
//   bun run agent.ts --project <path> --local [--verbose] [...]   ← ollama

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
