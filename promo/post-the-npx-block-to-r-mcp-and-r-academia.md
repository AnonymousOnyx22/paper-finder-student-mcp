Post this to r/MCP and r/academia.
I built a free MCP server for finding real academic papers. It queries OpenAlex live, so the papers are catalog records and not guesses. You get title, authors, year, venue, citation count, DOI, a one line abstract and a free to read link when one exists. Sort by citations or date, filter by year range, citation minimum, paper type or title only. Walk citations both directions, look up by DOI, find free PDFs, list an author's papers. No account, no key.

Install:

```bash
npx -y paper-finder-student-mcp
```

Add it to your MCP config. Claude Desktop: claude_desktop_config.json. Cursor: ~/.cursor/mcp.json. VS Code: .vscode/mcp.json. Needs Node 20+. For Claude Code: claude mcp add paper-finder -- npx -y paper-finder-student-mcp

Example prompts:
- "Find the most cited papers on spaced repetition since 2020."
- "Find 5 sources for my essay on spaced repetition."
- "Citations for my literature review."

npm package: paper-finder-student-mcp. Happy to answer questions.
