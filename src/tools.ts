import { z } from "zod";
import { ToolError, type ToolDef } from "./core/tools.js";
import {
  type OpenAlex,
  type ResolvedAuthor,
  type Work,
  SEARCH_SORTS,
  WORK_TYPES,
  abstractOf,
  authorIdPapers,
  authorPapers,
  citedBy,
  getWork,
  line,
  references,
  related,
  resolveAuthor,
  search,
} from "./openalex.js";

const limit = z.number().int().min(1).max(25).default(8).describe("How many results to return, 1 to 25.");
const page = z
  .number()
  .int()
  .min(1)
  .max(400)
  .optional()
  .describe("Which page of results to show, 1 to 400, 1 by default. Pass the page the showing line names to read the next page.");
const fromYear = z.number().int().min(1900).max(2100).optional().describe("Only papers published in or after this year.");
const toYear = z.number().int().min(1900).max(2100).optional().describe("Only papers published in or before this year.");
const minCitations = z
  .number()
  .int()
  .min(0)
  .max(1000000)
  .optional()
  .describe("Only papers with at least this many citations.");
const openAccessOnly = z.boolean().default(false).describe("Only papers with a free to read copy.");
const titleOnly = z
  .boolean()
  .default(false)
  .describe("Only papers with the search words in the title, not just somewhere in the paper.");
const ref = z.string().min(1).describe("A DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807.");
const doi = z.string().min(2).describe("A DOI like 10.1038/nature14539, or a doi.org link. No OpenAlex ids here.");

/** The kinds of paper a search can be limited to, and how they read in a sentence. */
const TYPE_LABELS: Record<string, string> = {
  journal_article: "journal articles",
  preprint: "preprints",
  book_chapter: "book chapters",
};

/** The orders a search can ask for, and how they read in a sentence. */
const SORT_LABELS: Record<string, string> = {
  relevance: "in the order OpenAlex ranks them",
  "cited_by_count:desc": "most cited first",
  "publication_date:desc": "newest first",
};

/** The orders a reference list can ask for, and how they read in a sentence. */
const REFERENCE_SORT_LABELS: Record<string, string> = {
  "cited_by_count:desc": "most cited first",
  "publication_year:asc": "oldest first",
};

function numbered(works: Work[]): string {
  return works.map((w, i) => `${i + 1}. ${line(w)}`).join("\n\n");
}

/** The same list, with a one line abstract under each result. */
function numberedWithSnippets(works: Work[]): string {
  return works.map((w, i) => `${i + 1}. ${line(w, { snippet: true })}`).join("\n\n");
}

/** A number with commas, so a long result count stays readable. */
function count(n: number): string {
  return n.toLocaleString("en-US");
}

/** The line that says which results are on this page and which page comes next. */
function pageLine(total: number, page: number, shown: number, limit: number): string {
  const first = (page - 1) * limit + 1;
  const last = first + shown - 1;
  const line = `Showing ${count(first)} to ${count(last)} of ${count(total)}.`;
  if (last >= total) return line;
  return `${line} Pass page ${count(page + 1)} for the next page.`;
}

/** A sentence for a page past the last result, or an empty string when the page is in range. */
function pastEnd(total: number, page: number, limit: number): string {
  if (total === 0 || page <= Math.ceil(total / limit)) return "";
  const lastPage = Math.max(1, Math.ceil(total / limit));
  return `There are ${count(total)} results in all, so page ${count(page)} is past the last page. Use a page from 1 to ${count(lastPage)}.`;
}

function bareDoi(input: string, hint: string): string {
  const bare = input.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  if (!/^10\.\d{4,9}\/\S+$/.test(bare)) throw new ToolError(`"${input}" is not a DOI. ${hint}`, "invalid_ref");
  return bare;
}

async function paperDetails(api: OpenAlex, reference: string): Promise<string> {
  const w = await getWork(api, reference);
  const abs = abstractOf(w.abstract_inverted_index);
  return `${line(w)}\n\n${abs ? `Abstract\n${abs}` : "No abstract is available for this paper."}`;
}

