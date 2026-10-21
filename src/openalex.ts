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

/** Fetch one JSON document, turning a 404 for a known ref and a 429 into typed errors. */
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

/** Papers that belong to one OpenAlex author id, whatever name is written on the papers. */
export async function authorIdPapers(
  api: OpenAlex,
  authorId: string,
  opts: { fromYear?: number; openAccessOnly?: boolean; limit: number },
): Promise<Work[]> {
  const filters = [`author.id:${authorId}`];
  if (opts.fromYear) filters.push(`from_publication_date:${opts.fromYear}-01-01`);
  if (opts.openAccessOnly) filters.push("is_oa:true");
  const res: any = await getJson<any>(api, "/works", params(api, { filter: filters.join(","), sort: "cited_by_count:desc", per_page: opts.limit, select: FIELDS }));
  return res.results ?? [];
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
