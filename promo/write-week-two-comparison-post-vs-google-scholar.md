Where it is meant to go: student forum post (ready to paste)

I built Paper Finder MCP because copying papers from Google Scholar into my AI got old fast.

Google Scholar is great for browsing, but I wanted my AI to actually pull real papers with DOIs, citation counts, and walk the citation graph without me pasting everything by hand.

Paper Finder MCP runs as an MCP server in Claude Desktop, Cursor, or VS Code:

```bash
npx -y paper-finder-student-mcp
```

It pulls straight from OpenAlex, a free open catalog of scholarly works, so every result is a real catalog record. I can ask for the most cited papers on a topic since 2020, find free to read copies when they exist, see who cited a paper, or list what it references. 

Each result shows the title, authors, year, venue, citation count, DOI, a one line abstract, and a free to read link if one exists. No account, no key.

It won't replace Google Scholar for skimming, but for getting a clean list my AI can actually work with, it saves a lot of copy paste. Just always read the paper yourself before you cite it.