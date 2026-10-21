import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, makeApi } from "../src/server.js";
import { abstractOf, nameMatch, normalizeRef, snippetOf, spellingMatch } from "../src/openalex.js";

const work = (n: number, extra: Record<string, unknown> = {}) => ({
  id: `https://openalex.org/W${n}`,
  doi: `https://doi.org/10.1000/p${n}`,
  display_name: `Paper ${n}`,
  publication_year: 2020 + (n % 5),
  cited_by_count: n * 10,
  authorships: [{ author: { display_name: "A One" } }, { author: { display_name: "B Two" } }, { author: { display_name: "C Three" } }, { author: { display_name: "D Four" } }],
  primary_location: { source: { display_name: "Journal of Tests" } },
  open_access: { is_oa: n % 2 === 0, oa_url: n % 2 === 0 ? `https://free.example/${n}` : null },
  ...extra,
});

/** An OpenAlex abstract index for a list of words in reading order. */
const abstractIndex = (words: string[]) => Object.fromEntries(words.map((w, i) => [w, [i]]));

const authorProfile = (id: string, name: string, works = 5, cited = 50, alternatives: string[] = []) => ({
  id: `https://openalex.org/${id}`,
  display_name: name,
  works_count: works,
  cited_by_count: cited,
  display_name_alternatives: alternatives,
});

const profiles: Record<string, ReturnType<typeof authorProfile>> = {
  A100: authorProfile("A100", "Ada Lovelace", 12, 300),
  A101: authorProfile("A101", "Ada Lovelace", 3, 10),
  A200: authorProfile("A200", "John Dewey", 30, 900, ["Dewey, John", "J Dewey"]),
  A300: authorProfile("A300", "John Smith", 20, 500, ["J. Smith", "Smith, John"]),
  A400: authorProfile("A400", "Jonathan James Deeks", 800, 50000, ["Jon Deeks"]),
};

let srv: http.Server;
let client: Client;
const seen: URL[] = [];

beforeAll(async () => {
  srv = http.createServer((req, res) => {
    const url = new URL(req.url!, "http://x");
    seen.push(url);
    const json = (d: unknown, code = 200) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(d));
    };
    if (url.pathname === "/authors") {
      const search = (url.searchParams.get("search") ?? "").replace(/[,.]/g, "").replace(/\s+/g, " ").trim();
      if (search.toLowerCase().includes("ratelimit")) return json({ error: "Rate limit exceeded" }, 429);
      if (search === "Ada Lovelace") return json({ results: [profiles.A100, profiles.A101] });
      if (search === "Dewey") return json({ results: [profiles.A200] });
      if (search === "J Smith" || search === "Smith") return json({ results: [profiles.A300] });
      if (search === "Jon" || search === "Jonn") return json({ results: [profiles.A400] });
      return json({ results: [] });
    }
    if (url.pathname.startsWith("/authors/")) {
      const profile = profiles[url.pathname.slice("/authors/".length)];
      if (!profile) return json({ error: "not found" }, 404);
      return json(profile);
    }
    if (url.pathname === "/works") {
      const q = url.searchParams.get("search");
      const filter = url.searchParams.get("filter") ?? "";
      if (q === "ratelimit") return json({ error: "Rate limit exceeded" }, 429);
      if (q === "nothing") return json({ results: [] });
      if (filter.startsWith("openalex:")) {
        const ids = filter.slice(9).split("|");
        if (ids.every((id) => id === "W9999")) return json({ results: [] });
        return json({ results: ids.map((id) => work(Number(id.slice(1)), { abstract_inverted_index: abstractIndex(["Summary", "of", "paper", `${id}.`]) })) });
      }
      if (filter.startsWith("cites:"))
        return json({
          results: [
            work(500, { abstract_inverted_index: abstractIndex(["A", "paper", "that", "cites", "the", "base."]) }),
            work(501, { abstract_inverted_index: abstractIndex(["Another", "citing", "paper."]) }),
          ],
        });
      if (filter.startsWith("author.id:A100")) return json({ results: [work(7), work(8)] });
      if (filter.startsWith("author.id:A200")) return json({ results: [work(9)] });
      if (filter.startsWith("author.id:A300")) return json({ results: [work(10)] });
      if (filter.startsWith("raw_author_name.search:Nobody")) return json({ results: [] });
      if (filter.startsWith("raw_author_name.search:Jon Deweey")) return json({ results: [] });
      if (filter.toLowerCase().includes("ratelimit")) return json({ error: "Rate limit exceeded" }, 429);
      if (filter.startsWith("raw_author_name.search:")) return json({ results: [work(7), work(8)] });
      return json({ results: [work(2, { abstract_inverted_index: abstractIndex(["Spaced", "repetition", "raises", "recall", "in", "students."]) }), work(3, { abstract_inverted_index: abstractIndex(["A", "study", "of", "testing", "effects."]) })] });
    }
    if (url.pathname === "/works/doi:10.1000/ratelimited") return json({ error: "Rate limit exceeded" }, 429);
    if (url.pathname === "/works/doi:10.1000/p3") return json(work(3));
    if (url.pathname === "/works/doi:10.1000/p2" || url.pathname === "/works/W2")
      return json(work(2, { abstract_inverted_index: { Hello: [0], tested: [2], world: [1] }, related_works: ["https://openalex.org/W10", "https://openalex.org/W11"], referenced_works: ["https://openalex.org/W21", "https://openalex.org/W20"], best_oa_location: { pdf_url: "https://free.example/2/paper.pdf" } }));
    if (url.pathname === "/works/W150")
      return json(work(150, { referenced_works: Array.from({ length: 150 }, (_, i) => `https://openalex.org/W${1000 + i}`) }));
    if (url.pathname === "/works/W151") return json(work(151, { referenced_works: ["https://openalex.org/W9999"] }));
    json({}, 404);
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer(makeApi(base, "me@example.com")).connect(a);
  client = new Client({ name: "test", version: "0" });
  await client.connect(b);
});
afterAll(() => srv.close());

