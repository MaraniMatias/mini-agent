import type { Skill } from "./skills.ts";
import type { Message, LLMProvider } from "./llm.ts";
import { tools } from "./tools.ts";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const SYSTEM_PROMPT_PATH = resolve(import.meta.dirname, "../SYSTEM_PROMPT.md");

export function buildSystem(skills: Skill[], projectPath: string, provider: LLMProvider): Message {
  const toolsSection =
    provider === "anthropic"
      ? ""
      : tools
          .map((t) => {
            const hasContent = "content" in t.params;
            const attrs = Object.entries(t.params)
              .filter(([key]) => key !== "content")
              .map(([key]) => `${key}="<${key}>"`)
              .join(" ");
            const paramLines = Object.entries(t.params)
              .map(([key, desc]) => `  - \`${key}\`: ${desc}`)
              .join("\n");
            const example = hasContent
              ? `\`\`\`\n<tool name="${t.name}" ${attrs}>\n<content>\n</tool>\n\`\`\``
              : `\`<tool name="${t.name}" ${attrs}/>\``;
            return `### ${t.name}\n${t.description}\n${paramLines}\nReturns: ${t.returns}\n${example}`;
          })
          .join("\n\n");

  const skillsSection =
    skills.length === 0 ? "No skills available." : skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n");

  const agentMdPath = `${projectPath}/AGENT.md`;
  const agentMd = existsSync(agentMdPath)
    ? `## Project instructions\n\n${readFileSync(agentMdPath, "utf-8").trim()}`
    : "";

  const template = readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  const content = template
    .replace("{{projectPath}}", projectPath)
    .replace("{{agentMd}}", agentMd)
    .replace("{{tools}}", toolsSection)
    .replace("{{skills}}", skillsSection);

  return { role: "system", content };
}
