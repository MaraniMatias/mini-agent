function resolve(p: string, projectPath: string): string {
  return p.startsWith("/") ? p : `${projectPath}/${p}`;
}

export type ToolDefinition = {
  name: string;
  description: string;
  params: Record<string, string>; // key -> description
  returns: string;
  execute: (params: Record<string, string>, projectPath: string) => Promise<string>;
};

export const tools: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    params: { path: "relative or absolute file path" },
    returns: "full file contents as plain text, or an error message if not found",
    execute: async (params, projectPath) => {
      const file = Bun.file(resolve(params.path, projectPath));
      if (!(await file.exists())) return `Error: file not found at ${params.path}`;
      return await file.text();
    },
  },
  {
    name: "write_file",
    description: "Write content to a file, creating it if it does not exist",
    params: { path: "relative or absolute file path", content: "full file content to write" },
    returns: "confirmation message with the path written",
    execute: async (params, projectPath) => {
      await Bun.write(resolve(params.path, projectPath), params.content ?? "");
      return `File written: ${params.path}`;
    },
  },
  {
    name: "list_files",
    description: "List files matching a glob pattern under a directory",
    params: { path: "directory to search in (default: .)", pattern: "glob pattern (e.g. *.ts, **/*.md)" },
    returns: "newline-separated list of matching file paths",
    execute: async (params, projectPath) => {
      const glob = new Bun.Glob(params.pattern ?? "*");
      const files: string[] = [];
      for await (const f of glob.scan(resolve(params.path ?? ".", projectPath))) files.push(f);
      return files.join("\n");
    },
  },
  {
    name: "run_command",
    description: "Run a shell command inside the project directory",
    params: { command: "shell command to execute" },
    returns: "stdout output of the command",
    execute: async (_params, _projectPath) => {
      return "Not implemented yet.";
    },
  },
  {
    name: "WebSearch",
    description: "Search Wikipedia and return the summary of the top matching article",
    params: { query: "search query string" },
    returns: "article title, plain-text summary, and source URL",
    execute: async (params) => {
      const query = encodeURIComponent(params.query ?? "");

      // 1. Find the best matching article title
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&format=json&utf8=1&srlimit=1`
      );
      if (!searchRes.ok) return `Wikipedia search failed: ${searchRes.status}`;
      const searchData = await searchRes.json() as { query: { search: { title: string }[] } };
      const hit = searchData.query?.search?.[0];
      if (!hit) return `No Wikipedia results for: ${params.query}`;

      // 2. Fetch the article summary
      const title = encodeURIComponent(hit.title.replace(/ /g, "_"));
      const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
      if (!summaryRes.ok) return `Wikipedia summary fetch failed: ${summaryRes.status}`;
      const summary = await summaryRes.json() as { title: string; extract: string; content_urls: { desktop: { page: string } } };

      return `# ${summary.title}\n\n${summary.extract}\n\nSource: ${summary.content_urls?.desktop?.page ?? ""}`;
    },
  },
];

export async function handleTool(
  tool: { name: string; params: Record<string, string> },
  projectPath: string
): Promise<string> {
  const def = tools.find((t) => t.name === tool.name);
  if (!def) return `Unknown tool: ${tool.name}`;
  return def.execute(tool.params, projectPath);
}