function relatedRun(heading: string) {
  return async (a: { paper: string; limit: number; page?: number }, api: OpenAlex): Promise<string> => {
    const page = a.page ?? 1;
    const { base, works, total } = await related(api, a.paper, a.limit, page);
    if (works.length === 0) {
      const past = pastEnd(total, page, a.limit);
      if (past) return past;
      return `OpenAlex lists no related papers for "${base.display_name ?? a.paper}". Try find_citing_papers to find papers that cite it.`;
    }
    return `${heading} "${base.display_name}"\n${pageLine(total, page, works.length, a.limit)}\n\n` + numberedWithSnippets(works);
  };
}

/** The papers that cite a paper, newest first. */
async function citingPapers(a: { paper: string; limit: number; page?: number }, api: OpenAlex): Promise<string> {
  const page = a.page ?? 1;
  const { base, works, total } = await citedBy(api, a.paper, a.limit, page);
  if (works.length === 0) {
    const past = pastEnd(total, page, a.limit);
    if (past) return past;
    return `No papers citing "${base.display_name ?? a.paper}" were found. The paper may be new or rarely cited. Try find_related_papers for similar work.`;
  }
  return (
    `Papers citing "${base.display_name}" (${base.cited_by_count ?? "?"} in total)\n${pageLine(total, page, works.length, a.limit)}\n\n` +
    numberedWithSnippets(works)
  );
}

function noAuthorMatches(author: string, usedYear?: number, usedOa?: boolean, resolved?: ResolvedAuthor): string {
  const fixes: string[] = [];
  if (resolved) {
    fixes.push(
      `OpenAlex knows that name as "${resolved.profile.display_name ?? author}" (${resolved.profile.id}), but no paper came back for it.`,
    );
  } else {
    fixes.push("OpenAlex has no author record under that name, and no paper carries it either.");
    fixes.push("Try the name as it appears on the paper, for example John Smith.");
  }
  if (usedOa) fixes.push("Set open_access_only to false.");
  if (usedYear) fixes.push(`Lower from_year, nothing matched from ${usedYear} onwards.`);
  const others = resolved ? sameNameNote(resolved) : "";
  return `No papers found for author "${author}". ${fixes.join(" ")}${others ? ` ${others}` : ""}`;
}

/** The other OpenAlex profiles that carry the same name, so the reader can pick another one. */
function sameNameNote(resolved: ResolvedAuthor): string {
  const others = resolved.sameName.slice(0, 4);
  if (others.length === 0) return "";
  const list = others.map((o) => `${o.id} (${o.works_count ?? 0} papers)`).join(", ");
  return `Other OpenAlex profiles with this name: ${list}. Pass one of those ids as author to see that profile.`;
}