async function call(name: string, args: Record<string, unknown> = {}) {
  const r: any = await client.callTool({ name, arguments: args });
  return { text: r.content[0].text as string, isError: !!r.isError, code: r.code as string | undefined };
}

describe("helpers", () => {
  it("rebuilds an abstract and normalizes ids", () => {
    expect(abstractOf({ Hello: [0], tested: [2], world: [1] })).toBe("Hello world tested");
    expect(normalizeRef("https://doi.org/10.1000/abc")).toBe("doi:10.1000/abc");
    expect(normalizeRef("https://openalex.org/w123")).toBe("W123");
    expect(() => normalizeRef("nope")).toThrow("not a DOI");
  });
  it("scores author names that point at the same person close together", () => {
    expect(nameMatch("John Dewey", "John Dewey")).toBe(1);
    expect(nameMatch("Dewey, John", "John Dewey")).toBeGreaterThan(0.8);
    expect(nameMatch("J. Smith", "John Smith")).toBeGreaterThan(0.8);
    expect(nameMatch("Jon Dewey", "John Dewey")).toBeGreaterThan(0.85);
    expect(nameMatch("John Dewey", "Marie Curie")).toBeLessThan(0.5);
    expect(nameMatch("John Dewey", "")).toBe(0);
  });
  it("scores a wrong spelling lower than the same name", () => {
    expect(spellingMatch("Jon Dewey", "John Dewey")).toBeGreaterThan(0.85);
    expect(spellingMatch("Jon Deweey", "Jonathan James Deeks")).toBeLessThan(0.85);
    expect(spellingMatch("John Dewey", "John Dewey")).toBe(1);
  });
  it("cuts an abstract down to one short line", () => {
    expect(snippetOf({ Hello: [0], world: [1], tested: [2] })).toBe("Hello world tested");
    expect(snippetOf({ "Spaced": [0], "repetition": [1], "helps": [2], "students.": [3] })).toBe("Spaced repetition helps students.");
    expect(snippetOf(undefined)).toBe("");
    const long = snippetOf(abstractIndex(Array.from({ length: 120 }, (_, i) => `word${i}`)));
    expect(long.length).toBeLessThanOrEqual(203);
    expect(long.endsWith("...")).toBe(true);
  });
});

