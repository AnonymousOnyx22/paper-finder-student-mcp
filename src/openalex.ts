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
  referenced_works?: string[];
  type?: string;
}

/** One page of works, with how many works the query matched in all. */
export interface WorkPage {
  works: Work[];
  total: number;
}

const FIELDS = "id,doi,display_name,publication_year,cited_by_count,authorships,primary_location,open_access,type";
const FULL_FIELDS = FIELDS + ",abstract_inverted_index,related_works,best_oa_location";
/** The fields for a list of papers where every entry shows a one line abstract. */
const LIST_FIELDS = FIELDS + ",abstract_inverted_index";

/** The fields needed to read the reference list of a paper. */
const REFERENCES_FIELDS = "id,display_name,referenced_works";

/** The kinds of paper a search can ask for, mapped to the OpenAlex type filter value. */
export const WORK_TYPES: Record<string, string | undefined> = {
  journal_article: "article",
  preprint: "preprint",
  book_chapter: "book-chapter",
};

/** The order a search can ask for, mapped to the OpenAlex sort value. Relevance is the OpenAlex default. */
export const SEARCH_SORTS: Record<string, string | undefined> = {
  relevance: undefined,
  "cited_by_count:desc": "cited_by_count:desc",
  "publication_date:desc": "publication_date:desc",
};

/** The order a reference list can ask for, mapped to the OpenAlex sort value. */
export const REFERENCE_SORTS: Record<string, string | undefined> = {
  "cited_by_count:desc": "cited_by_count:desc",
  "publication_year:asc": "publication_date:asc",
};

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

/** The first sentence of an abstract, cut to one short line so a result stays readable. */
export function snippetOf(index?: Record<string, number[]> | null, max = 200): string {
  const text = abstractOf(index).trim();
  if (!text) return "";
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const space = cut.lastIndexOf(" ");
  const head = space > 0 ? cut.slice(0, space) : cut;
  return `${head.replace(/[,;:.\s]+$/, "")}...`;
}

export function line(w: Work, opts: { snippet?: boolean } = {}): string {
  const authors = (w.authorships ?? []).map((a) => a.author?.display_name).filter(Boolean) as string[];
  const who = authors.length > 3 ? `${authors.slice(0, 3).join(", ")}, et al.` : authors.join(", ");
  const venue = w.primary_location?.source?.display_name;
  const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : "";
  const oa = w.open_access?.is_oa && w.open_access.oa_url ? `Free to read, ${w.open_access.oa_url}` : "No free copy found";
  const parts = [
    `${w.display_name ?? w.title ?? "Untitled"} (${w.publication_year ?? "year unknown"})`,
    who ? `  ${who}${venue ? `, ${venue}` : ""}` : venue ? `  ${venue}` : "",
    `  ${w.cited_by_count ?? 0} citations. ${doi ? `DOI ${doi}. ` : ""}${shortId(w.id)}`,
    `  ${oa}`,
  ];
  if (opts.snippet) {
    const snippet = snippetOf(w.abstract_inverted_index);
    if (snippet) parts.push(`  Abstract: ${snippet}`);
  }
  return parts.filter(Boolean).join("\n");
}

export const CITATION_STYLES = ["apa", "mla", "bibtex"] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];

/** Splits an OpenAlex display name like "Jane Q. Smith" into given names and a family name. */
function splitName(name: string): { given: string[]; family: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const family = parts.pop() ?? "";
  return { given: parts, family };
}

function initials(given: string[]): string {
  return given
    .map((g) => g.split("-").map((p) => `${p.charAt(0).toUpperCase()}.`).join("-"))
    .join(" ");
}

function plainDoi(doi?: string | null): string {
  return doi ? doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") : "";
}

