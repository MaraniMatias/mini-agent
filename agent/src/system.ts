import type { Skill } from "./skills.ts";
import type { Message } from "./llm.ts";
import { tools } from "./tools.ts";
import { readFileSync } from "fs";
import { resolve } from "path";

const SYSTEM_PROMPT_PATH = resolve(import.meta.dirname, "../SYSTEM_PROMPT.md");

export function buildSystem(skills: Skill[], projectPath: string): Message {
  const toolsSection = tools
    .map((t) => {
      const attrs = Object.entries(t.params)
        .map(([key, hint]) => `${key}="<${hint}>"`)
        .join(" ");
      return `<[tool] name="${t.name}" ${attrs}/>`;
    })
    .join("\n");

  const skillsSection =
    skills.length === 0
      ? "No skills available."
      : skills.map((s) => `- **${s.name}**: ${s.description}`).join("\n");

  const template = readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  const content = template
    .replace("{{projectPath}}", projectPath)
    .replace("{{tools}}", toolsSection)
    .replace("{{skills}}", skillsSection);

  return { role: "system", content };
}