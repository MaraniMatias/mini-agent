import { readFileSync } from "fs";

export type Skill = {
  name: string;
  description: string;
  content: string;
};

export function loadSkills(projectPath: string): Skill[] {
  let raw: string;
  try {
    raw = readFileSync(`${projectPath}/SKILL.md`, "utf-8");
  } catch {
    console.warn(`[skills]: SKILL.md not found in ${projectPath}, continuing without skills`);
    return [];
  }

  const blocks = raw.split(/^## /m).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.trim().split("\n");
    const name = lines[0].trim();
    const descMatch = block.match(/description:\s*"?([^"\n]+)"?/);
    const description = descMatch ? descMatch[1].trim() : "No description";
    return { name, description, content: block.trim() };
  });
}