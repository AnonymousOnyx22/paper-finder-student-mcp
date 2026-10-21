# Paper Finder MCP

[![npm](https://img.shields.io/npm/v/paper-finder-student-mcp.svg)](https://www.npmjs.com/package/paper-finder-student-mcp)
[![downloads](https://img.shields.io/npm/dm/paper-finder-student-mcp.svg)](https://www.npmjs.com/package/paper-finder-student-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Paper Finder MCP is an academic paper search MCP server. Ask your AI to find real scholarly papers for an essay or research project, with authors, year, citation counts, DOIs and a free to read link when one exists. Results come straight from [OpenAlex](https://openalex.org), a free open catalog of more than 250 million works, so the papers are real, not invented. Free forever, no account and no key.

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

- "Find open access papers on spaced repetition and exam performance since 2020."
- "Get the paper with DOI 10.1038/nature14539 and show me the abstract."
- "Find a free PDF of this paper, DOI 10.1038/nature14539."
- "What papers are related to DOI 10.48550/arXiv.1706.03762?"
- "Who cited DOI 10.48550/arXiv.1706.03762?"
- "List papers by John Dewey on education since 1950."

## How it compares

Three ways to get papers for an essay, and what each one actually gives you. This section has a stable anchor at `README.md#how-it-compares` if you want to link someone here.

| | Paper Finder MCP | Asking ChatGPT | Semantic Scholar MCP |
| --- | --- | --- | --- |
| Where the answers come from | OpenAlex, queried live each time you ask | Whatever the chat app does on its own, with no fixed catalog behind the answer | The Semantic Scholar catalog, queried live each time you ask |
| Can you open the source | Yes, every result carries a DOI or OpenAlex id you can open | A paper it names may not exist, and there is often nothing to open | Yes, results carry identifiers you can open |
| Free to read copy | `find_open_access_pdf` returns a link when one exists, or says plainly that none was found | It may offer a link, but nothing checks it against a catalog | Depends on what that server exposes, see its own README |
| Citations and related work | `cited_by`, `related_papers` and `list_author_papers`, all in the same chat | You can ask, but you get one guess at a time, not a list read from an index | It has its own tools, check that project's README for which ones |
| Account, key or plan | None, no account and no key | You need an account with that service to ask | Depends on that project, check its own docs |
| Where it runs | Inside your MCP client, next to your other tools | In a chat window | Inside your MCP client |

Paper Finder MCP is the one where every line has a live catalog record behind it and the follow up questions are tools rather than more guessing. The Semantic Scholar MCP column describes those servers in general, since they are separate projects with their own features and setup. Always open the paper itself before you cite it.

## Tools

| Tool | What it does | Parameters |
| --- | --- | --- |
| `search_papers` | Search scholarly works by keywords, with optional year and open access filters | `query`, `from_year`, `open_access_only`, `limit` |
| `get_paper` | Details for one paper from its DOI, doi.org link or OpenAlex id, including the abstract | `paper`, `doi` |
| `find_open_access_pdf` | The free to read copy of one paper, preferring a PDF link, or a plain note that none exists | `paper` |
| `related_papers` | Papers OpenAlex marks as related to a paper | `paper`, `limit` |
| `cited_by` | Newer papers that cite a paper, most recent first | `paper`, `limit` |
| `list_author_papers` | Papers by one author, most cited first | `author`, `from_year`, `open_access_only`, `limit` |

Every tool description states its inputs and one example prompt, so clients can pick the right tool without reading this page. `paper` accepts a DOI like `10.1038/nature14539`, a doi.org link, or an OpenAlex id like `W2741809807`. `doi` accepts a DOI or doi.org link with no OpenAlex ids, and `get_paper` takes either `paper` or `doi`, so a DOI lookup has one home. `limit` is 1 to 25, default 8. `list_author_papers` matches the author name as it is written on the papers, so exact spelling matters.

`get_paper_by_doi` and `get_related_work` still exist as deprecated aliases so saved prompts keep working. They do the same work as `get_paper` with `doi` and `related_papers`, and new prompts should use those two instead.

## Good to know

- Lookups that miss are flagged as errors with a stable code, not empty results. A wrong or unknown reference returns a not found error that suggests searching by the title or checking the DOI format, and a rate limit returns an error that says to wait about a minute and retry. A missing free copy is not an error, `find_open_access_pdf` just says that none was found.
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
