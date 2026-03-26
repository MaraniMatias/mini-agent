# mini-agent

A minimal LLM agent that reads and writes files inside a project directory. Supports Anthropic (Claude) and Ollama (local models).

## Setup

```bash
bun install
cd agent && bun install
```

Copy `.env` and fill in your keys:

```bash
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

OLLAMA_MODEL=qwen3.5:9b   # only needed for --local
```

## Usage

```bash
# Anthropic (default)
bun run agent/index.ts --project ./project "Create a README.md for taco"

# Ollama (local)
bun run agent/index.ts --project ./project --local "Create a README.md for taco"
```

`--project` is the working directory the agent reads/writes files in. All paths the agent uses are relative to it.

## How the agent loop works

Each turn the model emits exactly one of:

| Output | What happens |
|---|---|
| `<[tool] name="..." .../>` | Tool executes, result fed back as `<[tool_result]>` |
| `<[skill] name="..."/>` | Skill content injected as `<[skill_result]>` |
| `<[code]>{"filename":..., "content":...}</[code]>` | File written to disk, loop ends |

The loop runs until a `<[code]>` block is produced or the model returns plain text with no recognized tag.

## Built-in tools

| Name | Params | Description |
|---|---|---|
| `read_file` | `path` | Read the contents of a file |
| `write_file` | `path`, `content` | Write content to a file |
| `list_files` | `path`, `pattern` | List files matching a glob pattern under a directory |
| `run_command` | `command` | Run a shell command inside the project directory |

### Adding a tool

Add one object to the `tools` array in `agent/src/tools.ts`. No other files need changing — the system prompt and dispatch update automatically.

```typescript
{
  name: "run_command",
  description: "Run a shell command and return its output",
  params: { command: "shell command" },
  execute: async (params, _projectPath) => {
    const proc = Bun.spawn(["sh", "-c", params.command]);
    return await new Response(proc.stdout).text();
  },
}
```

## Skills

Skills are reusable instruction sets the agent can invoke on demand. They live inside the project's `.skills/` directory — one subdirectory per skill.

```
your-project/
  .skills/
    markdown-template/
      SKILL.md
    js-utils/
      SKILL.md
```

### SKILL.md format

```markdown
---
name: markdown-template
description: "Writes beautiful Markdown docs with proper headings, tables and code blocks"
tools:
  - read_file
  - write_file
---

Always use ATX headings. Tables for comparisons. Fenced code blocks with language hint.
Keep tone technical but approachable. Include a TL;DR at the top.
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | Identifier the model uses to call the skill |
| `description` | yes | Shown in the system prompt so the model knows when to use it |
| `tools` | no | Array of tools available while this skill is active. If omitted, all tools are allowed |
| Body | yes | Injected verbatim as context when the skill is invoked |

**`tools` — restricting tool access per skill**

When `tools` is set, the agent enforces it: any tool call outside the list is blocked and the model receives an error explaining which tools are allowed. The model also sees the allowed list at the top of the `<[skill_result]>` message.

Both YAML array formats are supported:

```yaml
# inline
tools: [read_file, write_file]

# multi-line
tools:
  - read_file
  - write_file
```

Omit `tools` entirely to leave all tools unrestricted.

### How the model uses a skill

The model sees all available skills listed in the system prompt. When it needs one it emits:

```
<[skill] name="markdown-template"/>
```

The agent injects the skill body back:

```
<[skill_result] name="markdown-template">
Always use ATX headings...
</[skill_result]>
```

The model then continues with that context.

## AGENTS.md

Drop an `AGENTS.md` file in the project root to give the agent persistent context about the project (stack, conventions, constraints). The agent doesn't load this automatically yet — it's a convention file for future use or manual inclusion in prompts.

```markdown
- Node.js project, LTS version
- Add JSDoc comments to all functions
- No external dependencies
```

## Project layout

```
mini-agent/
  agent/
    index.ts          ← CLI entry point, agent loop
    src/
      llm.ts          ← Anthropic + Ollama chat wrappers
      tools.ts        ← ToolDefinition array + handleTool
      skills.ts       ← loadSkills (reads .skills/*/SKILL.md)
      system.ts       ← buildSystem (generates system prompt)
      parsers.ts      ← extractTag / extractTool / extractSkillCall
  project/            ← example project the agent works on
    .skills/
    AGENTS.md
  .env
```
