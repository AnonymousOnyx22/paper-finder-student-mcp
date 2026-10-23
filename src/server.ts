import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient } from "./core/http.js";
import { registerTools } from "./core/tools.js";
import type { OpenAlex } from "./openalex.js";
import { tools } from "./tools.js";

export const VERSION = "0.1.3";

export function makeApi(baseUrl = process.env.OPENALEX_BASE_URL || "https://api.openalex.org", email = process.env.OPENALEX_EMAIL || "", fetchImpl?: typeof fetch): OpenAlex {
  return { http: createClient({ baseUrl, headers: { "User-Agent": `paper-finder-student-mcp/${VERSION}` }, fetchImpl }), email: email || undefined };
}

export function createServer(api: OpenAlex = makeApi()): McpServer {
  const server = new McpServer({ name: "paper-finder-student-mcp", version: VERSION });
  registerTools(server, tools, api);
  return server;
}
