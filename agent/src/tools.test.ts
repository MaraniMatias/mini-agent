import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { rmSync, mkdirSync } from "fs";
import { handleTool } from "./tools";

const tmpDir = `/tmp/tools-test-${Math.random().toString(36).slice(2)}`;

beforeAll(() => mkdirSync(tmpDir, { recursive: true }));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

test("handleTool unknown name returns error", async () => {
  const result = await handleTool({ name: "foo", params: {} }, tmpDir);
  expect(result).toBe("Unknown tool: foo");
});

describe("read_file", () => {
  test("existing file returns contents", async () => {
    await Bun.write(`${tmpDir}/hello.txt`, "hello world");
    const result = await handleTool({ name: "read_file", params: { path: "hello.txt" } }, tmpDir);
    expect(result).toBe("hello world");
  });

  test("missing file returns error", async () => {
    const result = await handleTool({ name: "read_file", params: { path: "missing.txt" } }, tmpDir);
    expect(result).toBe("Error: file not found at missing.txt");
  });
});

test("write_file writes and confirms", async () => {
  const result = await handleTool({ name: "write_file", params: { path: "out.txt", content: "written!" } }, tmpDir);
  expect(result).toBe("File written: out.txt");
  expect(await Bun.file(`${tmpDir}/out.txt`).text()).toBe("written!");
});

test("list_files returns matching filenames", async () => {
  await Bun.write(`${tmpDir}/a.ts`, "");
  await Bun.write(`${tmpDir}/b.ts`, "");
  await Bun.write(`${tmpDir}/c.md`, "");
  const result = await handleTool({ name: "list_files", params: { path: ".", pattern: "*.ts" } }, tmpDir);
  const lines = result.split("\n").filter(Boolean);
  expect(lines.some((l) => l.includes("a.ts"))).toBe(true);
  expect(lines.some((l) => l.includes("b.ts"))).toBe(true);
  expect(lines.every((l) => !l.includes("c.md"))).toBe(true);
});

test("list_files with **/* returns all files including subdirs", async () => {
  await Bun.write(`${tmpDir}/root.txt`, "");
  await Bun.write(`${tmpDir}/sub/deep.ts`, "");
  const result = await handleTool({ name: "list_files", params: { path: ".", pattern: "**/*" } }, tmpDir);
  const lines = result.split("\n").filter(Boolean);
  expect(lines.some((l) => l.includes("root.txt"))).toBe(true);
  expect(lines.some((l) => l.includes("sub/deep.ts"))).toBe(true);
});

test("list_files returns message when no files match", async () => {
  const result = await handleTool({ name: "list_files", params: { path: ".", pattern: "*.nope" } }, tmpDir);
  expect(result).toBe(`No files found matching pattern "*.nope" in "."`);
});

test("list_files row format includes type, date, size, and prefixed name", async () => {
  await Bun.write(`${tmpDir}/fmt.ts`, "hello");
  const result = await handleTool({ name: "list_files", params: { path: ".", pattern: "fmt.ts" } }, tmpDir);
  const line = result.split("\n").find((l) => l.includes("fmt.ts"))!;
  expect(line).toMatch(/^file  /);
  expect(line).toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(line).toMatch(/\d/); // size
  expect(line).toContain("./fmt.ts");
});

test("list_files shows directories with dir type and trailing slash", async () => {
  await Bun.write(`${tmpDir}/subdir/file.ts`, "");
  const result = await handleTool({ name: "list_files", params: { path: ".", pattern: "**/*" } }, tmpDir);
  const dirLine = result.split("\n").find((l) => l.endsWith("subdir/"));
  expect(dirLine).toBeDefined();
  expect(dirLine).toMatch(/^dir   /);
});

test("list_files with non-dot path prefixes filenames correctly", async () => {
  await Bun.write(`${tmpDir}/sub/nested.ts`, "");
  const result = await handleTool({ name: "list_files", params: { path: "sub", pattern: "*.ts" } }, tmpDir);
  const lines = result.split("\n").filter(Boolean);
  expect(lines.some((l) => l.includes("sub/nested.ts"))).toBe(true);
  expect(lines.every((l) => !l.includes("./nested.ts"))).toBe(true);
});

test("run_command returns not implemented", async () => {
  const result = await handleTool({ name: "run_command", params: { command: "echo hi" } }, tmpDir);
  expect(result).toBe("Not implemented yet. Don't use this tool yet.");
});

describe("web_search", () => {
  test("success returns formatted article", async () => {
    const mockFetch = mock(async (url: string) => {
      if (url.includes("list=search")) {
        return new Response(JSON.stringify({ query: { search: [{ title: "Bun (software)" }] } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          title: "Bun (software)",
          extract: "Bun is a fast JavaScript runtime.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Bun_(software)" } },
        }),
        { status: 200 },
      );
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;
    try {
      const result = await handleTool({ name: "web_search", params: { query: "Bun runtime" } }, tmpDir);
      expect(result).toStartWith("# Bun (software)");
      expect(result).toContain("Bun is a fast JavaScript runtime.");
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test("no results returns message", async () => {
    const mockFetch = mock(async (_url: string) => {
      return new Response(JSON.stringify({ query: { search: [] } }), { status: 200 });
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;
    try {
      const result = await handleTool({ name: "web_search", params: { query: "xyzzy123notreal" } }, tmpDir);
      expect(result).toBe("No Wikipedia results for: xyzzy123notreal");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
