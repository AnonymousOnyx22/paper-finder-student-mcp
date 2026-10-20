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
  it("lists every tool with the parameters the code accepts", () => {
    const lines = llms.split("\n");
    for (const t of tools) {
      const line = lines.find((l) => l.startsWith(`- ${t.name}:`));
      expect(line, `${t.name} is missing from llms.txt`).toBeDefined();
      for (const p of Object.keys(t.inputSchema)) expect(line).toContain(p);
    }
    expect(glama.tools.map((t) => t.name).sort()).toEqual(tools.map((t) => t.name).sort());
    for (const t of tools) {
      const listed = glama.tools.find((g) => g.name === t.name);
      expect(listed?.parameters.slice().sort(), `${t.name} parameters in glama.json`).toEqual(
        Object.keys(t.inputSchema).sort(),
      );
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
