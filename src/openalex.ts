import { ApiError, type HttpClient } from "./core/http.js";
import { ToolError } from "./core/tools.js";

export interface Work {
  id: string;
  doi?: string | null;
  display_name?: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  authorships?: { author?: { display_name?: string } }[];
  primary_location?: { source?: { display_name?: string } | null } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null };
  best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  related_works?: string[];
  type?: string;
}

const FIELDS = "id,doi,display_name,publication_year,cited_by_count,authorships,primary_location,open_access,type";
const FULL_FIELDS = FIELDS + ",abstract_inverted_index,related_works,best_oa_location";

export function shortId(id: string): string {
  return id.replace(/^https?:\/\/openalex\.org\//i, "");
}

export function normalizeRef(input: string): string {
  const t = input.trim();
  const doi = t.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  if (/^10\.\d{4,9}\/\S+$/.test(doi)) return `doi:${doi}`;
  const id = shortId(t);
  if (/^W\d+$/i.test(id)) return id.toUpperCase();
  throw new ToolError(
    `"${input}" is not a DOI or an OpenAlex id. Use a DOI like 10.1038/nature14539 or an id like W2741809807.`,
    "invalid_ref",
  );
}

export function abstractOf(index?: Record<string, number[]> | null): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter((w) => w !== undefined).join(" ");
}

export function line(w: Work): string {
  const authors = (w.authorships ?? []).map((a) => a.author?.display_name).filter(Boolean) as string[];
  const who = authors.length > 3 ? `${authors.slice(0, 3).join(", ")}, et al.` : authors.join(", ");
  const venue = w.primary_location?.source?.display_name;
  const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : "";
  const oa = w.open_access?.is_oa && w.open_access.oa_url ? `Free to read, ${w.open_access.oa_url}` : "No free copy found";
  return [
    `${w.display_name ?? w.title ?? "Untitled"} (${w.publication_year ?? "year unknown"})`,
    who ? `  ${who}${venue ? `, ${venue}` : ""}` : venue ? `  ${venue}` : "",
    `  ${w.cited_by_count ?? 0} citations. ${doi ? `DOI ${doi}. ` : ""}${shortId(w.id)}`,
    `  ${oa}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface OpenAlex {
  http: HttpClient;
  email?: string;
}

function params(api: OpenAlex, extra: Record<string, string | number | undefined>) {
  return { ...extra, ...(api.email ? { mailto: api.email } : {}) };
}

/** Fetch one JSON document, turning a 404 for a known ref and a 429 into typed errors. */
async function getJson<T>(api: OpenAlex, path: string, query: Record<string, string | number | undefined>, ref?: string): Promise<T> {
  try {
    return await api.http.get<T>(path, query);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && ref !== undefined)
      throw new ToolError(
        `OpenAlex has no paper for "${ref}". Check the DOI format, it should look like 10.1038/nature14539, or search by the title with search_papers. Do not invent a citation for this reference.`,
        "not_found",
      );
    if (err instanceof ApiError && err.status === 429)
      throw new ToolError(
        `OpenAlex rate limited this request (HTTP 429). Wait about a minute and try again. Making fewer requests at a time also helps.`,
        "rate_limited",
      );
    throw err;
  }
}

export async function search(api: OpenAlex, query: string, opts: { fromYear?: number; openAccessOnly?: boolean; limit: number }): Promise<Work[]> {
  const filters: string[] = [];
  if (opts.fromYear) filters.push(`from_publication_date:${opts.fromYear}-01-01`);
  if (opts.openAccessOnly) filters.push("is_oa:true");
  const res: any = await getJson<any>(api, "/works", params(api, { search: query, filter: filters.join(",") || undefined, per_page: opts.limit, select: FIELDS }));
  return res.results ?? [];
}

export async function getWork(api: OpenAlex, ref: string): Promise<Work> {
  return getJson<Work>(api, `/works/${normalizeRef(ref)}`, params(api, { select: FULL_FIELDS }), ref);
}

export async function authorPapers(
  api: OpenAlex,
  author: string,
  opts: { fromYear?: number; openAccessOnly?: boolean; limit: number },
): Promise<Work[]> {
  const filters = [`raw_author_name.search:${author}`];
  if (opts.fromYear) filters.push(`from_publication_date:${opts.fromYear}-01-01`);
  if (opts.openAccessOnly) filters.push("is_oa:true");
  const res: any = await getJson<any>(api, "/works", params(api, { filter: filters.join(","), sort: "cited_by_count:desc", per_page: opts.limit, select: FIELDS }));
  return res.results ?? [];
}

export async function related(api: OpenAlex, ref: string, limit: number): Promise<{ base: Work; works: Work[] }> {
  const base = await getWork(api, ref);
  const ids = (base.related_works ?? []).slice(0, limit).map(shortId);
  if (ids.length === 0) return { base, works: [] };
  const res: any = await getJson<any>(api, "/works", params(api, { filter: `openalex:${ids.join("|")}`, per_page: limit, select: FIELDS }));
  return { base, works: res.results ?? [] };
}

export async function citedBy(api: OpenAlex, ref: string, limit: number): Promise<{ base: Work; works: Work[] }> {
  const base = await getWork(api, ref);
  const res: any = await getJson<any>(api, "/works", params(api, { filter: `cites:${shortId(base.id)}`, sort: "publication_date:desc", per_page: limit, select: FIELDS }));
  return { base, works: res.results ?? [] };
}
