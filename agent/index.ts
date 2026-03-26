import { chat, type Message, type LLMProvider } from "./src/llm.ts";
import { loadSkills, type Skill } from "./src/skills.ts";
import { buildSystem } from "./src/system.ts";
import { extractTag, extractTool, extractSkillCall } from "./src/parsers.ts";
import { handleTool } from "./src/tools.ts";
import { resolve } from "path";

// Usage:
//   bun run agent.ts --project <path> "prompt"          ← anthropic (default)
//   bun run agent.ts --project <path> --local "prompt"  ← ollama

function parseArgs(): { projectPath: string; prompt: string; provider: LLMProvider } {
  const args = process.argv.slice(2);

  const flagIndex = args.indexOf("--project");
  if (flagIndex === -1 || !args[flagIndex + 1]) {
    console.error("Usage: bun run agent.ts --project <path> [--local] \"<prompt>\"");
    process.exit(1);
  }

  const projectPath = resolve(args[flagIndex + 1]);
  const provider: LLMProvider = args.includes("--local") ? "ollama" : "anthropic";

  const prompt = args
    .filter((_, i) => i !== flagIndex && i !== flagIndex + 1)
    .filter((a) => a !== "--local")
    .join(" ");

  if (!prompt) {
    console.error("Error: prompt is required");
    process.exit(1);
  }

  return { projectPath, prompt, provider };
}

async function run(
  userPrompt: string,
  skills: Skill[],
  projectPath: string,
  provider: LLMProvider
): Promise<void> {
  const messages: Message[] = [
    buildSystem(skills, projectPath),
    { role: "user", content: userPrompt },
  ];

  while (true) {
    const reply = await chat(messages, provider);
    console.log("\n[model]:", reply);

    // file output
    const codeBlock = extractTag(reply, "code");
    if (codeBlock) {
      const file = JSON.parse(codeBlock) as { filename: string; content: string };
      const dest = `${projectPath}/${file.filename}`;
      await Bun.write(dest, file.content);
      console.log(`[written]: ${dest}`);
      break;
    }

    // skill call
    const skillName = extractSkillCall(reply);
    if (skillName) {
      const skill = skills.find((s) => s.name === skillName);
      const skillContent = skill
        ? `<[skill_result] name="${skillName}">\n${skill.content}\n</[skill_result]>`
        : `<[skill_result] name="${skillName}">Skill not found.</[skill_result]>`;
      console.log(`[skill]: ${skillName}`);
      messages.push({ role: "assistant", content: reply });
      messages.push({ role: "user", content: skillContent });
      continue;
    }

    // tool call
    const tool = extractTool(reply);
    if (tool) {
      console.log(`[tool]: ${tool.name}`, tool.params);
      const result = await handleTool(tool, projectPath);
      console.log(`[tool result]: ${result}`);
      messages.push({ role: "assistant", content: reply });
      messages.push({ role: "user", content: `<[tool_result]>${result}</[tool_result]>` });
      continue;
    }

    break;
  }
}

// --- main ---

const { projectPath, prompt, provider } = parseArgs();
console.log(`[project]: ${projectPath}`);
console.log(`[provider]: ${provider}`);

const skills = loadSkills(projectPath);
console.log(`[skills loaded]: ${skills.map((s) => s.name).join(", ") || "none"}`);

await run(prompt, skills, projectPath, provider);