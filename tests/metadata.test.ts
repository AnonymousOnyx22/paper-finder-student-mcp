import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tools } from "../src/tools.js";

const llms = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
const glama: {
  maintainers: string[];
  description: string;
  tools: { name: string; description: string; parameters: string[] }[];
} = JSON.parse(readFileSync(new URL("../glama.json", import.meta.url), "utf8"));

describe("llms.txt and glama.json", () => {
  const advertised = tools.filter((t) => !t.description.startsWith("Deprecated"));
  const deprecated = tools.filter((t) => t.description.startsWith("Deprecated"));

  it("advertises the six main tools with the parameters the code accepts", () => {
    expect(advertised.map((t) => t.name).sort()).toEqual([
      "cited_by",
      "find_open_access_pdf",
      "get_paper",
      "list_author_papers",
      "related_papers",
      "search_papers",
    ]);
    const lines = llms.split("\n");
    for (const t of advertised) {
      const line = lines.find((l) => l.startsWith(`- ${t.name}:`));
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
  });
  it("keeps the deprecated aliases in the code for saved prompts but out of the tool lists", () => {
    expect(deprecated.map((t) => t.name).sort()).toEqual(["get_paper_by_doi", "get_related_work"]);
    for (const t of deprecated) {
      expect(llms).not.toContain(`- ${t.name}:`);
      expect(glama.tools.map((g) => g.name)).not.toContain(t.name);
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
});
