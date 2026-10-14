import { z } from "zod";
import type { ToolDef } from "./core/tools.js";
import { type OpenAlex, abstractOf, citedBy, getWork, line, related, search } from "./openalex.js";

const limit = z.number().int().min(1).max(25).default(8).describe("How many results to return.");
const ref = z.string().describe("A DOI like 10.1038/nature14539, a doi.org link, or an OpenAlex id like W2741809807.");

export const tools: ToolDef<OpenAlex>[] = [
  {
    name: "search_papers",
    title: "Search papers",
    description: "Search scholarly papers by keywords. Returns title, authors, year, venue, citation count, DOI and a free to read link when one exists.",
    inputSchema: {
      query: z.string().min(2).describe("Keywords, for example: spaced repetition exam performance."),
      from_year: z.number().int().min(1900).max(2100).optional().describe("Only papers published in or after this year."),
      open_access_only: z.boolean().default(false).describe("Only papers with a free to read copy."),
      limit,
    },
    run: async (a, api) => {
      const works = await search(api, a.query, { fromYear: a.from_year, openAccessOnly: a.open_access_only, limit: a.limit });
      if (works.length === 0) return `No papers found for "${a.query}". Try fewer or broader keywords.`;
      return works.map((w, i) => `${i + 1}. ${line(w)}`).join("\n\n");
    },
  },
  {
    name: "get_paper",
    title: "Get a paper",
    description: "Details for one paper, including the abstract and a free to read link when one exists.",
    inputSchema: { paper: ref },
    run: async (a, api) => {
      const w = await getWork(api, a.paper);
      const abs = abstractOf(w.abstract_inverted_index);
      return `${line(w)}\n\n${abs ? `Abstract\n${abs}` : "No abstract is available for this paper."}`;
    },
  },
  {
    name: "related_papers",
    title: "Related papers",
    description: "Papers that OpenAlex lists as related to a given paper.",
    inputSchema: { paper: ref, limit },
    run: async (a, api) => {
      const { base, works } = await related(api, a.paper, a.limit);
      if (works.length === 0) return `OpenAlex lists no related papers for "${base.display_name ?? a.paper}".`;
      return `Related to "${base.display_name}"\n\n` + works.map((w, i) => `${i + 1}. ${line(w)}`).join("\n\n");
    },
  },
  {
    name: "cited_by",
    title: "Cited by",
    description: "Newer papers that cite a given paper, most recent first.",
    inputSchema: { paper: ref, limit },
    run: async (a, api) => {
      const { base, works } = await citedBy(api, a.paper, a.limit);
      if (works.length === 0) return `No papers citing "${base.display_name ?? a.paper}" were found.`;
      return `Papers citing "${base.display_name}" (${base.cited_by_count ?? "?"} in total)\n\n` + works.map((w, i) => `${i + 1}. ${line(w)}`).join("\n\n");
    },
  },
];
