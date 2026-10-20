import { z } from "zod";
import { ToolError, type ToolDef } from "./core/tools.js";
import { type OpenAlex, type Work, abstractOf, authorPapers, citedBy, getWork, line, related, search } from "./openalex.js";

const limit = z.number().int().min(1).max(25).default(8).describe("How many results to return, 1 to 25.");
const fromYear = z.number().int().min(1900).max(2100).optional().describe("Only papers published in or after this year.");
const openAccessOnly = z.boolean().default(false).describe("Only papers with a free to read copy.");
const ref = z.string().min(1).describe("A DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807.");
const doi = z.string().min(2).describe("A DOI like 10.1038/nature14539, or a doi.org link. No OpenAlex ids here.");

function numbered(works: Work[]): string {
  return works.map((w, i) => `${i + 1}. ${line(w)}`).join("\n\n");
}

function noAuthorMatches(author: string, usedYear?: number, usedOa?: boolean): string {
  const fixes = ["Try the name as it appears on the paper, for example John Smith."];
  if (usedOa) fixes.push("Set open_access_only to false.");
  if (usedYear) fixes.push(`Lower from_year, nothing matched from ${usedYear} onwards.`);
  return `No papers found for author "${author}". ${fixes.join(" ")}`;
}

export const tools: ToolDef<OpenAlex>[] = [
  {
    name: "search_papers",
    title: "Search papers",
    description:
      "Search scholarly papers by keywords. Returns title, authors, year, venue, citation count, DOI and a free to read link when one exists. Inputs: query (required keywords), from_year (optional earliest publication year), open_access_only (optional, false by default), limit (optional, 1 to 25, default 8). Example prompt: 'find open access papers on spaced repetition since 2020.'",
    inputSchema: {
      query: z.string().min(2).describe("Keywords, for example: spaced repetition exam performance."),
      from_year: fromYear,
      open_access_only: openAccessOnly,
      limit,
    },
    run: async (a, api) => {
      const works = await search(api, a.query, { fromYear: a.from_year, openAccessOnly: a.open_access_only, limit: a.limit });
      if (works.length === 0) {
        const fixes = ["Try fewer or broader keywords."];
        if (a.open_access_only) fixes.push("Set open_access_only to false, some good papers have no free copy.");
        if (a.from_year) fixes.push(`Lower from_year, nothing matched from ${a.from_year} onwards.`);
        return `No papers found for "${a.query}". ${fixes.join(" ")}`;
      }
      return numbered(works);
    },
  },
  {
    name: "get_paper",
    title: "Get a paper",
    description:
      "Details for one paper, including the abstract and a free to read link when one exists. A wrong or unknown reference returns a not found error that suggests searching by title or checking the DOI format. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807). Example prompt: 'show me the abstract of DOI 10.1038/nature14539.'",
    inputSchema: { paper: ref },
    run: async (a, api) => {
      const w = await getWork(api, a.paper);
      const abs = abstractOf(w.abstract_inverted_index);
      return `${line(w)}\n\n${abs ? `Abstract\n${abs}` : "No abstract is available for this paper."}`;
    },
  },
  {
    name: "get_paper_by_doi",
    title: "Get a paper by DOI",
    description:
      "Details for one paper looked up by DOI only, including the abstract and a free to read link when one exists. An OpenAlex id or a malformed DOI returns an invalid ref error that points at get_paper. Inputs: doi (required, a DOI like 10.1038/nature14539 or a doi.org link). Example prompt: 'get the paper with DOI 10.1038/nature14539.'",
    inputSchema: { doi },
    run: async (a, api) => {
      const bare = a.doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
      if (!/^10\.\d{4,9}\/\S+$/.test(bare))
        throw new ToolError(
          `"${a.doi}" is not a DOI. get_paper_by_doi takes a DOI like 10.1038/nature14539. Use get_paper if you have an OpenAlex id like W2741809807.`,
          "invalid_ref",
        );
      const w = await getWork(api, bare);
      const abs = abstractOf(w.abstract_inverted_index);
      return `${line(w)}\n\n${abs ? `Abstract\n${abs}` : "No abstract is available for this paper."}`;
    },
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
    name: "related_papers",
    title: "Related papers",
    description:
      "Papers that OpenAlex lists as related to a given paper. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), limit (optional, 1 to 25, default 8). Example prompt: 'what papers are related to DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, limit },
    run: async (a, api) => {
      const { base, works } = await related(api, a.paper, a.limit);
      if (works.length === 0) return `OpenAlex lists no related papers for "${base.display_name ?? a.paper}". Try cited_by to find papers that cite it.`;
      return `Related to "${base.display_name}"\n\n` + numbered(works);
    },
  },
  {
    name: "get_related_work",
    title: "Get related work",
    description:
      "Other papers on the same topic as one paper. Returns the same list as related_papers, kept as a verb-first name for clients that prefer it. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), limit (optional, 1 to 25, default 8). Example prompt: 'what related work should I read for DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, limit },
    run: async (a, api) => {
      const { base, works } = await related(api, a.paper, a.limit);
      if (works.length === 0) return `OpenAlex lists no related work for "${base.display_name ?? a.paper}". Try cited_by to find papers that cite it.`;
      return `Related work for "${base.display_name}"\n\n` + numbered(works);
    },
  },
  {
    name: "cited_by",
    title: "Cited by",
    description:
      "Newer papers that cite a given paper, most recent first. Inputs: paper (required, a DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807), limit (optional, 1 to 25, default 8). Example prompt: 'who cited DOI 10.48550/arXiv.1706.03762?'",
    inputSchema: { paper: ref, limit },
    run: async (a, api) => {
      const { base, works } = await citedBy(api, a.paper, a.limit);
      if (works.length === 0)
        return `No papers citing "${base.display_name ?? a.paper}" were found. The paper may be new or rarely cited. Try related_papers for similar work.`;
      return `Papers citing "${base.display_name}" (${base.cited_by_count ?? "?"} in total)\n\n` + numbered(works);
    },
  },
  {
    name: "list_author_papers",
    title: "List papers by an author",
    description:
      "Papers by one author, most cited first. Matches the author name as it is written on the papers, so exact spelling matters. Inputs: author (required, the name as it appears on the paper, for example Jane Doe), from_year (optional earliest publication year), open_access_only (optional, false by default), limit (optional, 1 to 25, default 8). Example prompt: 'list papers by John Dewey on education since 1950.'",
    inputSchema: {
      author: z.string().min(2).describe("The author name as it appears on the paper, for example Jane Doe."),
      from_year: fromYear,
      open_access_only: openAccessOnly,
      limit,
    },
    run: async (a, api) => {
      const works = await authorPapers(api, a.author, { fromYear: a.from_year, openAccessOnly: a.open_access_only, limit: a.limit });
      if (works.length === 0) return noAuthorMatches(a.author, a.from_year, a.open_access_only);
      return `Papers by "${a.author}", most cited first\n\n` + numbered(works);
    },
  },
];
