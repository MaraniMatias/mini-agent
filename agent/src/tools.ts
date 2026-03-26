function resolve(p: string, projectPath: string): string {
  return p.startsWith("/") ? p : `${projectPath}/${p}`;
}

export type ToolDefinition = {
  name: string;
  description: string;
  params: Record<string, string>;
  execute: (params: Record<string, string>, projectPath: string) => Promise<string>;
};

export const tools: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    params: { path: "path" },
    execute: async (params, projectPath) => {
      const file = Bun.file(resolve(params.path, projectPath));
      if (!(await file.exists())) return `Error: file not found at ${params.path}`;
      return await file.text();
    },
  },
  {
    name: "write_file",
    description: "Write content to a file",
    params: { path: "path", content: "content" },
    execute: async (params, projectPath) => {
      await Bun.write(resolve(params.path, projectPath), params.content ?? "");
      return `File written: ${params.path}`;
    },
  },
  {
    name: "list_files",
    description: "List files matching a glob pattern under a directory",
    params: { path: "dir", pattern: "glob" },
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
    params: { command: "shell command" },
    execute: async (_params, _projectPath) => {
      return "Not implemented yet.";
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
