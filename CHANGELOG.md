# Changelog

## 0.1.8

- Update the table of sibling MCP servers in the README

## 0.1.7

- `find_authors` finds candidate authors matching a name, so you can pick the right one before listing their papers with `list_author_papers`. Each line shows the OpenAlex author id, the name as OpenAlex writes it, and how many works and citations that profile has.

## 0.1.6

- `list_author_papers` takes the optional `to_year` and `min_citations` filters, the same as `search_papers`, so one call can ask for an author's papers since 2015 with at least 50 citations.

## 0.1.5

- When OpenAlex answers with a rate limit, a server error or a dropped connection, the request is tried once more after a short pause, so a brief outage no longer ends the search with an error.

## 0.1.4

- `search_papers` and the list tools now say how many results matched in all and which results are on screen, in a showing line such as "Showing 1 to 8 of 4,312. Pass page 2 for the next page." Every list takes an optional `page` input, so a literature review can keep reading past the first 25 results instead of starting over. For a search, an author list or a citing list, the page goes to OpenAlex as the `page` request parameter and the total comes from its `meta.count` field, so the numbers are the ones OpenAlex reports. The related and reference lists page over the works OpenAlex already lists for the paper. The tools with the new input are `search_papers`, `find_related_papers`, `find_citing_papers`, `paper_references` and `list_author_papers`, and the deprecated aliases answer the same way. The README tool table, llms.txt and glama.json advertise the new input
- The `paper_references` heading still states how many references OpenAlex holds for the paper, so that number keeps its meaning, and the new showing line sits beside it

## 0.1.3

- `search_papers` takes a `title_only` input, so a search can keep only the papers whose title carries the query words. That is the answer to a broad topic where the most cited match is a famous paper that only mentions the topic. The input goes to OpenAlex as a `title.search` filter and the results stay in the OpenAlex relevance order, so the closest match is still first. It is optional and false by default, so saved prompts keep working as they are. A search that finds nothing names it as a filter to relax, and the README tool table, llms.txt and glama.json advertise it
- The DOI lookup moved into `get_paper` as an optional `doi` input and the related work lookup moved into `find_related_papers`, and the two tools whose names read as noun phrases were renamed, so `cited_by` is now `find_citing_papers` and `related_papers` is now `find_related_papers`. The old names `get_paper_by_doi`, `get_related_work`, `cited_by` and `related_papers` stay in the code as deprecated aliases that return the same result, so saved prompts keep working, while the README tool table, llms.txt and glama.json now advertise the current tools
- The deprecated aliases are not in the tool list a client sees any more, so a client gets the current tools only and no second name for the same work. The aliases stay in the code and still answer when a saved prompt calls them, so nothing that depends on them breaks. The README, llms.txt and glama.json say so
- New `paper_references` tool that lists the papers a paper cites, so a literature review can get the bibliography of a paper as well as the papers that cite it. The `find_citing_papers` tool gives the inbound side. The list is read from the OpenAlex reference list of that paper, and a `sort` input puts the most cited references first or the oldest ones first, which reads like a bibliography from the beginning. The new tool is advertised in the README tool table, llms.txt and glama.json next to the other tools
- `search_papers` takes a `sort` input, so a search can ask for the most cited papers on a topic with `cited_by_count:desc`, or the newest papers with `publication_date:desc`. Without it the results stay in the OpenAlex relevance order. The tool also takes a `type` input, `journal_article`, `preprint` or `book_chapter`, to keep the results to one kind of paper. Both inputs are optional, so saved prompts keep working as they are
- `search_papers` takes a `to_year` and a `min_citations` input now, so a search can ask for the papers published in a range of years, such as 2015 to 2020, or for the papers with at least a given number of citations. The end of the year range becomes a `to_publication_date` filter and the citation count becomes a `cited_by_count` filter in the OpenAlex request. Both inputs are optional, so saved prompts keep working as they are. A search whose years run backwards says so instead of running, and a search that finds nothing names the new filters as well
- Search results now carry a one line abstract, cut from the OpenAlex abstract, so a paper can be judged from the search result before it is opened
- The search results now say how they are ordered and which kind of paper they are, and a search that finds nothing names the type filter when that is the likely reason
- The citing, the related and the reference lists now show a one line abstract under every entry, the same one line abstract a search result carries, so a paper can be judged from the list before it is opened. The OpenAlex request for those three lists now asks for the abstract field, and the descriptions of `find_citing_papers`, `find_related_papers` and `paper_references` say so
- `list_author_papers` now looks the author name up in the OpenAlex author records and then takes the papers from that author id, so initials, a different order of the name parts and other spellings of the same person still find the papers, and papers by other people with a similar byline no longer creep in. The tool also accepts an OpenAlex author id such as `A5108843829`, it lists the other profiles that carry the same name, it points out when it had to settle for the closest match, and it still falls back to matching the name as it is written on the papers when OpenAlex has no record for it
- OpenAlex outages now come back as typed errors with the code `upstream_error` instead of a bare message with no code. A server error, a request that runs out of time and a connection that breaks all get that code, and the message says to try again shortly, so a client can tell an outage from a bad request and branch on the code. The other codes are unchanged, so a miss still returns `not_found` and a rate limit still returns `rate_limited`
- A test now keeps the tool count, names, descriptions and parameters the same across the README tool table, llms.txt and glama.json, and checks them against the tools in src/tools.ts, so a directory never lists a tool the server dropped or an old description for one
- The README and llms.txt no longer quote a works count for OpenAlex, since that number goes out of date, and the text that said how many tools there are no longer states a number, so it stays true when a tool is added
- The README first screen now has an install snippet for Claude Desktop, Cursor and VS Code, so each app gets the config file it reads and the key it calls. Cursor reads `mcpServers` in `~/.cursor/mcp.json`, and VS Code reads `servers` in `.vscode/mcp.json` with the `type` set to `stdio`
- The README first screen now shows a real `search_papers` result for "spaced repetition", so people can see the title, authors, year, venue, citation count, DOI, OpenAlex id, free to read link and one line abstract that come back before they install anything
- The opening paragraph of the README is now four short paragraphs instead of one long block
- llms.txt now has a when to use section, so a client can tell when to pick this server and when to leave it alone. It names the student tasks it fits, such as the papers behind an essay, a literature review or a research project, and the tasks it does not fit, such as news or web pages. It points at the tools that cover a topic, an author and the graph around one paper, and it says the server only reads from OpenAlex, with no key and no account
- Add POST.md, the copy for a directory or a weekly list: one paragraph pitch, the `npx -y paper-finder-student-mcp` block, the comparison row and three example prompts. A test keeps the npx block on the package name, the comparison row on the README table and the example prompts on the prompts the tools answer

## 0.1.2

- Rewrite the package.json description and the keywords for npm search
- Add a comparison table to the README

## 0.1.1

- Rewrite metadata for academic paper search mcp
- Audit llms.txt and glama.json so all six tools, the OpenAlex source and the no-key claim appear verbatim
- Rename tools verb-first and rewrite descriptions with parameters and one example prompt each
- Return helpful typed errors for misses and rate limits instead of empty results
- Rebuild the README first screen as an npx install block plus three example prompts and the tool list

## 0.1.0

- First release. Paper search, paper details, related papers and cited-by tools backed by OpenAlex, with tests.
