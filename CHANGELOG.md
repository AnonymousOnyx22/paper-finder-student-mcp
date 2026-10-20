# Changelog

## Unreleased

- Every tool description now states its inputs and one example prompt, so a client can choose the right tool from the description alone.
- Added four verb-first tools: `get_paper_by_doi` (lookup by DOI only), `find_open_access_pdf` (the free copy link, preferring a PDF), `get_related_work` (the same list as `related_papers`) and `list_author_papers` (papers by one author, most cited first). The existing `search_papers`, `get_paper`, `related_papers` and `cited_by` tools and their parameters are unchanged, so saved prompts keep working.
- Misses and rate limits now come back as typed errors with stable codes instead of generic messages or empty results. An unknown DOI or id returns a not found error that suggests a title search or checking the DOI format, HTTP 429 returns a rate limit error that says to wait about a minute and retry, a malformed reference returns an invalid ref error, and empty search results say which filter may be hiding matches.

## 0.1.0

- First release. Paper search, paper details, related papers and cited-by tools backed by OpenAlex, with tests.
