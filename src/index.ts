#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, VERSION } from "./server.js";

function usage(): void {
  console.log(`paper-finder-student-mcp ${VERSION}

Academic paper search MCP server. Search scholarly papers and find free copies through OpenAlex.

Add it to your AI app's MCP config with command "npx" and args ["-y", "paper-finder-student-mcp"].

Optional environment
  OPENALEX_MAILTO   Your email, sent to OpenAlex so they can reach you about heavy use
                    (OPENALEX_EMAIL works too)

  --help, --version`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === "--help" || cmd === "-h") return usage();
  if (cmd === "--version" || cmd === "-v") return console.log(VERSION);
  await createServer().connect(new StdioServerTransport());
  console.error(`paper-finder-student-mcp ${VERSION} running`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
