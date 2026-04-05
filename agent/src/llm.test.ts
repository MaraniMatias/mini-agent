import { describe, expect, test } from "bun:test";
import { contentAsText } from "./llm.ts";

describe("contentAsText", () => {
  test("returns string content as-is", () => {
    expect(contentAsText("hello")).toBe("hello");
  });

  test("extracts text from a text block", () => {
    expect(contentAsText([{ type: "text", text: "hi" }])).toBe("hi");
  });

  test("renders tool_use block as label", () => {
    expect(
      contentAsText([{ type: "tool_use", id: "x", name: "read_file", input: {} }]),
    ).toBe("[tool_use: read_file]");
  });

  test("renders tool_result block as label", () => {
    expect(
      contentAsText([{ type: "tool_result", tool_use_id: "x", content: "data" }]),
    ).toBe("[tool_result: data]");
  });

  test("joins multiple blocks with newlines", () => {
    expect(
      contentAsText([
        { type: "text", text: "a" },
        { type: "text", text: "b" },
      ]),
    ).toBe("a\nb");
  });
});
