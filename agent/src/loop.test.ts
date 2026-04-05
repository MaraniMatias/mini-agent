import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import type { ChatResult, Message } from "./types.ts";

// ── Mock only ./llm.ts so that ./tools.ts is untouched ───────────────────────
// Mutable queue for per-test chat responses
let chatResults: ChatResult[] = [];
let chatCallIndex = 0;

mock.module("./llm.ts", () => ({
  chat: async (): Promise<ChatResult> => {
    const result = chatResults[chatCallIndex] ?? { type: "text", text: "done" };
    chatCallIndex++;
    return result;
  },
  // Mirror the real implementation so llm.test.ts passes if this mock leaks
  contentAsText: (content: any) => {
    if (typeof content === "string") return content;
    return (content as any[])
      .map((b: any) =>
        b.type === "text"
          ? b.text
          : b.type === "tool_use"
            ? `[tool_use: ${b.name}]`
            : `[tool_result: ${b.content}]`,
      )
      .join("\n");
  },
}));

// Import loop.ts AFTER mock.module so it picks up the mocked ./llm.ts
const { runTurn } = await import("./loop.ts");

// ── Temp directory with a real test file for handleTool ───────────────────────
const tmpDir = `/tmp/loop-test-${Math.random().toString(36).slice(2)}`;

beforeAll(async () => {
  mkdirSync(tmpDir, { recursive: true });
  await Bun.write(`${tmpDir}/foo.ts`, "file contents here");
});

afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMessages(): Message[] {
  return [{ role: "user", content: "do something" }];
}

function resetChat(...results: ChatResult[]) {
  chatResults = results;
  chatCallIndex = 0;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runTurn — role:tool placement", () => {
  test("tool_use (Anthropic) path: pushes message with role:tool", async () => {
    resetChat(
      { type: "tool_use", block: { type: "tool_use", id: "toolu_01", name: "read_file", input: { path: "foo.ts" } } },
      { type: "text", text: "done" },
    );
    const messages = makeMessages();
    await runTurn(messages, [], tmpDir, "anthropic", false);

    const toolMsg = messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(Array.isArray(toolMsg!.content)).toBe(true);
    const block = (toolMsg!.content as any[])[0];
    expect(block.type).toBe("tool_result");
    expect(block.tool_use_id).toBe("toolu_01");
    expect(block.content).toBe("file contents here");
  });

  test("text-parsed (Ollama) path: pushes message with role:tool", async () => {
    resetChat(
      { type: "text", text: '<tool name="read_file" path="foo.ts"/>' },
      { type: "text", text: "done" },
    );
    const messages = makeMessages();
    await runTurn(messages, [], tmpDir, "ollama", false);

    const toolMsg = messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(typeof toolMsg!.content).toBe("string");
    expect(toolMsg!.content as string).toContain("file contents here");
  });

  test("malformed tool path: pushes message with role:tool containing syntax error", async () => {
    resetChat(
      { type: "text", text: '<tool name="read_file" path="foo.ts"' }, // missing />
      { type: "text", text: "done" },
    );
    const messages = makeMessages();
    await runTurn(messages, [], tmpDir, "anthropic", false);

    const toolMsg = messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(typeof toolMsg!.content).toBe("string");
    expect(toolMsg!.content as string).toContain("Tool call syntax error");
  });

  test("regression: no tool_result block is pushed with role:user", async () => {
    resetChat(
      { type: "tool_use", block: { type: "tool_use", id: "toolu_02", name: "read_file", input: { path: "foo.ts" } } },
      { type: "text", text: "done" },
    );
    const messages = makeMessages();
    await runTurn(messages, [], tmpDir, "anthropic", false);

    for (const m of messages.filter((m) => m.role === "user")) {
      if (Array.isArray(m.content)) {
        expect((m.content as any[]).some((b) => b.type === "tool_result")).toBe(false);
      }
    }
  });
});
