import type { Skill } from "./skills.ts";
import type { Message } from "./llm.ts";
import { tools } from "./tools.ts";

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

  return {
    role: "system",
    content: `You are an experienced developer who writes clean, well-structured files.
You excel at beautiful Markdown documentation and simple, readable JavaScript scripts for Node.js.

Your working directory is: ${projectPath}
All file paths are relative to that directory.

## Tools

${toolsSection}

## Skills

When you need a skill, emit a self-closing skill tag and nothing else:
<[skill] name="<skill-name>"/>

Available skills:
${skillsSection}

## Output format

- Tool call: emit only the tool tag.
- Skill call: emit only the skill tag.
- Final file:
<[code]>
{"filename": "<name>", "content": "<file content>"}
</[code]>

One action per response. No extra text outside the tags.`,
  };
}