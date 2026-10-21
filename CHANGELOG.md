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

- Merged the DOI lookup into `get_paper` with an optional `doi` input and the related work lookup into `related_papers`. `get_paper_by_doi` and `get_related_work` remain as deprecated aliases so saved prompts keep working, while the README, llms.txt and glama.json now advertise the six main tools.
- llms.txt and glama.json now enumerate the six main tools with their parameters, name OpenAlex (https://openalex.org) as the data source, and carry the exact phrase no key needed. A test keeps both files in sync with the tools in src/tools.ts.
- Every tool description now states its inputs and one example prompt, so a client can choose the right tool from the description alone.
- Added four verb-first tools: `get_paper_by_doi` (lookup by DOI only), `find_open_access_pdf` (the free copy link, preferring a PDF), `get_related_work` (the same list as `related_papers`) and `list_author_papers` (papers by one author, most cited first). The existing `search_papers`, `get_paper`, `related_papers` and `cited_by` tools and their parameters are unchanged, so saved prompts keep working.
- Misses and rate limits now come back as typed errors with stable codes instead of generic messages or empty results. An unknown DOI or id returns a not found error that suggests a title search or checking the DOI format, HTTP 429 returns a rate limit error that says to wait about a minute and retry, a malformed reference returns an invalid ref error, and empty search results say which filter may be hiding matches.

## 0.1.0

- First release. Paper search, paper details, related papers and cited-by tools backed by OpenAlex, with tests.