describe("MCP tools", () => {
  it("lists eleven read only tools", async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "cited_by",
      "find_citing_papers",
      "find_open_access_pdf",
      "find_related_papers",
      "get_paper",
      "get_paper_by_doi",
      "get_related_work",
      "list_author_papers",
      "paper_references",
      "related_papers",
      "search_papers",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });
  it("describes the inputs and one example prompt for every tool, with no dashes", async () => {
    for (const t of (await client.listTools()).tools) {
      expect(t.description).toContain("Inputs:");
      expect(t.description).toContain("Example prompt:");
      expect(t.description).not.toMatch(/[—–]/);
    }
  });
  it("searches with filters and shows free links", async () => {
    const r = await call("search_papers", { query: "spaced repetition", from_year: 2021, open_access_only: true, limit: 2 });
    expect(r.text).toContain("Paper 2");
    expect(r.text).toContain("A One, B Two, C Three, et al.");
    expect(r.text).toContain("Free to read, https://free.example/2");
    expect(r.text).toContain("No free copy found");
    const u = seen[seen.length - 1];
    expect(u.searchParams.get("filter")).toBe("from_publication_date:2021-01-01,is_oa:true");
    expect(u.searchParams.get("mailto")).toBe("me@example.com");
  });
  it("says when nothing matches and blames the filters that hid everything", async () => {
    expect((await call("search_papers", { query: "nothing" })).text).toContain("No papers found");
    const filtered = await call("search_papers", { query: "nothing", open_access_only: true, from_year: 2021 });
    expect(filtered.isError).toBe(false);
    expect(filtered.text).toContain("open_access_only");
    expect(filtered.text).toContain("from_year");
    const typed = await call("search_papers", { query: "nothing", type: "preprint" });
    expect(typed.isError).toBe(false);
    expect(typed.text).toContain("type");
  });
  it("orders search results by the most cited papers first", async () => {
    const r = await call("search_papers", { query: "spaced repetition", sort: "cited_by_count:desc", limit: 2 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("most cited first");
    expect(seen[seen.length - 1].searchParams.get("sort")).toBe("cited_by_count:desc");
  });
  it("orders search results by the newest papers first", async () => {
    const r = await call("search_papers", { query: "spaced repetition", sort: "publication_date:desc" });
    expect(r.text).toContain("newest first");
    expect(seen[seen.length - 1].searchParams.get("sort")).toBe("publication_date:desc");
  });
  it("keeps the OpenAlex order when no sort is asked for", async () => {
    const r = await call("search_papers", { query: "spaced repetition" });
    expect(r.text).toContain("in the order OpenAlex ranks them");
    expect(seen[seen.length - 1].searchParams.get("sort")).toBeNull();
    const asked = await call("search_papers", { query: "spaced repetition", sort: "relevance" });
    expect(asked.text).toContain("in the order OpenAlex ranks them");
    expect(seen[seen.length - 1].searchParams.get("sort")).toBeNull();
  });
  it("keeps search results to one kind of paper", async () => {
    const journal = await call("search_papers", { query: "spaced repetition", type: "journal_article" });
    expect(journal.text).toContain("journal articles only");
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("type:article");
    await call("search_papers", { query: "spaced repetition", type: "preprint" });
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("type:preprint");
    await call("search_papers", { query: "spaced repetition", type: "book_chapter" });
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("type:book-chapter");
  });
  it("keeps the type and the other filters together in one query", async () => {
    await call("search_papers", { query: "spaced repetition", from_year: 2021, open_access_only: true, type: "journal_article", limit: 2 });
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe(
      "from_publication_date:2021-01-01,is_oa:true,type:article",
    );
  });
  it("shows a one line abstract under each search result", async () => {
    const r = await call("search_papers", { query: "spaced repetition", limit: 2 });
    expect(r.text).toContain("Abstract: Spaced repetition raises recall in students.");
    expect(r.text).toContain("Abstract: A study of testing effects.");
    expect(seen[seen.length - 1].searchParams.get("select")).toContain("abstract_inverted_index");
  });
  it("shows a one line abstract under each citing paper", async () => {
    const r = await call("find_citing_papers", { paper: "W2", limit: 2 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Abstract: A paper that cites the base.");
    expect(r.text).toContain("Abstract: Another citing paper.");
    expect(seen[seen.length - 1].searchParams.get("select")).toContain("abstract_inverted_index");
  });
  it("shows a one line abstract under each related paper", async () => {
    const r = await call("find_related_papers", { paper: "W2", limit: 2 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Abstract: Summary of paper W10.");
    expect(r.text).toContain("Abstract: Summary of paper W11.");
    expect(seen[seen.length - 1].searchParams.get("select")).toContain("abstract_inverted_index");
  });
  it("shows a one line abstract under each reference", async () => {
    const r = await call("paper_references", { paper: "W2", limit: 5 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Abstract: Summary of paper W21.");
    expect(r.text).toContain("Abstract: Summary of paper W20.");
    expect(seen[seen.length - 1].searchParams.get("select")).toContain("abstract_inverted_index");
  });
  it("refuses a sort order or a paper type it does not know", async () => {
    const badSort = await call("search_papers", { query: "spaced repetition", sort: "nonsense" });
    expect(badSort.isError).toBe(true);
    expect(badSort.text).toContain("cited_by_count:desc");
    const badType = await call("search_papers", { query: "spaced repetition", type: "nonsense" });
    expect(badType.isError).toBe(true);
    expect(badType.text).toContain("journal_article");
  });
  it("shows an abstract for a DOI", async () => {
    const r = await call("get_paper", { paper: "10.1000/p2" });
    expect(r.text).toContain("Abstract\nHello world tested");
  });
  it("gets a paper through the doi input and says what is missing when neither input is given", async () => {
    const r = await call("get_paper", { doi: "https://doi.org/10.1000/p2" });
    expect(r.text).toContain("Abstract\nHello world tested");
    const bad = await call("get_paper", { doi: "W2" });
    expect(bad.isError).toBe(true);
    expect(bad.code).toBe("invalid_ref");
    const missing = await call("get_paper");
    expect(missing.isError).toBe(true);
    expect(missing.code).toBe("invalid_ref");
    expect(missing.text).toContain("needs a paper or a doi");
  });
  it("gets a paper by DOI only and points elsewhere for an OpenAlex id", async () => {
    const r = await call("get_paper_by_doi", { doi: "https://doi.org/10.1000/p2" });
    expect(r.text).toContain("Abstract\nHello world tested");
    const bad = await call("get_paper_by_doi", { doi: "W2" });
    expect(bad.isError).toBe(true);
    expect(bad.code).toBe("invalid_ref");
    expect(bad.text).toContain("not a DOI");
    expect(bad.text).toContain("Use get_paper");
    expect((await call("get_paper_by_doi", { doi: "10.1000/unknown" })).code).toBe("not_found");
  });
  it("returns a free copy link, preferring a PDF, and says plainly when there is none", async () => {
    const r = await call("find_open_access_pdf", { paper: "10.1000/p2" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("PDF: https://free.example/2/paper.pdf");
    expect(r.text).toContain("Free to read page: https://free.example/2");
    const none = await call("find_open_access_pdf", { paper: "10.1000/p3" });
    expect(none.isError).toBe(false);
    expect(none.text).toContain("No free copy of \"Paper 3\"");
    expect((await call("find_open_access_pdf", { paper: "10.1000/unknown" })).code).toBe("not_found");
  });
  it("resolves the author name to an OpenAlex author id and takes the papers from that id", async () => {
    const r = await call("list_author_papers", { author: "Ada Lovelace", from_year: 2019, open_access_only: true, limit: 3 });
    expect(r.text).toContain('Papers by "Ada Lovelace" (OpenAlex author A100), most cited first');
    expect(r.text).toContain("Paper 7");
    const u = seen[seen.length - 1];
    expect(u.searchParams.get("filter")).toBe("author.id:A100,from_publication_date:2019-01-01,is_oa:true");
    expect(u.searchParams.get("sort")).toBe("cited_by_count:desc");
    expect(u.searchParams.get("per_page")).toBe("3");
    expect(u.searchParams.get("mailto")).toBe("me@example.com");
    expect(seen.some((s) => s.pathname === "/authors" && s.searchParams.get("search") === "Ada Lovelace")).toBe(true);
  });
  it("lists the other OpenAlex profiles that carry the same name", async () => {
    const r = await call("list_author_papers", { author: "Ada Lovelace" });
    expect(r.text).toContain("Other OpenAlex profiles with this name: A101 (3 papers).");
    expect(r.text).toContain("Pass one of those ids as author");
  });
  it("takes an OpenAlex author id as it is", async () => {
    const r = await call("list_author_papers", { author: "A200" });
    expect(r.text).toContain('Papers by "John Dewey" (OpenAlex author A200), most cited first');
    expect(r.text).toContain("Paper 9");
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("author.id:A200");
    const bad = await call("list_author_papers", { author: "A999" });
    expect(bad.isError).toBe(true);
    expect(bad.code).toBe("not_found");
    expect(bad.text).toContain("no author with the id A999");
  });
  it("finds an author whose name is written in another form", async () => {
    const r = await call("list_author_papers", { author: "J. Smith" });
    expect(r.text).toContain('Papers by "John Smith" (OpenAlex author A300), most cited first');
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("author.id:A300");
  });
  it("takes the closest match when the name was typed slightly wrong", async () => {
    const r = await call("list_author_papers", { author: "Jon Dewey" });
    expect(r.text).toContain('Papers by "John Dewey" (OpenAlex author A200), most cited first');
    expect(r.text).toContain('OpenAlex had no record for "Jon Dewey" as it was typed, so this is the closest match.');
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("author.id:A200");
  });
  it("takes the closest match when the name parts are in another order and one is wrong", async () => {
    const r = await call("list_author_papers", { author: "Dewey, Jonn" });
    expect(r.text).toContain('Papers by "John Dewey" (OpenAlex author A200), most cited first');
    expect(r.text).toContain('OpenAlex had no record for "Dewey, Jonn" as it was typed, so this is the closest match.');
  });
  it("does not settle for a different person when the name does not match", async () => {
    const r = await call("list_author_papers", { author: "Jon Deweey" });
    expect(r.text).toContain('No papers found for author "Jon Deweey"');
    expect(r.text).not.toContain("A400");
    expect(r.text).not.toContain("Jonathan James Deeks");
  });
  it("falls back to the name on the paper when OpenAlex has no author record", async () => {
    const r = await call("list_author_papers", { author: "Ada Byron" });
    expect(r.text).toContain('Papers matching the name "Ada Byron" as it is written on them, most cited first');
    expect(r.text).toContain("OpenAlex has no author record for that name");
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("raw_author_name.search:Ada Byron");
  });
  it("says when nothing matches and blames the name and the filters", async () => {
    const empty = await call("list_author_papers", { author: "Nobody" });
    expect(empty.isError).toBe(false);
    expect(empty.text).toContain('No papers found for author "Nobody"');
    expect(empty.text).toContain("OpenAlex has no author record under that name");
  });
  it("finds related and citing papers", async () => {
    expect((await call("find_related_papers", { paper: "W2", limit: 2 })).text).toContain("Paper 10");
    expect((await call("related_papers", { paper: "W2", limit: 2 })).text).toContain("Paper 10");
    const alt = await call("get_related_work", { paper: "W2", limit: 2 });
    expect(alt.text).toContain("Related work for \"Paper 2\"");
    expect(alt.text).toContain("Paper 10");
    expect((await call("find_citing_papers", { paper: "W2" })).text).toContain("Paper 500");
    expect((await call("cited_by", { paper: "W2" })).text).toContain("Paper 500");
  });
  it("gives the same answer for the new tool names and the old ones", async () => {
    const related = await call("find_related_papers", { paper: "W2", limit: 2 });
    const oldRelated = await call("related_papers", { paper: "W2", limit: 2 });
    expect(related.text).toBe(oldRelated.text);
    const citing = await call("find_citing_papers", { paper: "W2", limit: 2 });
    const oldCiting = await call("cited_by", { paper: "W2", limit: 2 });
    expect(citing.text).toBe(oldCiting.text);
  });
  it("orders the citing papers newest first", async () => {
    const r = await call("find_citing_papers", { paper: "W2", limit: 2 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('Papers citing "Paper 2"');
    expect(seen[seen.length - 1].searchParams.get("filter")).toBe("cites:W2");
    expect(seen[seen.length - 1].searchParams.get("sort")).toBe("publication_date:desc");
  });
  it("lists the papers a paper cites, most cited first", async () => {
    const r = await call("paper_references", { paper: "W2", limit: 5 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('References of "Paper 2"');
    expect(r.text).toContain("most cited first");
    expect(r.text).toContain("Paper 21");
    expect(r.text).toContain("Paper 20");
    const u = seen[seen.length - 1];
    expect(u.searchParams.get("filter")).toBe("openalex:W21|W20");
    expect(u.searchParams.get("sort")).toBe("cited_by_count:desc");
  });
  it("can put the oldest references first", async () => {
    const r = await call("paper_references", { paper: "W2", sort: "publication_year:asc" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("oldest first");
    expect(seen[seen.length - 1].searchParams.get("sort")).toBe("publication_date:asc");
    expect(r.text.indexOf("Paper 20")).toBeLessThan(r.text.indexOf("Paper 21"));
  });
  it("says how many references the paper has when the limit hides some of them", async () => {
    const r = await call("paper_references", { paper: "W2", limit: 1 });
    expect(r.text).toContain("(2 in OpenAlex)");
    expect(r.text).toContain("Paper 21");
    expect(r.text).not.toContain("Paper 20");
  });
  it("takes the papers a paper cites from the OpenAlex reference list", async () => {
    const before = seen.length;
    await call("paper_references", { paper: "W2" });
    const base = seen.slice(before).find((s) => s.pathname === "/works/W2");
    expect(base?.searchParams.get("select")).toContain("referenced_works");
  });
  it("says plainly when a paper has no reference list in OpenAlex", async () => {
    const r = await call("paper_references", { paper: "10.1000/p3" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('OpenAlex lists no references for "Paper 3"');
    expect(r.text).toContain("find_citing_papers");
  });
  it("points at the citing papers when OpenAlex lists no related papers", async () => {
    const r = await call("find_related_papers", { paper: "10.1000/p3" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain('OpenAlex lists no related papers for "Paper 3"');
    expect(r.text).toContain("find_citing_papers");
  });
  it("says when the references are listed but none of them can be read", async () => {
    const r = await call("paper_references", { paper: "W151" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("OpenAlex lists 1 references for");
    expect(r.text).toContain("none of them could be read");
  });
  it("fetches a long reference list in parts of a hundred ids", async () => {
    const before = seen.length;
    const r = await call("paper_references", { paper: "W150", limit: 2 });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("(150 in OpenAlex)");
    const filters = seen
      .slice(before)
      .filter((s) => s.pathname === "/works" && (s.searchParams.get("filter") ?? "").startsWith("openalex:"));
    expect(filters.length).toBe(2);
    for (const f of filters) {
      const ids = (f.searchParams.get("filter") ?? "").slice(9).split("|");
      expect(ids.length).toBeLessThanOrEqual(100);
    }
  });
  it("refuses a reference sort it does not know", async () => {
    const r = await call("paper_references", { paper: "W2", sort: "nonsense" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("cited_by_count:desc");
  });
  it("returns a typed not found error that suggests a title search or a DOI check", async () => {
    const r = await call("get_paper", { paper: "10.1000/unknown" });
    expect(r.isError).toBe(true);
    expect(r.code).toBe("not_found");
    expect(r.text).toContain("no paper for \"10.1000/unknown\"");
    expect(r.text).toContain("Check the DOI format");
    expect(r.text).toContain("search by the title with search_papers");
    expect((await call("cited_by", { paper: "W999" })).code).toBe("not_found");
    expect((await call("find_citing_papers", { paper: "W999" })).code).toBe("not_found");
    expect((await call("get_paper_by_doi", { doi: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("find_open_access_pdf", { paper: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("related_papers", { paper: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("find_related_papers", { paper: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("get_related_work", { paper: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("paper_references", { paper: "10.1000/unknown" })).code).toBe("not_found");
  });
  it("returns a typed rate limit error instead of an empty answer", async () => {
    const a = await call("get_paper", { paper: "10.1000/ratelimited" });
    expect(a.isError).toBe(true);
    expect(a.code).toBe("rate_limited");
    expect(a.text).toContain("rate limited");
    expect(a.text).toContain("Wait about a minute");
    const b = await call("search_papers", { query: "ratelimit" });
    expect(b.isError).toBe(true);
    expect(b.code).toBe("rate_limited");
    const c = await call("related_papers", { paper: "10.1000/ratelimited" });
    expect(c.isError).toBe(true);
    expect(c.code).toBe("rate_limited");
    expect((await call("get_paper_by_doi", { doi: "10.1000/ratelimited" })).code).toBe("rate_limited");
    expect((await call("find_open_access_pdf", { paper: "10.1000/ratelimited" })).code).toBe("rate_limited");
    expect((await call("get_related_work", { paper: "10.1000/ratelimited" })).code).toBe("rate_limited");
    expect((await call("cited_by", { paper: "10.1000/ratelimited" })).code).toBe("rate_limited");
    expect((await call("find_citing_papers", { paper: "10.1000/ratelimited" })).code).toBe("rate_limited");
    expect((await call("find_related_papers", { paper: "10.1000/ratelimited" })).code).toBe("rate_limited");
    expect((await call("paper_references", { paper: "10.1000/ratelimited" })).code).toBe("rate_limited");
    expect((await call("list_author_papers", { author: "ratelimit" })).code).toBe("rate_limited");
  });
  it("returns a typed invalid ref error for a bad id", async () => {
    const r = await call("get_paper", { paper: "hello" });
    expect(r.isError).toBe(true);
    expect(r.code).toBe("invalid_ref");
    expect(r.text).toContain("not a DOI");
    expect(r.text).not.toContain("Something went wrong");
  });
});
