import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tools } from "../src/tools.js";
import type { OpenAlex } from "../src/openalex.js";
import type { HttpClient, Query } from "../src/core/http.js";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

/** The text of one "## heading" section, so the other sections do not count. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  if (start === -1) throw new Error(`the ${heading} section is missing`);
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** Every fenced code block with the given language inside a section. */
function blocks(text: string, lang: string): string[] {
  const out: string[] = [];
  const re = new RegExp("```" + lang + "\\n([\\s\\S]*?)```", "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/** The server entry the README tells people to add, whatever the key around it is. */
function entryOf(config: any): any {
  const servers = config.mcpServers ?? config.servers;
  expect(servers, "the config needs a mcpServers or servers object").toBeTruthy();
  const names = Object.keys(servers);
  expect(names.length).toBe(1);
  return servers[names[0]];
}

const install = section(readme, "Install");
const configs = blocks(install, "json").map((b) => JSON.parse(b));

describe("README install snippets", () => {
  it("shows a config for Claude Desktop, Cursor and VS Code", () => {
    expect(configs.length).toBe(3);
    expect(install).toContain("claude_desktop_config.json");
    expect(install).toContain("~/.cursor/mcp.json");
    expect(install).toContain(".vscode/mcp.json");
  });

  it("starts the server the same way in every config", () => {
    for (const config of configs) {
      const entry = entryOf(config);
      expect(entry.command).toBe("npx");
      expect(entry.args).toEqual(["-y", "paper-finder-student-mcp"]);
    }
  });

  it("uses the mcpServers key for Claude Desktop and Cursor", () => {
    for (const config of configs.slice(0, 2)) {
      expect(Object.keys(config)).toEqual(["mcpServers"]);
    }
    expect(entryOf(configs[1]).type).toBe("stdio");
  });

  it("uses the servers key for VS Code", () => {
    const vscode = configs[2];
    expect(Object.keys(vscode)).toEqual(["servers"]);
    expect(entryOf(vscode).type).toBe("stdio");
  });
});

describe("README output block", () => {
  const output = section(readme, "What it looks like");
  const block = blocks(output, "text")[0] ?? "";

  it("shows the header the tool writes for that query and sort", async () => {
    const work = {
      id: "https://openalex.org/W1",
      doi: "https://doi.org/10.1000/p1",
      display_name: "Paper 1",
      publication_year: 2020,
      cited_by_count: 10,
      authorships: [{ author: { display_name: "A One" } }],
      primary_location: { source: { display_name: "Journal of Tests" } },
      open_access: { is_oa: false, oa_url: null },
      abstract_inverted_index: { Spaced: [0], repetition: [1], helps: [2], students: [3] },
    };
    const http: HttpClient = {
      async get<T>(_path: string, _query?: Query): Promise<T> {
        return { results: [work] } as unknown as T;
      },
      async getAll<T>(): Promise<T[]> {
        return [];
      },
    };
    const api: OpenAlex = { http };
    const search = tools.find((t) => t.name === "search_papers");
    const text = await search!.run(
      { query: "spaced repetition", sort: "cited_by_count:desc", limit: 3 },
      api,
    );
    const header = text.split("\n")[0];
    expect(header).toBe('Papers about "spaced repetition", most cited first');
    expect(block.startsWith(header)).toBe(true);
    expect(block.split("\n")[1]).toMatch(/^Showing \d+ to \d+ of [\d,]+\./);
    expect(text.split("\n")[1]).toBe("Showing 1 to 1 of 1.");
  });

  it("shows every field the tool prints for a search result", () => {
    const results = block.split("\n\n").slice(1);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      const lines = result.split("\n");
      expect(lines[0]).toMatch(/^\d+\. .+ \(\d{4}\)$/);
      expect(lines[1]).toMatch(/^ {2}\S/);
      expect(lines[2]).toMatch(/^ {2}\d+ citations\. DOI \S+\. W\d+$/);
      expect(lines[3]).toMatch(/^ {2}(Free to read, \S+|No free copy found)$/);
      expect(lines[4]).toMatch(/^ {2}Abstract: \S/);
    }
  });

  it("lists the papers most cited first, as the heading says", () => {
    const counts = [...block.matchAll(/^ {2}(\d+) citations\./gm)].map((m) => Number(m[1]));
    expect(counts.length).toBeGreaterThan(1);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe("README opening", () => {
  it("splits the opening into short paragraphs", () => {
    const intro = readme.slice(readme.indexOf("[![license]"), readme.indexOf("## Install"));
    const paragraphs = intro
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && !p.startsWith("[!["));
    expect(paragraphs.length).toBeGreaterThan(1);
    for (const p of paragraphs) expect(p.length).toBeLessThan(400);
  });
});
