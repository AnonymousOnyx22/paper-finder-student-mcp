# Posting copy for Paper Finder MCP

Copy and paste text for listing this MCP server in a directory or a weekly list. Nothing here posts anything for you. Open the file, copy the part you need, paste it, change nothing else.

Every claim below comes from the code and the README, so if a tool changes, fix the copy here as well.

## Pitch

Paper Finder MCP is an academic paper search MCP server. It reads OpenAlex, a free open catalog of scholarly works, so the papers it returns are catalog records and not guesses. A search gives you the title, the authors, the year, the venue, the citation count, the DOI, a one line abstract and a link to a free to read copy when one exists. You can order the results by citation count or by date, keep them to one kind of paper, look up one paper by DOI, find the free copy of a paper, walk the citation graph in both directions and list the papers of one author. There is no account and no key, and the server runs with npx.

## Install

```bash
npx -y paper-finder-student-mcp
```

Put it in the MCP config of your client. Claude Desktop reads `claude_desktop_config.json`, Cursor reads `~/.cursor/mcp.json` and VS Code reads `.vscode/mcp.json`. It needs Node 20 or newer.

## How it compares

The row to copy when the listing has room for a small table.

| | Paper Finder MCP | Asking ChatGPT | Semantic Scholar MCP |
| --- | --- | --- | --- |
| Where the answers come from | OpenAlex, queried live each time you ask | Whatever the chat app does on its own, with no fixed catalog behind the answer | The Semantic Scholar catalog, queried live each time you ask |

## Example prompts

- "Find the most cited papers on spaced repetition since 2020."
- "Who cited DOI 10.48550/arXiv.1706.03762?"
- "List papers by John Dewey on education since 1950."
