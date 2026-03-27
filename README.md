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
# Single prompt (Anthropic, default)
bun run agent/index.ts --project ./project "Create a README.md for taco"

# Single prompt (Ollama / local)
bun run agent/index.ts --project ./project --local "Create a README.md for taco"

# Interactive chat mode (no prompt → REPL)
bun run agent/index.ts --project ./project
bun run agent/index.ts --project ./project --local

# Verbose output (prints full request/response for each LLM call)
bun run agent/index.ts --project ./project --verbose "Create a README.md for taco"
bun run agent/index.ts --project ./project --verbose   # interactive + verbose
```

`--project` is the working directory the agent reads/writes files in. All paths the agent uses are relative to it.

### Flags

| Flag        | Description                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `--local`   | Use Ollama instead of Anthropic                                                                                     |
| `--verbose` | Print the full request (messages, roles, char counts) and response (token usage + reply preview) for every LLM call |

## Built-in tools

| Name          | Params            | Description                                                         |
| ------------- | ----------------- | ------------------------------------------------------------------- |
| `read_file`   | `path`            | Read the contents of a file                                         |
| `write_file`  | `path`, `content` | Write content to a file                                             |
| `list_files`  | `path`, `pattern` | List files matching a glob pattern under a directory                |
| `run_command` | `command`         | Run a shell command inside the project directory                    |
| `WebSearch`   | `query`           | Search Wikipedia and return the summary of the top matching article |

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

| Field         | Required | Description                                                                            |
| ------------- | -------- | -------------------------------------------------------------------------------------- |
| `name`        | yes      | Identifier the model uses to call the skill                                            |
| `description` | yes      | Shown in the system prompt so the model knows when to use it                           |
| `tools`       | no       | Array of tools available while this skill is active. If omitted, all tools are allowed |
| Body          | yes      | Injected verbatim as context when the skill is invoked                                 |

## Project layout

```
mini-agent/
  agent/
    index.ts          ← thin CLI entry point (banner, dispatch)
    src/
      types.ts        ← all shared types (Message, Skill, ToolDefinition, etc.)
      constants.ts    ← configuration constants (MAX_FAILURES, MAX_ITERATIONS, etc.)
      cli.ts          ← parseArgs, run, runInteractive
      loop.ts         ← runTurn + deduplication helpers
      llm.ts          ← Anthropic + Ollama chat wrappers
      tools.ts        ← ToolDefinition array + handleTool
      skills.ts       ← loadSkills (reads .skills/*/SKILL.md)
      system.ts       ← buildSystem (generates system prompt)
      parsers.ts      ← extractTag / extractTool / extractSkillCall
      log.ts          ← colored labels + verbose logging
  project/            ← example project the agent works on
    .skills/
    AGENTS.md
  .env
```
