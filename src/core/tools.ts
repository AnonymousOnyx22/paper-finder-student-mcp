import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListToolsRequestSchema, type Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ApiError } from "./http.js";

export type Shape = Record<string, z.ZodTypeAny>;

export interface ToolDef<Api> {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  run: (args: any, api: Api) => Promise<string>;
  /** An old name kept for saved prompts. It stays callable but is left out of the tool list. */
  deprecated?: boolean;
}

export interface ToolResult {
  [key: string]: unknown;
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** An expected failure with a stable machine readable code, such as "not_found", "rate_limited" or "upstream_error". */
export class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export async function runTool<Api>(tool: ToolDef<Api>, args: unknown, api: Api): Promise<ToolResult> {
  try {
    const text = await tool.run(args, api);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    if (err instanceof ToolError) return { content: [{ type: "text", text: err.message }], isError: true, code: err.code };
    const msg = err instanceof ApiError ? err.message : `Something went wrong: ${(err as Error).message}`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}

/** The inputs of a tool as JSON Schema, in the shape a client expects. */
function inputSchemaOf(shape: Shape): Tool["inputSchema"] {
  return z.toJSONSchema(z.object(shape), { target: "draft-07", io: "input" }) as Tool["inputSchema"];
}

/** The tools a client gets to see. The deprecated aliases keep working but stay out of this list. */
function listedTools<Api>(tools: ToolDef<Api>[]): Tool[] {
  return tools
    .filter((tool) => !tool.deprecated)
    .map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: inputSchemaOf(tool.inputSchema),
      annotations: { readOnlyHint: true, openWorldHint: true },
      execution: { taskSupport: "forbidden" as const },
    }));
}

export function registerTools<Api>(server: McpServer, tools: ToolDef<Api>[], api: Api): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      async (args: unknown) => runTool(tool, args, api),
    );
  }
  // Every tool stays registered, so a saved prompt that calls an old name still gets an answer.
  // The list a client asks for holds the current tools only.
  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listedTools(tools) }));
}

/** Format an ISO date as a short readable string, or "no due date". */
export function fmtDate(iso?: string | null): string {
  if (!iso) return "no due date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function fmtUnix(seconds?: number | null): string {
  if (!seconds) return "no due date";
  return fmtDate(new Date(seconds * 1000).toISOString());
}

/** Strip HTML tags and collapse whitespace so rich text is readable in a chat. */
export function stripHtml(html?: string | null, max = 4000): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > max ? text.slice(0, max) + "\n[truncated]" : text;
}

export function bullets(lines: string[], empty = "Nothing to show."): string {
  return lines.length ? lines.map((l) => `- ${l}`).join("\n") : empty;
}

export function requireEnv(name: string, hint: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. ${hint}`);
    process.exit(1);
  }
  return v;
}
