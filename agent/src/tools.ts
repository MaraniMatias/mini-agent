export async function handleTool(
  tool: { name: string; params: Record<string, string> },
  projectPath: string
): Promise<string> {
  const resolve = (p: string) =>
    p.startsWith("/") ? p : `${projectPath}/${p}`;

  switch (tool.name) {
    case "read_file": {
      const file = Bun.file(resolve(tool.params.path));
      if (!(await file.exists())) return `Error: file not found at ${tool.params.path}`;
      return await file.text();
    }
    case "write_file": {
      await Bun.write(resolve(tool.params.path), tool.params.content ?? "");
      return `File written: ${tool.params.path}`;
    }
    case "list_files": {
      const glob = new Bun.Glob(tool.params.pattern ?? "*");
      const files: string[] = [];
      for await (const f of glob.scan(resolve(tool.params.path ?? "."))) files.push(f);
      return files.join("\n");
    }
    default:
      return `Unknown tool: ${tool.name}`;
  }
}