import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tools } from "../src/tools.js";

const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const glama: {
  maintainers: string[];
  description: string;
  tools: { name: string; description: string; parameters: string[] }[];
} = JSON.parse(readFileSync(new URL("../glama.json", import.meta.url), "utf8"));

/** The text of one "## heading" section, so other tables in the file do not count as tools. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  if (start === -1) throw new Error(`the ${heading} section is missing`);
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
}

/** The rows of the README tool table, each with the parameters it lists. */
function readmeToolRows(text: string): { name: string; params: string[] }[] {
  return section(text, "Tools")
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .map((row) => {
      const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
      return {
        name: (cells[0] ?? "").replace(/`/g, ""),
        params: (cells[2] ?? "")
          .split(",")
          .map((p) => p.trim().replace(/`/g, ""))
          .filter(Boolean),
      };
    });
}

const advertised = tools.filter((t) => !t.deprecated);
const deprecated = tools.filter((t) => t.deprecated);

const llmsToolLines = section(llms, "Tools")
  .split("\n")
  .filter((line) => /^- [a-zA-Z0-9_]+:/.test(line));
const llmsTools = llmsToolLines.map((line) => line.slice(2).split(":")[0]);
const readmeRows = readmeToolRows(readme);
const readmeTools = readmeRows.map((row) => row.name);
const glamaTools = glama.tools.map((t) => t.name);

describe("llms.txt, glama.json and README tool table", () => {
  it("advertises the main tools with the parameters the code accepts", () => {
    expect(advertised.map((t) => t.name).sort()).toEqual([
      "find_authors",
      "find_citing_papers",
      "find_open_access_pdf",
      "find_related_papers",
      "get_paper",
      "list_author_papers",
      "paper_references",
      "search_papers",
    ]);
    for (const t of advertised) {
      const line = llmsToolLines.find((l) => l.startsWith(`- ${t.name}:`));
      expect(line, `${t.name} is missing from llms.txt`).toBeDefined();
      for (const p of Object.keys(t.inputSchema)) expect(line).toContain(p);
    }
    expect(glama.tools.map((t) => t.name).sort()).toEqual(advertised.map((t) => t.name).sort());
    for (const t of advertised) {
      const listed = glama.tools.find((g) => g.name === t.name);
      expect(listed?.parameters.slice().sort(), `${t.name} parameters in glama.json`).toEqual(
        Object.keys(t.inputSchema).sort(),
      );
    }
    expect(readmeTools.slice().sort()).toEqual(advertised.map((t) => t.name).sort());
  });
  it("keeps the tool count and names in sync across README.md, llms.txt and glama.json", () => {
    expect(readmeTools.length, "tool rows in the README table").toBe(advertised.length);
    expect(llmsTools.length, "tool lines in llms.txt").toBe(advertised.length);
    expect(glamaTools.length, "tools in glama.json").toBe(advertised.length);
    expect(readmeTools.slice().sort()).toEqual(llmsTools.slice().sort());
    expect(llmsTools.slice().sort()).toEqual(glamaTools.slice().sort());
    expect(readmeTools.slice().sort()).toEqual(advertised.map((t) => t.name).sort());
  });
  it("keeps the same description and parameters for each tool in all three files", () => {
    for (const t of advertised) {
      const line = llmsToolLines.find((l) => l.startsWith(`- ${t.name}:`));
      expect(line, `${t.name} in llms.txt`).toBe(`- ${t.name}: ${t.description}`);
      const listed = glama.tools.find((g) => g.name === t.name);
      expect(listed?.description, `${t.name} description in glama.json`).toBe(t.description);
      const row = readmeRows.find((r) => r.name === t.name);
      expect(row?.params.slice().sort(), `${t.name} parameters in the README table`).toEqual(
        Object.keys(t.inputSchema).sort(),
      );
    }
  });
  it("keeps the deprecated aliases in the code for saved prompts but out of the tool lists", () => {
    expect(deprecated.map((t) => t.name).sort()).toEqual([
      "cited_by",
      "get_paper_by_doi",
      "get_related_work",
      "related_papers",
    ]);
    for (const t of deprecated) {
      expect(t.description, `${t.name} should say that it is deprecated`).toMatch(/^Deprecated/);
      expect(llms).not.toContain(`- ${t.name}:`);
      expect(glama.tools.map((g) => g.name)).not.toContain(t.name);
      expect(readmeTools).not.toContain(t.name);
    }
    for (const t of advertised) expect(t.deprecated, `${t.name} should not be deprecated`).toBeFalsy();
  });
  it("says in the README and llms.txt that the aliases are not in the tool list", () => {
    for (const text of [readme, llms]) {
      expect(text).toContain("cited_by");
      expect(text).toMatch(/not in the tool list/);
    }
  });
  it("names OpenAlex and the no key needed claim verbatim", () => {
    for (const text of [llms, JSON.stringify(glama)]) {
      expect(text).toContain("OpenAlex");
      expect(text).toContain("openalex.org");
      expect(text).toContain("no key needed");
    }
  });
});

describe("llms.txt when to use section", () => {
  const whenToUse = section(llms, "When to use this");

  it("says when to pick the server and when to leave it alone", () => {
    expect(whenToUse).toContain("OpenAlex");
    expect(whenToUse).toMatch(/most cited papers/);
    expect(whenToUse).toMatch(/free to read/);
    expect(whenToUse).toMatch(/Do not use it/);
    expect(whenToUse.length).toBeLessThan(4000);
  });

  it("names only tool names the server really has", () => {
    const known = new Set(tools.map((t) => t.name));
    const mentioned = new Set(whenToUse.match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g) ?? []);
    expect(mentioned.size).toBeGreaterThan(0);
    for (const name of mentioned)
      expect(known.has(name), `${name} is not a tool of this server`).toBe(true);
  });
});

describe("npm search metadata", () => {
  it("leads the description and keywords with the phrase academic paper search mcp", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.description.toLowerCase()).toContain("academic paper search mcp");
    expect(pkg.keywords[0].toLowerCase()).toBe("academic paper search mcp");
  });
  it("keeps the server.json description under the registry limit and on phrase", () => {
    const server = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.description.toLowerCase()).toContain("academic paper search mcp");
  });
  it("keeps glama.json and llms.txt on phrase", () => {
    const glama2 = JSON.parse(readFileSync(new URL("../glama.json", import.meta.url), "utf8"));
    expect(glama2.description.toLowerCase()).toContain("academic paper search mcp");
    const llms2 = readFileSync(new URL("../llms.txt", import.meta.url), "utf8").toLowerCase();
    expect(llms2).toContain("academic paper search mcp");
  });
  it("keeps README on phrase", () => {
    expect(readme.toLowerCase()).toContain("academic paper search mcp");
  });
});
