import { describe, expect, test } from "bun:test";
import { detectMalformedTool, extractTool } from "./parsers";

describe("extractTool body-content form", () => {
  test("parses multi-line content between opening and closing tags", () => {
    const text = '<[tool] name="write_file" path="README.md">\n# Title\n\nParagraph.\n</[tool]>';
    const result = extractTool(text);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("write_file");
    expect(result?.params.path).toBe("README.md");
    expect(result?.params.content).toBe("# Title\n\nParagraph.\n");
  });

  test("body content overrides any content attribute in the opening tag", () => {
    const text = '<[tool] name="write_file" path="out.txt">\nhello world\n</[tool]>';
    const result = extractTool(text);
    expect(result?.params.content).toBe("hello world\n");
  });

  test("self-closing form still works", () => {
    const result = extractTool('<[tool] name="read_file" path="foo.ts"/>');
    expect(result?.name).toBe("read_file");
    expect(result?.params.path).toBe("foo.ts");
  });
});

describe("detectMalformedTool", () => {
  test("returns null for plain prose with no tag", () => {
    expect(detectMalformedTool("Here is my answer without any tool call.")).toBeNull();
  });

  test("returns null for a valid canonical tool tag", () => {
    expect(detectMalformedTool('<[tool] name="write_file" path="ok.ts"/>')).toBeNull();
  });

  test("detects unescaped quotes inside attribute value", () => {
    const result = detectMalformedTool('<[tool] name="write_file" content="has "quotes" inside"/>');
    expect(result).not.toBeNull();
    expect(result?.name).toBe("write_file");
    expect(result?.reason).toContain("unescaped");
  });

  test("detects missing self-close />", () => {
    const result = detectMalformedTool('<[tool] name="read_file" path="foo.ts"');
    expect(result).not.toBeNull();
    expect(result?.name).toBe("read_file");
    expect(result?.reason).toContain("self-closed");
  });

  test("detects missing bracket syntax <tool instead of <[tool]", () => {
    const result = detectMalformedTool('<tool name="write_file" path="foo.ts"/>');
    expect(result).not.toBeNull();
    expect(result?.reason).toContain("bracket syntax");
  });
});
