# Paper Finder MCP

[![npm](https://img.shields.io/npm/v/paper-finder-student-mcp.svg)](https://www.npmjs.com/package/paper-finder-student-mcp)
[![downloads](https://img.shields.io/npm/dm/paper-finder-student-mcp.svg)](https://www.npmjs.com/package/paper-finder-student-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Ask your AI to find real scholarly papers for an essay or research project, with authors, year, citation counts, DOIs and a free to read link when one exists. Results come straight from [OpenAlex](https://openalex.org), a free open catalog of more than 250 million works, so the papers are real, not invented. Free forever, no account and no key.

## Install

```bash
npx -y paper-finder-student-mcp
```

Add this to your AI app's MCP config. For Claude Desktop that is `claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "paper-finder": {
      "command": "npx",
      "args": ["-y", "paper-finder-student-mcp"]
    }
  }
}
```

Restart your AI app, then try one of the prompts below. You need Node.js 20 or newer. For Claude Code, run `claude mcp add paper-finder -- npx -y paper-finder-student-mcp`.

## Example prompts

- "Find an open access copy of DOI 10.1038/nature14539."
- "Who cited this Attention paper? DOI 10.48550/arXiv.1706.03762."
- "Find open access papers on spaced repetition and exam performance since 2020."

## Tools

| Tool | What it does | Parameters |
| --- | --- | --- |
| `search_papers` | Search scholarly works by keywords, with optional year and open access filters | `query`, `from_year`, `open_access_only`, `limit` |
| `get_paper` | Details for one paper from its DOI or OpenAlex id, including the abstract | `paper` |
| `related_papers` | Papers OpenAlex marks as related to a paper | `paper`, `limit` |
| `cited_by` | Newer papers that cite a paper, most recent first | `paper`, `limit` |

`paper` accepts a DOI like `10.1038/nature14539`, a doi.org link, or an OpenAlex id like `W2741809807`.

## Good to know

- Citation counts and open access links come from OpenAlex and can be a little behind the publisher.
- If you want faster, more reliable service for heavy use, set `OPENALEX_EMAIL` to your own email. OpenAlex asks for it so they can reach you, and it is sent only to OpenAlex.
- `OPENALEX_BASE_URL` points the server somewhere else, which the tests use.
- Always read the paper yourself before you cite it. A catalog entry is not the paper.


## Development

```bash
npm install
npm run build
npm test
```

Tests run against a fake OpenAlex server, so they need no network.

## More free student MCP servers

All free, open source and read only where they touch your accounts. Browse the full list at [brightspacemcp.com/more-mcps](https://brightspacemcp.com/more-mcps/).

| Server | What it does |
| --- | --- |
| [Brightspace MCP](https://github.com/AnonymousOnyx22/brightspace-d2l-mcp) | D2L Brightspace for AI. Due dates with real submission status, grades, a target grade calculator and course files. |
| [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) | Read-only Canvas LMS for AI. Due dates, missing work, grades and announcements. |
| [Moodle MCP](https://github.com/AnonymousOnyx22/moodle-student-mcp) | Read-only Moodle for AI. Due dates, overdue work, grades and announcements. |
| [Google Classroom MCP](https://github.com/AnonymousOnyx22/google-classroom-student-mcp) | Read-only Google Classroom for AI. To-do, due dates, missing work and grades. |
| [GPA Calculator MCP](https://github.com/AnonymousOnyx22/gpa-calculator-mcp) | GPA, grade conversion and what-do-I-need-on-the-final math for AI. Works offline, no account. |
| [Citations MCP](https://github.com/AnonymousOnyx22/student-citations-mcp) | APA, MLA and Chicago citations from a DOI, an ISBN or typed details. No account. |
| [Study Planner MCP](https://github.com/AnonymousOnyx22/study-planner-mcp) | Exam study schedules, spaced repetition dates, pomodoro plans and assignment milestones. Works offline. |

## License

MIT
