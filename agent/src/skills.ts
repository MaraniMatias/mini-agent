import { readFileSync } from "fs";
import type { Skill } from "./types.ts";

export function loadSkills(projectPath: string): Skill[] {
  const skillsDir = `${projectPath}/.skills`;
  const glob = new Bun.Glob("*/SKILL.md");

  const skills: Skill[] = [];

  try {
    for (const rel of glob.scanSync(skillsDir)) {
      const raw = readFileSync(`${skillsDir}/${rel}`, "utf-8");
      const skill = parseSkillFile(raw);
      if (skill) skills.push(skill);
    }
  } catch {
    console.warn(`[skills]: .skills/ not found in ${projectPath}, continuing without skills`);
    return [];
  }

  if (skills.length === 0) {
    console.warn(`[skills]: no skills found in ${skillsDir}`);
  }

  return skills;
}

function parseSkillFile(raw: string): Skill | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const content = match[2].trim();

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*"?([^"\n]+)"?$/m);

  if (!nameMatch) return null;

  return {
    name: nameMatch[1].trim(),
    description: descMatch ? descMatch[1].trim() : "No description",
    content,
    tools: parseYamlArray(frontmatter, "tools"),
  };
}

// Parses a YAML array for a given key. Supports both formats:
//   inline:     tools: [read_file, write_file]
//   multi-line: tools:\n  - read_file\n  - write_file
function parseYamlArray(frontmatter: string, key: string): string[] | undefined {
  const lines = frontmatter.split("\n");
  const keyIndex = lines.findIndex((l) => l.match(new RegExp(`^${key}:\\s*`)));
  if (keyIndex === -1) return undefined;

  const inlineMatch = lines[keyIndex].match(/:\s*\[([^\]]*)\]/);
  if (inlineMatch) {
    return inlineMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const items: string[] = [];
  for (let i = keyIndex + 1; i < lines.length; i++) {
    const itemMatch = lines[i].match(/^\s+-\s+(.+)/);
    if (!itemMatch) break;
    items.push(itemMatch[1].trim());
  }
  return items.length > 0 ? items : undefined;
}
