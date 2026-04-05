import { describe, expect, test } from "bun:test";
import { logRequest } from "./log.ts";
import type { Message } from "./types.ts";

describe("logRequest with role:tool", () => {
  test("does not throw for string-content tool message", () => {
    const messages: Message[] = [{ role: "tool", content: "<tool_result>ok</tool_result>" }];
    expect(() => logRequest(messages)).not.toThrow();
  });

  test("does not throw for block-content tool message", () => {
    const messages: Message[] = [
      { role: "tool", content: [{ type: "tool_result", tool_use_id: "id1", content: "ok" }] },
    ];
    expect(() => logRequest(messages)).not.toThrow();
  });
});
