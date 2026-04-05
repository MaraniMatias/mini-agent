import { chat } from "./llm.ts";
import { extractTag, extractTool, extractSkillCall, detectMalformedTool } from "./parsers.ts";
import { handleTool, tools } from "./tools.ts";
import { logSkill, logToolCall, logToolResult, label } from "./log.ts";
import { MAX_FAILURES, MAX_SAME_CALLS, MAX_ITERATIONS } from "./constants.ts";
import type { Message, LLMProvider, Skill, ChatResult } from "./types.ts";

type TurnState = {
  allowedTools: string[] | null;
  failures: number;
  lastToolKey: string;
  sameCallCount: number;
};

function checkAllowed(toolName: string, allowedTools: string[] | null): string | null {
  if (allowedTools !== null && !allowedTools.includes(toolName)) {
    return `Tool "${toolName}" is not allowed in this skill context. Allowed: ${allowedTools.join(", ")}`;
  }
  return null;
}

function trackRepeatedCall(callKey: string, state: TurnState): string {
  if (callKey === state.lastToolKey) {
    state.sameCallCount++;
    if (state.sameCallCount >= MAX_SAME_CALLS) {
      return "\n[Note: same tool+params called again — try a different approach]";
    }
  } else {
    state.lastToolKey = callKey;
    state.sameCallCount = 0;
  }
  return "";
}

function trackFailure(toolResult: string, state: TurnState): boolean {
  if (toolResult.startsWith("Error:") || toolResult.startsWith("Unknown tool:")) {
    if (++state.failures >= MAX_FAILURES) return true;
  } else {
    state.failures = 0;
  }
  return false;
}

// Runs one agentic turn starting from the last user message already in `messages`.
// Mutates messages in place (pushes assistant replies, tool results, etc.).
export async function runTurn(
  messages: Message[],
  skills: Skill[],
  projectPath: string,
  provider: LLMProvider,
  verbose: boolean,
): Promise<void> {
  const state: TurnState = {
    allowedTools: null,
    failures: 0,
    lastToolKey: "",
    sameCallCount: 0,
  };
  let iterations = 0;

  while (true) {
    if (++iterations > MAX_ITERATIONS) {
      messages.push({ role: "user", content: `Stopped after ${MAX_ITERATIONS} iterations without completing.` });
      break;
    }
    let result: ChatResult;
    try {
      result = await chat(messages, provider, tools, verbose);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("\n" + label.error(msg));
      break;
    }

    // ── Anthropic native tool use path ──────────────────────────────────────
    if (result.type === "tool_use") {
      const { block } = result;

      // Push assistant message with the tool_use block
      messages.push({ role: "assistant", content: [block] });

      const blocked = checkAllowed(block.name, state.allowedTools);
      if (blocked) {
        console.log(label.blocked(block.name));
        messages.push({ role: "tool", content: [{ type: "tool_result", tool_use_id: block.id, content: blocked }] });
        continue;
      }

      console.log(label.tool(block.name));
      const params = Object.fromEntries(Object.entries(block.input).map(([k, v]) => [k, String(v)]));
      if (verbose) logToolCall(block.name, params);
      let toolResult = await handleTool({ name: block.name, params }, projectPath);
      if (verbose) logToolResult(toolResult);

      const callKey = `${block.name}|${JSON.stringify(params)}`;
      toolResult += trackRepeatedCall(callKey, state);

      messages.push({ role: "tool", content: [{ type: "tool_result", tool_use_id: block.id, content: toolResult }] });

      if (trackFailure(toolResult, state)) {
        messages.push({ role: "user", content: `Stopped after ${MAX_FAILURES} consecutive tool failures.` });
        break;
      }
      continue;
    }

    // ── Text path (both providers) ───────────────────────────────────────────
    const reply = result.text;
    console.log("\n" + label.model(reply));

    // file output
    const codeBlock = extractTag(reply, "code");
    if (codeBlock) {
      const file = JSON.parse(codeBlock) as { filename: string; content: string };
      const dest = `${projectPath}/${file.filename}`;
      await Bun.write(dest, file.content);
      console.log(label.written(dest));
      messages.push({ role: "assistant", content: reply });
      break;
    }

    // skill call
    const skillName = extractSkillCall(reply);
    if (skillName) {
      const skill = skills.find((s) => s.name === skillName);
      if (skill) {
        state.allowedTools = skill.tools ?? null;
        let body = skill.content;
        if (skill.tools) body = `[Available tools: ${skill.tools.join(", ")}]\n${body}`;
        console.log(label.skill(skillName));
        if (verbose) logSkill(skillName, state.allowedTools, body);
        messages.push({ role: "assistant", content: reply });
        messages.push({ role: "user", content: `<skill_result name="${skillName}">\n${body}\n</skill_result>` });
        continue;
      }
      // skill name not found — fall through to tool check
    }

    // tool call (Ollama text-parsed path)
    const tool = extractTool(reply);
    if (tool) {
      const blocked = checkAllowed(tool.name, state.allowedTools);
      if (blocked) {
        console.log(label.blocked(tool.name));
        messages.push({ role: "assistant", content: reply });
        messages.push({ role: "tool", content: `<tool_result>${blocked}</tool_result>` });
        continue;
      }
      console.log(label.tool(tool.name));
      if (verbose) logToolCall(tool.name, tool.params);
      let toolResult = await handleTool(tool, projectPath);
      if (verbose) logToolResult(toolResult);

      const callKey = `${tool.name}|${JSON.stringify(tool.params)}`;
      toolResult += trackRepeatedCall(callKey, state);

      messages.push({ role: "assistant", content: reply });
      messages.push({ role: "tool", content: `<tool_result>${toolResult}</tool_result>` });

      if (trackFailure(toolResult, state)) {
        messages.push({ role: "user", content: `Stopped after ${MAX_FAILURES} consecutive tool failures.` });
        break;
      }
      continue;
    }

    // malformed tool call detection
    const malformed = detectMalformedTool(reply);
    if (malformed) {
      const namePart = malformed.name ? ` ("${malformed.name}")` : "";
      const errorMsg = `Tool call syntax error${namePart}: ${malformed.reason}. Correct format: <tool name="tool_name" param="value"/>`;
      console.log(label.error(`malformed tool call${namePart}`));
      messages.push({ role: "assistant", content: reply });
      messages.push({ role: "tool", content: `<tool_result>${errorMsg}</tool_result>` });
      if (trackFailure("Error: malformed", state)) {
        messages.push({ role: "user", content: `Stopped after ${MAX_FAILURES} consecutive tool failures.` });
        break;
      }
      continue;
    }

    messages.push({ role: "assistant", content: reply });
    break;
  }
}
