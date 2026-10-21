# Changelog

## 0.1.2

- SUMR: Rewrite package.json description and keywords for npm search
- Add a comparison table to the README

## 0.1.1

- Rewrite metadata for academic paper search mcp
- Audit llms.txt and glama.json so all six tools, the OpenAlex source and the no-key claim appear verbatim
- Rename tools verb-first and rewrite descriptions with parameters and one example prompt each
- Return helpful typed errors for misses and rate limits instead of empty results
- Rebuild the README first screen as an npx install block plus three example prompts and the tool list

## Unreleased

- OpenAlex outages now come back as typed errors with the code `upstream_error` instead of a bare message with no code. A server error, a request that runs out of time and a connection that breaks all get that code, and the message says to try again shortly, so a client can tell an outage from a bad request and branch on the code. The other codes are unchanged, so a miss still returns `not_found` and a rate limit still returns `rate_limited`.
- The deprecated aliases `cited_by`, `related_papers`, `get_paper_by_doi` and `get_related_work` are not in the tool list a client sees any more, so a client gets the current tools only and no second name for the same work. The aliases stay in the code and still answer when a saved prompt calls them, so nothing that depends on them breaks. The README, llms.txt and glama.json say so.
- `search_papers` takes a `to_year` and a `min_citations` input now, so a search can ask for the papers published in a range of years, such as 2015 to 2020, or for the papers with at least a given number of citations. The year range becomes a `to_publication_date` filter and the citation count becomes a `cited_by_count` filter in the OpenAlex request. Both inputs are optional, so saved prompts keep working as they are. A search whose years run backwards says so instead of running, and a search that finds nothing names the new filters as well.
- The citing, the related and the reference lists now show a one line abstract under every entry, the same one line abstract a search result carries, so a paper can be judged from the list before it is opened. The OpenAlex request for those three lists now asks for the abstract field, and the descriptions of `find_citing_papers`, `find_related_papers` and `paper_references` say so.
- Renamed the two tools whose names read as noun phrases, so every tool name now says what it does: `cited_by` is now `find_citing_papers` and `related_papers` is now `find_related_papers`. The old names stay in the code as deprecated aliases that return the same list, so saved prompts keep working. The README tool table, llms.txt and glama.json now advertise the new names.
- Add POST.md, the copy for a directory or a weekly list: one paragraph pitch, the `npx -y paper-finder-student-mcp` block, the comparison row and three example prompts. A test keeps the npx block on the package name, the comparison row on the README table and the example prompts on the prompts the tools answer.
- The README first screen now has an install snippet for Claude Desktop, Cursor and VS Code, so each app gets the config file it reads and the key it calls. Cursor reads `mcpServers` in `~/.cursor/mcp.json`, and VS Code reads `servers` in `.vscode/mcp.json` with the `type` set to `stdio`.
- The README first screen now shows a real `search_papers` result for "spaced repetition", so people can see the title, authors, year, venue, citation count, DOI, OpenAlex id, free to read link and one line abstract that come back before they install anything.
- The opening paragraph of the README is now four short paragraphs instead of one long block.
- New `paper_references` tool that lists the papers a paper cites, so a literature review can get the bibliography of a paper as well as the papers that cite it. The `find_citing_papers` tool gives the inbound side. The list is read from the OpenAlex reference list of that paper, and a `sort` input puts the most cited references first or the oldest ones first, which reads like a bibliography from the beginning. The new tool is advertised in the README tool table, llms.txt and glama.json next to the other tools.
- `search_papers` takes a `sort` input, so a search can ask for the most cited papers on a topic with `cited_by_count:desc`, or the newest papers with `publication_date:desc`. Without it the results stay in the OpenAlex relevance order. The tool also takes a `type` input, `journal_article`, `preprint` or `book_chapter`, to keep the results to one kind of paper. Both inputs are optional, so saved prompts keep working as they are.
- Search results now carry a one line abstract, cut from the OpenAlex abstract, so a paper can be judged from the search result before it is opened.
- The search results now say how they are ordered and which kind of paper they are, and a search that finds nothing names the type filter when that is the likely reason.
- `list_author_papers` now looks the author name up in the OpenAlex author records and then takes the papers from that author id, so initials, a different order of the name parts and other spellings of the same person still find the papers, and papers by other people with a similar byline no longer creep in. The tool also accepts an OpenAlex author id such as `A5108843829`, it lists the other profiles that carry the same name, it points out when it had to settle for the closest match, and it still falls back to matching the name as it is written on the papers when OpenAlex has no record for it.
- A test now keeps the tool count, names, descriptions and parameters the same across the README tool table, llms.txt and glama.json, and checks them against the tools in src/tools.ts, so a directory never lists a tool the server dropped or an old description for one.
- The README and llms.txt no longer quote a works count for OpenAlex, since that number goes out of date, and the text that said how many tools there are no longer states a number, so it stays true when a tool is added.
- Merged the DOI lookup into `get_paper` with an optional `doi` input and the related work lookup into `find_related_papers`. `get_paper_by_doi`, `get_related_work`, `cited_by` and `related_papers` remain as deprecated aliases so saved prompts keep working, while the README, llms.txt and glama.json now advertise the main tools.
- llms.txt and glama.json now enumerate the main tools with their parameters, name OpenAlex (https://openalex.org) as the data source, and carry the exact phrase no key needed. A test keeps both files in sync with the tools in src/tools.ts.
- Every tool description now states its inputs and one example prompt, so a client can choose the right tool from the description alone.
- Added four verb-first tools: `get_paper_by_doi` (lookup by DOI only), `find_open_access_pdf` (the free copy link, preferring a PDF), `get_related_work` (the same list as `find_related_papers`) and `list_author_papers` (papers by one author, most cited first). The existing `search_papers`, `get_paper`, `related_papers` and `cited_by` tools and their parameters are unchanged, so saved prompts keep working.
- Misses and rate limits now come back as typed errors with stable codes instead of generic messages or empty results. An unknown DOI or id returns a not found error that suggests a title search or checking the DOI format, HTTP 429 returns a rate limit error that says to wait about a minute and retry, a malformed reference returns an invalid ref error, and empty search results say which filter may be hiding matches.

## 0.1.0

- First release. Paper search, paper details, related papers and cited-by tools backed by OpenAlex, with tests.
