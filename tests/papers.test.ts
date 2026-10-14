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
      if (q === "nothing") return json({ results: [] });
      if (filter.startsWith("openalex:")) return json({ results: filter.slice(9).split("|").map((id) => work(Number(id.slice(1)))) });
      if (filter.startsWith("cites:")) return json({ results: [work(500), work(501)] });
      return json({ results: [work(2), work(3)] });
    }
    if (url.pathname === "/works/doi:10.1000/p2" || url.pathname === "/works/W2")
      return json(work(2, { abstract_inverted_index: { Hello: [0], tested: [2], world: [1] }, related_works: ["https://openalex.org/W10", "https://openalex.org/W11"] }));
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
  return { text: r.content[0].text as string, isError: !!r.isError };
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
  it("lists four read only tools", async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual(["cited_by", "get_paper", "related_papers", "search_papers"]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
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
  it("says when nothing matches", async () => {
    expect((await call("search_papers", { query: "nothing" })).text).toContain("No papers found");
  });
  it("shows an abstract for a DOI", async () => {
    const r = await call("get_paper", { paper: "10.1000/p2" });
    expect(r.text).toContain("Abstract\nHello world tested");
  });
  it("finds related and citing papers", async () => {
    expect((await call("related_papers", { paper: "W2", limit: 2 })).text).toContain("Paper 10");
    expect((await call("cited_by", { paper: "W2" })).text).toContain("Paper 500");
  });
  it("returns a friendly error for an unknown paper and a bad id", async () => {
    const a = await call("get_paper", { paper: "10.1000/unknown" });
    expect(a.isError).toBe(true);
    expect(a.text).toContain("Not found");
    const b = await call("get_paper", { paper: "hello" });
    expect(b.isError).toBe(true);
    expect(b.text).toContain("not a DOI");
  });
});