export const tools: ToolDef<OpenAlex>[] = [
  {
    name: "search_papers",
    title: "Search papers",
    description:
      "Search scholarly papers by keywords. Returns title, authors, year, venue, citation count, DOI, a one line abstract and a free to read link when one exists. A showing line under the heading says which results are on this page and how many matched in all, with the page to ask for next, so a long list can be read a page at a time. The results can be ordered, so you can get the most cited papers on a topic or the newest ones, and they can be limited to one kind of paper, to a range of years, to a minimum number of citations or to papers whose title carries the search words. Inputs: query (required keywords), from_year (optional earliest publication year), to_year (optional latest publication year), min_citations (optional, keep only the papers with at least this many citations), open_access_only (optional, false by default), title_only (optional, false by default, keep only the papers whose title carries the search words), type (optional, journal_article, preprint or book_chapter), sort (optional, relevance for the OpenAlex order, cited_by_count:desc for the most cited papers first, or publication_date:desc for the newest papers first), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'find the most cited papers on spaced repetition since 2020.'",
    inputSchema: {
      query: z.string().min(2).describe("Keywords, for example: spaced repetition exam performance."),
      from_year: fromYear,
      to_year: toYear,
      min_citations: minCitations,
      open_access_only: openAccessOnly,
      title_only: titleOnly,
      type: z
        .enum(["journal_article", "preprint", "book_chapter"])
        .optional()
        .describe("Keep only one kind of paper: journal_article, preprint or book_chapter."),
      sort: z
        .enum(["relevance", "cited_by_count:desc", "publication_date:desc"])
        .optional()
        .describe("How to order the results. relevance is the OpenAlex order, cited_by_count:desc puts the most cited papers first, publication_date:desc puts the newest papers first."),
      page,
      limit,
    },
    run: async (a, api) => {
      if (a.from_year !== undefined && a.to_year !== undefined && a.from_year > a.to_year)
        throw new ToolError(
          `from_year ${a.from_year} is after to_year ${a.to_year}. Give a to_year that is the same year as from_year or later.`,
          "invalid_range",
        );
      const page = a.page ?? 1;
      const { works, total } = await search(api, a.query, {
        fromYear: a.from_year,
        toYear: a.to_year,
        minCitations: a.min_citations,
        openAccessOnly: a.open_access_only,
        sort: SEARCH_SORTS[a.sort ?? "relevance"],
        type: WORK_TYPES[a.type ?? ""],
        titleOnly: a.title_only,
        limit: a.limit,
        page,
      });
      if (works.length === 0) {
        const past = pastEnd(total, page, a.limit);
        if (past) return past;
        const fixes = ["Try fewer or broader keywords."];
        if (a.open_access_only) fixes.push("Set open_access_only to false, some good papers have no free copy.");
        if (a.from_year) fixes.push(`Lower from_year, nothing matched from ${a.from_year} onwards.`);
        if (a.to_year) fixes.push(`Raise to_year, nothing matched up to ${a.to_year}.`);
        if (a.min_citations !== undefined)
          fixes.push(`Lower min_citations, nothing matched with ${a.min_citations} citations or more.`);
        if (a.type) fixes.push(`Drop the type filter, no ${TYPE_LABELS[a.type]} matched.`);
        if (a.title_only) fixes.push("Set title_only to false, some papers mention the topic in the abstract rather than the title.");
        return `No papers found for "${a.query}". ${fixes.join(" ")}`;
      }
      const head = [`Papers about "${a.query}"`];
      if (a.type) head.push(`${TYPE_LABELS[a.type]} only`);
      if (a.title_only) head.push("title matches only");
      if (a.to_year !== undefined)
        head.push(a.from_year !== undefined ? `published ${a.from_year} to ${a.to_year}` : `published up to ${a.to_year}`);
      if (a.min_citations !== undefined) head.push(`at least ${a.min_citations} citations`);
      head.push(SORT_LABELS[a.sort ?? "relevance"]);
      return `${head.join(", ")}\n${pageLine(total, page, works.length, a.limit)}\n\n${numberedWithSnippets(works)}`;
    },
  },
  {
    name: "get_paper",
    title: "Get a paper",
    description:
      "Details for one paper, including the abstract and a free to read link when one exists. A wrong or unknown reference returns a not found error that suggests searching by title or checking the DOI format. Inputs: paper (optional, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), doi (optional, a DOI like 10.1038/nature14539 or a doi.org link, no OpenAlex ids). Give paper or doi, and paper wins if you give both. Example prompt: 'show me the abstract of DOI 10.1038/nature14539.'",
    inputSchema: {
      paper: ref.optional().describe("A DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807. Give this or doi."),
      doi: doi.optional().describe("A DOI like 10.1038/nature14539, or a doi.org link. No OpenAlex ids here. Give this or paper."),
    },
    run: async (a, api) => {
      if (a.paper) return paperDetails(api, a.paper);
      if (a.doi) return paperDetails(api, bareDoi(a.doi, "Use a DOI like 10.1038/nature14539, or pass an OpenAlex id like W2741809807 in paper."));
      throw new ToolError("get_paper needs a paper or a doi. Use a DOI like 10.1038/nature14539 or an OpenAlex id like W2741809807.", "invalid_ref");
    },
  },
  {
    name: "get_paper_by_doi",
    title: "Get a paper by DOI",
    description:
      "Deprecated, use get_paper with the doi input instead. Kept so saved prompts keep working, and it still answers when a prompt calls it by name. Details for one paper looked up by DOI only, including the abstract and a free to read link when one exists. An OpenAlex id or a malformed DOI returns an invalid ref error that points at get_paper. Inputs: doi (required, a DOI like 10.1038/nature14539 or a doi.org link). Example prompt: 'get the paper with DOI 10.1038/nature14539.'",
    inputSchema: { doi },
    deprecated: true,
    run: async (a, api) =>
      paperDetails(api, bareDoi(a.doi, "get_paper_by_doi takes a DOI like 10.1038/nature14539. Use get_paper if you have an OpenAlex id like W2741809807.")),
  },
  {
    name: "find_open_access_pdf",
    title: "Find a free copy",
    description:
      "Finds a free to read copy of one paper and returns the link, preferring a PDF over a landing page. When OpenAlex has no free copy it says so in plain words instead of failing. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807). Example prompt: 'find a free PDF of this paper, DOI 10.1038/nature14539.'",
    inputSchema: { paper: ref },
    run: async (a, api) => {
      const w = await getWork(api, a.paper);
      const title = w.display_name ?? w.title ?? "Untitled";
      const pdf = w.best_oa_location?.pdf_url || undefined;
      const landing = w.open_access?.is_oa ? w.open_access.oa_url || undefined : undefined;
      if (!pdf && !landing)
        return `No free copy of "${title}" was found. Try search_papers with open_access_only set to true to find an open access paper on the same topic.`;
      const links = [pdf ? `  PDF: ${pdf}` : "", landing && landing !== pdf ? `  Free to read page: ${landing}` : ""].filter(Boolean).join("\n");
      return `Free to read copy of "${title}" (${w.publication_year ?? "year unknown"})\n${links}`;
    },
  },
  {
    name: "find_related_papers",
    title: "Find related papers",
    description:
      "Lists the papers that OpenAlex lists as related to a given paper, so you can find more work on the same topic. Every result carries a one line abstract, so you can judge a paper before you open it. A showing line under the heading says which results are on this page and how many related papers there are in all, with the page to ask for next. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'what papers are related to DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, page, limit },
    run: relatedRun("Related to"),
  },
  {
    name: "related_papers",
    title: "Related papers",
    description:
      "Deprecated, use find_related_papers instead, it returns the same list. Kept so saved prompts keep working, and it still answers when a prompt calls it by name. Papers that OpenAlex lists as related to a given paper. A showing line says which results are on this page and how many related papers there are in all. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'what papers are related to DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, page, limit },
    deprecated: true,
    run: relatedRun("Related to"),
  },
  {
    name: "get_related_work",
    title: "Get related work",
    description:
      "Deprecated, use find_related_papers instead, it returns the same list. Kept so saved prompts keep working, and it still answers when a prompt calls it by name. Other papers on the same topic as one paper. A showing line says which results are on this page and how many related papers there are in all. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'what related work should I read for DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, page, limit },
    deprecated: true,
    run: relatedRun("Related work for"),
  },
  {
    name: "find_citing_papers",
    title: "Find citing papers",
    description:
      "Lists the papers that cite a given paper, newest first. Every result carries a one line abstract, so you can judge a paper before you open it. This is the other half of the citation graph that paper_references covers, so a literature review can walk the graph in both directions. A showing line under the heading says which citing papers are on this page and how many there are in all, with the page to ask for next. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'who cited DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, page, limit },
    run: (a, api) => citingPapers(a, api),
  },
  {
    name: "cited_by",
    title: "Cited by",
    description:
      "Deprecated, use find_citing_papers instead, it returns the same list. Kept so saved prompts keep working, and it still answers when a prompt calls it by name. Newer papers that cite a given paper, most recent first. A showing line says which citing papers are on this page and how many there are in all. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'who cited DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, page, limit },
    deprecated: true,
    run: (a, api) => citingPapers(a, api),
  },
  {
    name: "paper_references",
    title: "Paper references",
    description:
      "The papers that one paper cites, which is the other half of the citation graph that find_citing_papers covers. Every result carries a one line abstract, so you can judge a paper before you open it. Use it to read the bibliography of a paper, to find the source a result came from, or to work backwards from a paper to the earlier work it builds on. A showing line says which references are on this page and how many the paper lists in all, with the page to ask for next. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), sort (optional, cited_by_count:desc for the most cited references first, or publication_year:asc for the oldest references first), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'what papers does DOI 10.1038/nature14539 cite?'",
    inputSchema: {
      paper: ref,
      sort: z
        .enum(["cited_by_count:desc", "publication_year:asc"])
        .optional()
        .describe("How to order the references. cited_by_count:desc puts the most cited references first, publication_year:asc puts the oldest references first."),
      page,
      limit,
    },
    run: async (a, api) => {
      const sort = a.sort ?? "cited_by_count:desc";
      const page = a.page ?? 1;
      const { base, works, total } = await references(api, a.paper, a.limit, sort, page);
      if (works.length === 0) {
        const past = pastEnd(total, page, a.limit);
        if (past) return past;
        if (total > 0)
          return `OpenAlex lists ${total} references for "${base.display_name ?? a.paper}", but none of them could be read. Try find_citing_papers to find the papers that cite it.`;
        return `OpenAlex lists no references for "${base.display_name ?? a.paper}". Try find_citing_papers to find the papers that cite it.`;
      }
      const head = [`References of "${base.display_name}" (${total} in OpenAlex)`, REFERENCE_SORT_LABELS[sort]];
      return `${head.join(", ")}\n${pageLine(total, page, works.length, a.limit)}\n\n` + numberedWithSnippets(works);
    },
  },
  {
    name: "list_author_papers",
    title: "List papers by an author",
    description:
      "Papers by one author, most cited first. The name is looked up in the OpenAlex author records first, so initials, a different order of the name parts and other spellings of the same person still find the papers, and the papers are then taken from that author id. When OpenAlex has no record for the name, the papers are matched by the name as it is written on them. A showing line says which papers are on this page and how many matched in all, with the page to ask for next. Inputs: author (required, the author name, for example Jane Doe, or an OpenAlex author id like A5108843829), from_year (optional earliest publication year), open_access_only (optional, false by default), page (optional, which page of results to show, 1 to 400, 1 by default), limit (optional, 1 to 25, default 8). Example prompt: 'list papers by John Dewey on education since 1950.'",
    inputSchema: {
      author: z
        .string()
        .min(2)
        .describe("The author name, for example Jane Doe. Initials and other name forms work. An OpenAlex author id like A5108843829 works too."),
      from_year: fromYear,
      open_access_only: openAccessOnly,
      page,
      limit,
    },
    run: async (a, api) => {
      const page = a.page ?? 1;
      const opts = { fromYear: a.from_year, openAccessOnly: a.open_access_only, limit: a.limit, page };
      const resolved = await resolveAuthor(api, a.author);
      if (resolved) {
        const { works, total } = await authorIdPapers(api, resolved.profile.id, opts);
        const past = pastEnd(total, page, a.limit);
        if (past) return past;
        if (works.length > 0) {
          const name = resolved.profile.display_name ?? a.author;
          const head = [`Papers by "${name}" (OpenAlex author ${resolved.profile.id}), most cited first`];
          if (resolved.approximate)
            head.push(`OpenAlex had no record for "${a.author}" as it was typed, so this is the closest match.`);
          const others = sameNameNote(resolved);
          if (others) head.push(others);
          head.push(pageLine(total, page, works.length, a.limit));
          return `${head.join("\n")}\n\n${numbered(works)}`;
        }
        if (total > 0)
          return `OpenAlex lists ${total} papers for "${resolved.profile.display_name ?? a.author}" (${resolved.profile.id}), but none of them could be read on page ${page}. Try a lower page or a higher limit.`;
      }
      const { works, total } = await authorPapers(api, a.author, opts);
      const past = pastEnd(total, page, a.limit);
      if (past) return past;
      if (works.length > 0) {
        const head = [`Papers matching the name "${a.author}" as it is written on them, most cited first`];
        head.push(
          resolved
            ? `OpenAlex knows that name as "${resolved.profile.display_name ?? a.author}" (${resolved.profile.id}), but no paper came back for it under these filters, so the papers were matched by the name on the paper.`
            : "OpenAlex has no author record for that name, so the papers were matched by the name on the paper.",
        );
        head.push(pageLine(total, page, works.length, a.limit));
        return `${head.join("\n")}\n\n${numbered(works)}`;
      }
      if (total > 0)
        return `OpenAlex lists ${total} papers matching the name "${a.author}", but none of them could be read on page ${page}. Try a lower page or a higher limit.`;
      return noAuthorMatches(a.author, a.from_year, a.open_access_only, resolved ?? undefined);
    },
  },
];