/** Formats a work as an APA, MLA or BibTeX reference. Missing parts are left out, never invented. */
export function formatCitation(w: Work, style: CitationStyle): string {
  const names = (w.authorships ?? [])
    .map((a) => a.author?.display_name?.trim())
    .filter((n): n is string => !!n)
    .map(splitName);
  const title = (w.display_name ?? w.title ?? "Untitled").trim().replace(/[.\s]+$/, "");
  const venue = w.primary_location?.source?.display_name?.trim();
  const year = w.publication_year;
  const doi = plainDoi(w.doi);
  const url = doi ? `https://doi.org/${doi}` : "";

  if (style === "apa") {
    const list = names.map((n) => (n.given.length ? `${n.family}, ${initials(n.given)}` : n.family));
    let who = "";
    if (list.length === 1) who = list[0]!;
    else if (list.length === 2) who = `${list[0]}, & ${list[1]}`;
    else if (list.length > 2) who = `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
    const head = who ? `${who.replace(/\.$/, "")}. ` : "";
    return `${head}(${year ?? "n.d."}). ${title}.${venue ? ` ${venue}.` : ""}${url ? ` ${url}` : ""}`;
  }

  if (style === "mla") {
    let who = "";
    const first = names[0];
    if (first) {
      const firstText = first.given.length ? `${first.family}, ${first.given.join(" ")}` : first.family;
      if (names.length === 1) who = firstText;
      else if (names.length === 2) who = `${firstText}, and ${names[1]!.given.concat(names[1]!.family).join(" ")}`;
      else who = `${firstText}, et al`;
    }
    const head = who ? `${who.replace(/\.$/, "")}. ` : "";
    const rest = [venue, year ? String(year) : "", url].filter(Boolean).join(", ");
    return `${head}"${title}."${rest ? ` ${rest}.` : ""}`;
  }

  const escape = (s: string) => s.replace(/([&%$#_{}])/g, "\\$1");
  const key = `${(names[0]?.family ?? "unknown").toLowerCase().replace(/[^a-z0-9]/g, "")}${year ?? ""}`;
  const fields = [
    ["title", escape(title)],
    names.length ? ["author", names.map((n) => escape([n.family, n.given.join(" ")].filter(Boolean).join(", "))).join(" and ")] : null,
    venue ? ["journal", escape(venue)] : null,
    year ? ["year", String(year)] : null,
    doi ? ["doi", doi] : null,
  ].filter((f): f is string[] => f !== null);
  return `@article{${key || "unknown"},\n${fields.map(([k, v]) => `  ${k} = {${v}}`).join(",\n")}\n}`;
}

export interface AuthorProfile {
  id: string;
  display_name?: string;
  works_count?: number;
  cited_by_count?: number;
  display_name_alternatives?: string[];
}

export interface ResolvedAuthor {
  profile: AuthorProfile;
  /** How well the profile name matches what was asked for, from 0 to 1. */
  score: number;
  /** True when OpenAlex had no record for the name as typed and this is the closest match. */
  approximate: boolean;
  /** Other profiles that carry the same display name. */
  sameName: AuthorProfile[];
}

export interface OpenAlex {
  http: HttpClient;
  email?: string;
}

function params(api: OpenAlex, extra: Record<string, string | number | undefined>) {
  return { ...extra, ...(api.email ? { mailto: api.email } : {}) };
}

/** The OpenAlex page and per_page for a 1 based page number, so page 1 keeps the current request. */
function pageParams(page: number | undefined, limit: number): { page?: number; per_page: number } {
  return { page: page && page > 1 ? page : undefined, per_page: limit };
}

/** The works on one page of a result, plus the total the API reports. */
function workPage(res: any, limit: number): WorkPage {
  const works: Work[] = res.results ?? [];
  return { works: works.slice(0, limit), total: res.meta?.count ?? works.length };
}

/** The message for an OpenAlex failure that is not the caller's fault. */
function upstreamMessage(err: ApiError): string {
  if (err.kind === "timeout") return `OpenAlex did not answer (${err.message}). Try again shortly.`;
  if (err.kind === "network") return `OpenAlex could not be reached (${err.message}). Try again shortly.`;
  return `OpenAlex had a problem (HTTP ${err.status}). Try again shortly.`;
}

/** True when OpenAlex failed on its own side, so the caller can retry later. */
function isUpstreamFailure(err: ApiError): boolean {
  return err.status >= 500 || err.kind === "timeout" || err.kind === "network";
}

/** Fetch one JSON document, turning a 404 for a known ref, a 429 and an OpenAlex outage into typed errors. */
async function getJson<T>(
  api: OpenAlex,
  path: string,
  query: Record<string, string | number | undefined>,
  ref?: string,
  notFoundMessage?: string,
): Promise<T> {
  try {
    return await api.http.get<T>(path, query);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && ref !== undefined)
      throw new ToolError(
        notFoundMessage ??
          `OpenAlex has no paper for "${ref}". Check the DOI format, it should look like 10.1038/nature14539, or search by the title with search_papers. Do not invent a citation for this reference.`,
        "not_found",
      );
    if (err instanceof ApiError && err.status === 429)
      throw new ToolError(
        `OpenAlex rate limited this request (HTTP 429). Wait about a minute and try again. Making fewer requests at a time also helps.`,
        "rate_limited",
      );
    if (err instanceof ApiError && isUpstreamFailure(err))
      throw new ToolError(upstreamMessage(err), "upstream_error");
    throw err;
  }
}

export async function search(
  api: OpenAlex,
  query: string,
  opts: {
    fromYear?: number;
    toYear?: number;
    minCitations?: number;
    openAccessOnly?: boolean;
    sort?: string;
    type?: string;
    titleOnly?: boolean;
    limit: number;
    page?: number;
  },
): Promise<WorkPage> {
  const filters: string[] = [];
  if (opts.fromYear) filters.push(`from_publication_date:${opts.fromYear}-01-01`);
  if (opts.toYear) filters.push(`to_publication_date:${opts.toYear}-12-31`);
  // OpenAlex reads ">" as more than, so one less than the wanted count gives "at least that many".
  if (opts.minCitations !== undefined) filters.push(`cited_by_count:>${opts.minCitations - 1}`);
  if (opts.openAccessOnly) filters.push("is_oa:true");
  if (opts.type) filters.push(`type:${opts.type}`);
  // A comma or a pipe would break OpenAlex filter syntax, so the title search uses plain words.
  if (opts.titleOnly) filters.push(`title.search:${query.replace(/[,|]+/g, " ").replace(/\s+/g, " ").trim()}`);
  const res: any = await getJson<any>(
    api,
    "/works",
    params(api, {
      search: query,
      filter: filters.join(",") || undefined,
      sort: opts.sort,
      ...pageParams(opts.page, opts.limit),
      select: LIST_FIELDS,
    }),
  );
  return workPage(res, opts.limit);
}

export async function getWork(api: OpenAlex, ref: string, fields: string = FULL_FIELDS): Promise<Work> {
  return getJson<Work>(api, `/works/${normalizeRef(ref)}`, params(api, { select: fields }), ref);
}

type AuthorOpts = { fromYear?: number; toYear?: number; minCitations?: number; openAccessOnly?: boolean; limit: number; page?: number };

/** The year, citation and open access filters that both author lookups share. */
function authorFilters(opts: AuthorOpts): string[] {
  const filters: string[] = [];
  if (opts.fromYear) filters.push(`from_publication_date:${opts.fromYear}-01-01`);
  if (opts.toYear) filters.push(`to_publication_date:${opts.toYear}-12-31`);
  if (opts.minCitations !== undefined) filters.push(`cited_by_count:>${opts.minCitations - 1}`);
  if (opts.openAccessOnly) filters.push("is_oa:true");
  return filters;
}

export async function authorPapers(api: OpenAlex, author: string, opts: AuthorOpts): Promise<WorkPage> {
  const filters = [`raw_author_name.search:${author}`, ...authorFilters(opts)];
  const res: any = await getJson<any>(
    api,
    "/works",
    params(api, { filter: filters.join(","), sort: "cited_by_count:desc", ...pageParams(opts.page, opts.limit), select: FIELDS }),
  );
  return workPage(res, opts.limit);
}

/** Papers that belong to one OpenAlex author id, whatever name is written on the papers. */
export async function authorIdPapers(api: OpenAlex, authorId: string, opts: AuthorOpts): Promise<WorkPage> {
  const filters = [`author.id:${authorId}`, ...authorFilters(opts)];
  const res: any = await getJson<any>(
    api,
    "/works",
    params(api, { filter: filters.join(","), sort: "cited_by_count:desc", ...pageParams(opts.page, opts.limit), select: FIELDS }),
  );
  return workPage(res, opts.limit);
}

const AUTHOR_FIELDS = "id,display_name,works_count,cited_by_count,display_name_alternatives";

/** True when the input looks like an OpenAlex author id, such as A5108843829. */
export function isAuthorId(input: string): boolean {
  return /^A\d+$/i.test(input.trim());
}

/** Lower case name without punctuation or accents, so "Dewey, John" and "john dewey" compare equal. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function editDistance(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}

/**
 * How close two author names are, from 1 for the same name down to 0 for names with nothing in common.
 * Initials and a different order of the name parts still score well.
 */
export function nameMatch(query: string, name: string): number {
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (!q || !n) return 0;
  if (q === n) return 1;
  const qt = q.split(" ");
  const nt = n.split(" ");
  if (qt.length === nt.length) {
    const qi = qt.map((t) => t[0]).sort().join("");
    const ni = nt.map((t) => t[0]).sort().join("");
    if (qi === ni) return 0.9;
  }
  if (qt.every((t) => nt.some((u) => u.startsWith(t) || t.startsWith(u)))) return 0.85;
  return spellingMatch(query, name);
}

/** How close two names are as plain spellings, so a wrong letter shows up as a lower score. */
export function spellingMatch(query: string, name: string): number {
  const q = normalizeName(query);
  const n = normalizeName(name);
  if (!q || !n) return 0;
  if (q === n) return 1;
  const longest = Math.max(q.length, n.length);
  return Math.max(0, 1 - editDistance(q, n) / longest);
}

/** The best score of the query against the profile name and the other names the profile is known by. */
function profileScore(query: string, profile: AuthorProfile, score: (query: string, name: string) => number): number {
  const names = [profile.display_name ?? "", ...(profile.display_name_alternatives ?? [])];
  return names.reduce((best, name) => Math.max(best, score(query, name)), 0);
}

export async function findAuthors(api: OpenAlex, name: string, perPage = 10): Promise<AuthorProfile[]> {
  const res: any = await getJson<any>(api, "/authors", params(api, { search: name, per_page: perPage, select: AUTHOR_FIELDS }));
  return (res.results ?? [])
    .map((a: any) => ({ ...a, id: shortId(String(a.id ?? "")) }) as AuthorProfile)
    .filter((a: AuthorProfile) => a.id.length > 0);
}

export async function getAuthor(api: OpenAlex, id: string): Promise<AuthorProfile> {
  const res = await getJson<AuthorProfile>(
    api,
    `/authors/${id}`,
    params(api, { select: AUTHOR_FIELDS }),
    id,
    `OpenAlex has no author with the id ${id}. Check the id, or give the author name instead.`,
  );
  return { ...res, id: shortId(String(res.id ?? id)) };
}

/** True when the token is a whole name part of the profile name or of one of its other names. */
function hasNameToken(profile: AuthorProfile, token: string): boolean {
  const wanted = normalizeName(token);
  if (!wanted) return false;
  const names = [profile.display_name ?? "", ...(profile.display_name_alternatives ?? [])];
  return names.some((name) => normalizeName(name).split(" ").includes(wanted));
}

/** The closest profile for a name, plus the other profiles that carry the same display name. */
function pickAuthor(
  query: string,
  profiles: AuthorProfile[],
  score: (query: string, name: string) => number = nameMatch,
): ResolvedAuthor | null {
  const scored = profiles
    .map((profile) => ({ profile, score: profileScore(query, profile, score) }))
    .filter((c) => c.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.profile.works_count ?? 0) - (a.profile.works_count ?? 0) ||
        (b.profile.cited_by_count ?? 0) - (a.profile.cited_by_count ?? 0),
    );
  if (scored.length === 0) return null;
  const chosen = scored[0];
  const chosenName = normalizeName(chosen.profile.display_name ?? "");
  const sameName = scored
    .filter((c) => c !== chosen && normalizeName(c.profile.display_name ?? "") === chosenName)
    .map((c) => c.profile);
  return { profile: chosen.profile, score: chosen.score, approximate: false, sameName };
}

/**
 * Turn a name into an OpenAlex author id. The name is looked up in the author records first, so
 * initials, a different order of the name parts and other spellings of the same person still match.
 */
export async function resolveAuthor(api: OpenAlex, name: string): Promise<ResolvedAuthor | null> {
  const typed = name.trim();
  if (!typed) return null;
  if (isAuthorId(typed)) {
    const profile = await getAuthor(api, typed.toUpperCase());
    return { profile, score: 1, approximate: false, sameName: [] };
  }
  const direct = pickAuthor(typed, await findAuthors(api, typed));
  if (direct && direct.score >= 0.6) return direct;
  const parts = typed.split(/\s+/).filter(Boolean);
  const tries = [parts[parts.length - 1], parts[0]].filter(
    (part, i, all) => part && part.length >= 3 && all.indexOf(part) === i,
  );
  for (const part of tries) {
    if (normalizeName(part) === normalizeName(typed)) continue;
    const near = pickAuthor(
      typed,
      (await findAuthors(api, part)).filter((p) => hasNameToken(p, part)),
      spellingMatch,
    );
    if (near && near.score >= 0.85) return { ...near, approximate: true };
  }
  return null;
}

export async function related(
  api: OpenAlex,
  ref: string,
  limit: number,
  page = 1,
): Promise<{ base: Work; works: Work[]; total: number }> {
  const base = await getWork(api, ref);
  const all = (base.related_works ?? []).map(shortId);
  const ids = all.slice((page - 1) * limit, page * limit);
  if (ids.length === 0) return { base, works: [], total: all.length };
  const res: any = await getJson<any>(api, "/works", params(api, { filter: `openalex:${ids.join("|")}`, per_page: ids.length, select: LIST_FIELDS }));
  return { base, works: res.results ?? [], total: all.length };
}

export async function citedBy(
  api: OpenAlex,
  ref: string,
  limit: number,
  page = 1,
): Promise<{ base: Work; works: Work[]; total: number }> {
  const base = await getWork(api, ref);
  const res: any = await getJson<any>(
    api,
    "/works",
    params(api, { filter: `cites:${shortId(base.id)}`, sort: "publication_date:desc", ...pageParams(page, limit), select: LIST_FIELDS }),
  );
  const { works, total } = workPage(res, limit);
  return { base, works, total };
}

/** How many ids go into one filter list, so a long reference list is asked for in parts. */
const ID_CHUNK = 100;

/** How many parts are asked for at the same time, so the server is not flooded. */
const ID_PARALLEL = 4;

/** Orders two works the way a reference list was asked for. Works with no year go last. */
function compareWorks(a: Work, b: Work, sort: string): number {
  if (sort === "publication_year:asc") {
    const ay = a.publication_year ?? Number.MAX_SAFE_INTEGER;
    const by = b.publication_year ?? Number.MAX_SAFE_INTEGER;
    return ay - by;
  }
  return (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0);
}

/**
 * The papers that one paper cites, read from the referenced works it lists.
 * A paper can list hundreds of references, so the ids are asked for in parts and
 * the best ones are picked out of every part.
 * The sort is the order the caller asked for, such as cited_by_count:desc.
 */
export async function references(
  api: OpenAlex,
  ref: string,
  limit: number,
  sort: string,
  page = 1,
): Promise<{ base: Work; works: Work[]; total: number }> {
  const base = await getWork(api, ref, REFERENCES_FIELDS);
  const ids = (base.referenced_works ?? []).map(shortId);
  if (ids.length === 0) return { base, works: [], total: 0 };
  const apiSort = REFERENCE_SORTS[sort] ?? "cited_by_count:desc";
  // Enough of every part to fill the page, so the best ones of the whole list are picked out.
  const perPart = Math.min(page * limit, ID_CHUNK);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));
  const pages: any[] = [];
  for (let i = 0; i < chunks.length; i += ID_PARALLEL) {
    const group = chunks.slice(i, i + ID_PARALLEL);
    const res = await Promise.all(
      group.map((chunk) =>
        getJson<any>(api, "/works", params(api, { filter: `openalex:${chunk.join("|")}`, sort: apiSort, per_page: perPart, select: LIST_FIELDS })),
      ),
    );
    pages.push(...res);
  }
  const works = pages.flatMap((p) => p?.results ?? []);
  works.sort((a: Work, b: Work) => compareWorks(a, b, sort));
  return { base, works: works.slice((page - 1) * limit, page * limit), total: ids.length };
}
