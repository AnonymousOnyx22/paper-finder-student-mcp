# Paper Finder MCP

[![npm](https://img.shields.io/npm/v/paper-finder-student-mcp.svg)](https://www.npmjs.com/package/paper-finder-student-mcp)
[![downloads](https://img.shields.io/npm/dm/paper-finder-student-mcp.svg)](https://www.npmjs.com/package/paper-finder-student-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Google Scholar for your AI**. [See how it compares](#how-it-compares).

Paper Finder MCP is an academic paper search MCP server. Ask your AI to find real scholarly papers for an essay or research project, with authors, year, citation counts, DOIs, a one line abstract and a free to read link when one exists.

Sort by citation count to get the most cited papers on a topic, or by date to get the newest ones. Ask for the papers a paper cites, or the papers that cite it, when you build a literature review.

A search that matches thousands of papers says how many there are and which results you are reading, so you can keep going with the next page instead of stopping at the first handful. The author, citing, related and reference lists work the same way.

Results come straight from [OpenAlex](https://openalex.org), a free open catalog of scholarly works, so the papers are real, not invented. Free forever, no account and no key.

Students often type things like 'find 5 sources for my essay on spaced repetition' or 'citations for my literature review'. Once you have a paper, ask for an 'APA citation', a 'BibTeX' entry or to 'cite this paper' in MLA, and `format_citation` gives you a reference to paste.

## Install

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=paper-finder&config=eyJ0eXBlIjoic3RkaW8iLCJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsInBhcGVyLWZpbmRlci1zdHVkZW50LW1jcCJdfQ==) [![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Server-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](vscode:mcp/install?%7B%22name%22%3A%22paper-finder%22%2C%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22paper-finder-student-mcp%22%5D%7D)

Click a button to add the server to Cursor or VS Code, or set it up by hand with the config below.

```bash
npx -y paper-finder-student-mcp
```

Add this to your AI app's MCP config. Where the file goes and what the key inside it is called depends on the app.

### Claude Desktop

The file is `claude_desktop_config.json`.

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

### Cursor

The file is `~/.cursor/mcp.json` for every project, or `.cursor/mcp.json` for one project.

```json
{
  "mcpServers": {
    "paper-finder": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "paper-finder-student-mcp"]
    }
  }
}
```

### VS Code

The file is `.vscode/mcp.json` in your workspace. VS Code calls the key `servers` and asks for the `type`.

```json
{
  "servers": {
    "paper-finder": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "paper-finder-student-mcp"]
    }
  }
}
```

To use OpenAlex's faster polite pool, add an `env` block next to `args` with `"OPENALEX_MAILTO": "you@example.com"`, using your own email. It is optional and sent only to OpenAlex.

Restart your AI app, then try one of the prompts below. You need Node.js 20 or newer. For Claude Code, run `claude mcp add paper-finder -- npx -y paper-finder-student-mcp`.

## What it looks like

This is what `search_papers` returns for the query "spaced repetition" when you ask for the most cited papers first.

```text
Papers about "spaced repetition", most cited first
Showing 1 to 3 of 12,408. Pass page 2 for the next page.

1. Spaced Repetition Promotes Efficient and Effective Learning (2016)
  Sean H. K. Kang, Policy Insights from the Behavioral and Brain Sciences
  405 citations. DOI 10.1177/2372732215624708. W2310690298
  No free copy found
  Abstract: Concern that students in the United States are less proficient in mathematics, science, and reading than their peers in other countries has led some to question whether American students spend enough...

2. A Trainable Spaced Repetition Model for Language Learning (2016)
  Burr Settles, Brendan Meeder, Annual Meeting of the Association for Computational Linguistics (ACL)
  217 citations. DOI 10.18653/v1/p16-1174. W2514897959
  Free to read, https://www.aclweb.org/anthology/P16-1174.pdf
  Abstract: We present half-life regression (HLR), a novel model for spaced repetition practice with applications to second language acquisition.HLR combines psycholinguistic theory with modern machine learning...

3. Enhancing human learning via spaced repetition optimization (2019)
  Behzad Tabibian, Utkarsh Upadhyay, Abir De, et al., Proceedings of the National Academy of Sciences
  181 citations. DOI 10.1073/pnas.1815156116. W2914319828
  Free to read, https://doi.org/10.1073/pnas.1815156116
  Abstract: Spaced repetition is a technique for efficient memorization which uses repeated review of content following a schedule determined by a spaced repetition algorithm to improve long-term retention.
```

Each result carries the title, the authors, the year, the venue, the citation count, the DOI, the OpenAlex id, a free to read link when one exists and the first line of the abstract, so you can judge a paper before you open it. The showing line says which results you are reading and how many matched in all, and the page to ask for next. OpenAlex counts change over time, so the totals in this sample will differ when you run it.

## Example prompts

- "Find open access papers on spaced repetition and exam performance since 2020."
- "Find the most cited papers on spaced repetition since 2020."
- "Find papers with spaced repetition in the title."
- "Find papers on spaced repetition published from 2015 to 2020 with at least 50 citations."
- "Show me the newest journal articles about spaced repetition."
- "Find 5 sources for my essay on spaced repetition."
- "Citations for my literature review."
- "Get the paper with DOI 10.1038/nature14539 and show me the abstract."
- "Find a free PDF of this paper, DOI 10.1038/nature14539."
- "What papers are related to DOI 10.48550/arXiv.1706.03762?"
- "Who cited DOI 10.48550/arXiv.1706.03762?"
- "What does DOI 10.1038/nature14539 cite?"
- "Find authors named John Dewey."
- "List papers by John Dewey on education since 1950."
- "List papers by A. Duckworth on grit."

## How it compares

Three ways to get papers for an essay, and what each one actually gives you. This section has a stable anchor at `README.md#how-it-compares` if you want to link someone here.

| | Paper Finder MCP | Asking ChatGPT | Semantic Scholar MCP |
| --- | --- | --- | --- |
| Where the answers come from | OpenAlex, queried live each time you ask | Whatever the chat app does on its own, with no fixed catalog behind the answer | The Semantic Scholar catalog, queried live each time you ask |
| Can you open the source | Yes, every result carries a DOI or OpenAlex id you can open | A paper it names may not exist, and there is often nothing to open | Yes, results carry identifiers you can open |
| Free to read copy | `find_open_access_pdf` returns a link when one exists, or says plainly that none was found | It may offer a link, but nothing checks it against a catalog | Depends on what that server exposes, see its own README |
| Citations and related work | `find_citing_papers`, `paper_references`, `find_related_papers` and `list_author_papers`, all in the same chat | You can ask, but you get one guess at a time, not a list read from an index | It has its own tools, check that project's README for which ones |
| Account, key or plan | None, no account and no key | You need an account with that service to ask | Depends on that project, check its own docs |
| Where it runs | Inside your MCP client, next to your other tools | In a chat window | Inside your MCP client |

Paper Finder MCP is the one where every line has a live catalog record behind it and the follow up questions are tools rather than more guessing. The Semantic Scholar MCP column describes those servers in general, since they are separate projects with their own features and setup. Always open the paper itself before you cite it.

## Tools

| Tool | What it does | Parameters |
| --- | --- | --- |
| `search_papers` | Search scholarly works by keywords, with optional year range, citation count, open access, title matches, type and order settings | `query`, `from_year`, `to_year`, `min_citations`, `open_access_only`, `title_only`, `type`, `sort`, `page`, `limit` |
| `get_paper` | Details for one paper from its DOI, doi.org link or OpenAlex id, including the abstract | `paper`, `doi` |
| `find_open_access_pdf` | The free to read copy of one paper, preferring a PDF link, or a plain note that none exists | `paper` |
| `find_related_papers` | Papers OpenAlex marks as related to a paper | `paper`, `page`, `limit` |
| `find_citing_papers` | Newer papers that cite a paper, most recent first | `paper`, `page`, `limit` |
| `paper_references` | The papers a paper cites, so you can read its bibliography | `paper`, `sort`, `page`, `limit` |
| `format_citation` | A ready to paste APA, MLA or BibTeX reference for one paper, built from its OpenAlex record | `paper`, `style` |
| `find_authors` | Candidate authors matching a name, so you can pick the right one before listing their papers | `name` |
| `list_author_papers` | Papers by one author, most cited first, with the name looked up in the OpenAlex author records, with optional year range and citation count | `author`, `from_year`, `to_year`, `min_citations`, `open_access_only`, `page`, `limit` |

Every tool description states its inputs and one example prompt, so clients can pick the right tool without reading this page. `paper` accepts a DOI like `10.1038/nature14539`, a doi.org link, or an OpenAlex id like `W2741809807`. `doi` accepts a DOI or doi.org link with no OpenAlex ids, and `get_paper` takes either `paper` or `doi`, so a DOI lookup has one home. `limit` is 1 to 25, default 8 and `page` is 1 to 400, default 1. `search_papers` shows the title, authors, year, venue, citations, DOI and a one line abstract for every hit, so you can judge a paper before you open it. `sort` takes `relevance` (the default OpenAlex order), `cited_by_count:desc` for the most cited papers on the topic first, or `publication_date:desc` for the newest papers first. `type` takes `journal_article`, `preprint` or `book_chapter` to keep the results to one kind of paper. `title_only` keeps only the papers whose title carries the search words, which stops a famous paper that only mentions the topic from taking the top spot on a broad search. `from_year` and `to_year` set the two ends of a range of years, so a search can ask for the papers published from 2015 to 2020, and `min_citations` keeps only the papers with at least that many citations, so a search can ask for the well cited papers on a topic. `list_author_papers` looks the name up in the OpenAlex author records first and then takes the papers from that author id, so `J. Smith`, `Smith, John` and `John Smith` all reach the same papers, even when the name on the paper is written differently. When the name cannot be resolved that way, the tool matches the name as it is written on the papers instead. `format_citation` takes a `paper` and a `style` of `apa`, `mla` or `bibtex`. It leaves out any part the record does not have, so check the reference against the paper before you use it. `find_citing_papers` gives the papers that cite a paper, and `paper_references` gives the papers it cites, so a literature review can walk the citation graph in both directions. Those two lists and the related paper list show the same one line abstract under every entry, so a paper can be judged from the list before it is opened. `paper_references` takes its own `sort`, with `cited_by_count:desc` for the most cited references first and `publication_year:asc` for the oldest references first, which reads like a bibliography from the beginning. The heading says how many references OpenAlex holds for the paper, so a list cut short by `limit` is clear. Every search and every one of those lists comes with a showing line that says which results are on this page and how many matched in all, and names the page to ask for next, so a long list can be read a page at a time with `page`.

`cited_by`, `related_papers`, `get_paper_by_doi` and `get_related_work` still exist as deprecated aliases so saved prompts keep working. They do the same work as `find_citing_papers`, `find_related_papers` and `get_paper` with `doi`, and new prompts should use those instead. They are not in the tool list a client sees, so a client gets the tools above and no second name for them. A saved prompt that calls one of the old names still gets an answer.

## Good to know

- Lookups that miss are flagged as errors with a stable code, not empty results. A wrong or unknown reference returns a not found error that suggests searching by the title or checking the DOI format, and a rate limit returns an error that says to wait about a minute and retry. An OpenAlex outage, such as a server error, a request that runs out of time or a connection that breaks, returns an upstream error with the code `upstream_error` and says to try again shortly, so a client can tell an outage from a bad request. A missing free copy is not an error, `find_open_access_pdf` just says that none was found.
- `sort` reorders the papers OpenAlex matched. It does not change which papers match, so on a broad topic the most cited match can be a famous paper that only mentions the topic. Ask for `relevance` when you want the closest match first, or set `title_only` to true so only the papers with the search words in the title come back.
- `from_year`, `to_year` and `min_citations` narrow the results, so a year range that is too narrow or a citation count that is too high can leave you with nothing. When a search finds nothing it says which of those filters to relax.
- Author names go through the OpenAlex author records, so a name that is written in another form on the papers still finds them. OpenAlex sometimes keeps more than one profile for a name. In that case the tool shows the profile whose name matches best and has the most papers, and it lists the others. You can pass one of those ids, such as `A5108843829`, as `author` to see that profile.
- Citation counts and open access links come from OpenAlex and can be a little behind the publisher.
- If you want faster, more reliable service for heavy use, set `OPENALEX_MAILTO` to your own email (`OPENALEX_EMAIL` works too). OpenAlex asks for it so they can reach you, and it is sent only to OpenAlex.
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
| [Canvas MCP](https://github.com/AnonymousOnyx22/canvas-lms-student-mcp) | Canvas LMS for AI, read only. Due dates, missing work, grades and announcements. |
| [Moodle MCP](https://github.com/AnonymousOnyx22/moodle-student-mcp) | Moodle for AI, read only. Due dates, overdue work, grades and announcements. |
| [Google Classroom MCP](https://github.com/AnonymousOnyx22/google-classroom-student-mcp) | Google Classroom for AI, read only. Todos, due dates, missing work and grades. |
| [GPA Calculator MCP](https://github.com/AnonymousOnyx22/gpa-calculator-mcp) | GPA, grade conversion and the grade you need on the final, for AI. Works offline, no account. |
| [Citations MCP](https://github.com/AnonymousOnyx22/student-citations-mcp) | APA, MLA and Chicago citations from a DOI, an ISBN or typed details. No account. |
| [Study Planner MCP](https://github.com/AnonymousOnyx22/study-planner-mcp) | Exam study schedules, spaced repetition dates, pomodoro plans and assignment milestones. Works offline. |
| [BibTeX Reference Manager MCP](https://github.com/AnonymousOnyx22/bibtex-reference-manager-mcp) | Clean, convert, dedupe and lint BibTeX, RIS and CSL JSON reference lists, and make cite keys. Works offline. |
| [Open Textbook Finder MCP](https://github.com/AnonymousOnyx22/open-textbook-finder-mcp) | Find free legal copies of textbooks on OpenStax, DOAB and Open Library, look up editions by ISBN and suggest cheaper older ones. |
| [STEM Calculator MCP](https://github.com/AnonymousOnyx22/stem-calc-student-mcp) | Chemistry and physics homework math: molar mass, balancing equations, grams to moles, unit conversion and significant figures. Works offline. |
| [Essay Stats MCP](https://github.com/AnonymousOnyx22/essay-stats-mcp) | Offline writing metrics for essays. Word and page counts, readability scores, passive voice, repeated openers, filler words, long sentences and word limit checks, so students can check their work against assignment requirements. No account, no network. |
| [Syllabus to Calendar MCP](https://github.com/AnonymousOnyx22/syllabus-calendar-mcp) | Syllabus to calendar MCP server. Extract dates from syllabus text, build an ics calendar, expand recurring classes and merge calendars. Works offline, no account. |
| [Job Application Tracker MCP](https://github.com/AnonymousOnyx22/job-tracker-student-mcp) | Job application tracker MCP server. Track internships, jobs, interviews and deadlines offline, see what is coming up, and export your list as CSV or Markdown. No account and no API keys. |

## License

MIT
