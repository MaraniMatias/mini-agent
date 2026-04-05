// Shared types — single source of truth for the project

// LLM message types
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string };
export type TextBlock = { type: "text"; text: string };
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentBlock[];
};

export type LLMProvider = "anthropic" | "ollama";

export type ChatResult = { type: "text"; text: string } | { type: "tool_use"; block: ToolUseBlock };

// Tool types
export type ToolDefinition = {
  name: string;
  description: string;
  params: Record<string, string>; // key -> description
  returns: string;
  execute: (params: Record<string, string>, projectPath: string) => Promise<string>;
};

// Skill types
export type Skill = {
  name: string;
  description: string;
  content: string;
  tools?: string[]; // if set, only these tools are available when the skill is active
};

// Parser types
export type MalformedToolResult = {
  name: string | null; // tool name if extractable, null otherwise
  reason: string; // what went wrong
};
