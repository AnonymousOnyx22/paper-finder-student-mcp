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

- New `paper_references` tool that lists the papers a paper cites, so a literature review can get the bibliography of a paper as well as the papers that cite it. The `cited_by` tool still gives the inbound side. The list is read from the OpenAlex reference list of that paper, and a `sort` input puts the most cited references first or the oldest ones first, which reads like a bibliography from the beginning. The new tool is advertised in the README tool table, llms.txt and glama.json next to the other tools.
- `search_papers` takes a `sort` input, so a search can ask for the most cited papers on a topic with `cited_by_count:desc`, or the newest papers with `publication_date:desc`. Without it the results stay in the OpenAlex relevance order. The tool also takes a `type` input, `journal_article`, `preprint` or `book_chapter`, to keep the results to one kind of paper. Both inputs are optional, so saved prompts keep working as they are.
- Search results now carry a one line abstract, cut from the OpenAlex abstract, so a paper can be judged from the search result before it is opened.
- The search results now say how they are ordered and which kind of paper they are, and a search that finds nothing names the type filter when that is the likely reason.
- `list_author_papers` now looks the author name up in the OpenAlex author records and then takes the papers from that author id, so initials, a different order of the name parts and other spellings of the same person still find the papers, and papers by other people with a similar byline no longer creep in. The tool also accepts an OpenAlex author id such as `A5108843829`, it lists the other profiles that carry the same name, it points out when it had to settle for the closest match, and it still falls back to matching the name as it is written on the papers when OpenAlex has no record for it.
- A test now keeps the tool count, names, descriptions and parameters the same across the README tool table, llms.txt and glama.json, and checks them against the tools in src/tools.ts, so a directory never lists a tool the server dropped or an old description for one.
- The README and llms.txt no longer quote a works count for OpenAlex, since that number goes out of date, and the text that said how many tools there are no longer states a number, so it stays true when a tool is added.
- Merged the DOI lookup into `get_paper` with an optional `doi` input and the related work lookup into `related_papers`. `get_paper_by_doi` and `get_related_work` remain as deprecated aliases so saved prompts keep working, while the README, llms.txt and glama.json now advertise the six main tools.
- llms.txt and glama.json now enumerate the six main tools with their parameters, name OpenAlex (https://openalex.org) as the data source, and carry the exact phrase no key needed. A test keeps both files in sync with the tools in src/tools.ts.
- Every tool description now states its inputs and one example prompt, so a client can choose the right tool from the description alone.
- Added four verb-first tools: `get_paper_by_doi` (lookup by DOI only), `find_open_access_pdf` (the free copy link, preferring a PDF), `get_related_work` (the same list as `related_papers`) and `list_author_papers` (papers by one author, most cited first). The existing `search_papers`, `get_paper`, `related_papers` and `cited_by` tools and their parameters are unchanged, so saved prompts keep working.
- Misses and rate limits now come back as typed errors with stable codes instead of generic messages or empty results. An unknown DOI or id returns a not found error that suggests a title search or checking the DOI format, HTTP 429 returns a rate limit error that says to wait about a minute and retry, a malformed reference returns an invalid ref error, and empty search results say which filter may be hiding matches.

## 0.1.0

- First release. Paper search, paper details, related papers and cited-by tools backed by OpenAlex, with tests.
