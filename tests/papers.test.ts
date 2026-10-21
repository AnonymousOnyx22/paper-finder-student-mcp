import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, makeApi } from "../src/server.js";
import { abstractOf, normalizeRef } from "../src/openalex.js";

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
    if (url.pathname === "/works") {
      const q = url.searchParams.get("search");
      const filter = url.searchParams.get("filter") ?? "";
      if (q === "ratelimit") return json({ error: "Rate limit exceeded" }, 429);
      if (q === "nothing") return json({ results: [] });
      if (filter.startsWith("openalex:")) return json({ results: filter.slice(9).split("|").map((id) => work(Number(id.slice(1)))) });
      if (filter.startsWith("cites:")) return json({ results: [work(500), work(501)] });
      if (filter.startsWith("raw_author_name.search:Nobody")) return json({ results: [] });
      if (filter.toLowerCase().includes("ratelimit")) return json({ error: "Rate limit exceeded" }, 429);
      if (filter.startsWith("raw_author_name.search:")) return json({ results: [work(7), work(8)] });
      return json({ results: [work(2), work(3)] });
    }
    if (url.pathname === "/works/doi:10.1000/ratelimited") return json({ error: "Rate limit exceeded" }, 429);
    if (url.pathname === "/works/doi:10.1000/p3") return json(work(3));
    if (url.pathname === "/works/doi:10.1000/p2" || url.pathname === "/works/W2")
      return json(work(2, { abstract_inverted_index: { Hello: [0], tested: [2], world: [1] }, related_works: ["https://openalex.org/W10", "https://openalex.org/W11"], best_oa_location: { pdf_url: "https://free.example/2/paper.pdf" } }));
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
});

describe("MCP tools", () => {
  it("lists eight read only tools", async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "cited_by",
      "find_open_access_pdf",
      "get_paper",
      "get_paper_by_doi",
      "get_related_work",
      "list_author_papers",
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
  it("lists an author's papers most cited first and blames the name when nothing matches", async () => {
    const r = await call("list_author_papers", { author: "Ada Lovelace", from_year: 2019, open_access_only: true, limit: 3 });
    expect(r.text).toContain("Papers by \"Ada Lovelace\", most cited first");
    expect(r.text).toContain("Paper 7");
    const u = seen[seen.length - 1];
    expect(u.searchParams.get("filter")).toBe("raw_author_name.search:Ada Lovelace,from_publication_date:2019-01-01,is_oa:true");
    expect(u.searchParams.get("sort")).toBe("cited_by_count:desc");
    expect(u.searchParams.get("per_page")).toBe("3");
    expect(u.searchParams.get("mailto")).toBe("me@example.com");
    const empty = await call("list_author_papers", { author: "Nobody" });
    expect(empty.isError).toBe(false);
    expect(empty.text).toContain("No papers found for author \"Nobody\"");
  });
  it("finds related and citing papers", async () => {
    expect((await call("related_papers", { paper: "W2", limit: 2 })).text).toContain("Paper 10");
    const alt = await call("get_related_work", { paper: "W2", limit: 2 });
    expect(alt.text).toContain("Related work for \"Paper 2\"");
    expect(alt.text).toContain("Paper 10");
    expect((await call("cited_by", { paper: "W2" })).text).toContain("Paper 500");
  });
  it("returns a typed not found error that suggests a title search or a DOI check", async () => {
    const r = await call("get_paper", { paper: "10.1000/unknown" });
    expect(r.isError).toBe(true);
    expect(r.code).toBe("not_found");
    expect(r.text).toContain("no paper for \"10.1000/unknown\"");
    expect(r.text).toContain("Check the DOI format");
    expect(r.text).toContain("search by the title with search_papers");
    expect((await call("cited_by", { paper: "W999" })).code).toBe("not_found");
    expect((await call("get_paper_by_doi", { doi: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("find_open_access_pdf", { paper: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("related_papers", { paper: "10.1000/unknown" })).code).toBe("not_found");
    expect((await call("get_related_work", { paper: "10.1000/unknown" })).code).toBe("not_found");
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
