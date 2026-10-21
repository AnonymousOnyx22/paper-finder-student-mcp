import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** The source of the server, so a name in the changelog can be checked against the code. */
const source = ["../src/tools.ts", "../src/openalex.ts", "../src/core/tools.ts", "../src/core/http.ts"]
  .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
  .join("\n");

/** The headings of the changelog, in the order they appear. */
const headings = [...changelog.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

/** The text of one "## heading" section, so the other sections do not count. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}`);
  if (start === -1) throw new Error(`the ${heading} section is missing`);
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
}

const unreleased = headings.findIndex((h) => h.toLowerCase() === "unreleased");
/** The newest release entry, which is the one under an Unreleased heading when there is one. */
const newest = unreleased === -1 ? headings[0] : headings[unreleased + 1];
const newestText = section(changelog, newest);

describe("CHANGELOG", () => {
  it("leads with the version in package.json", () => {
    expect(newest).toBe(pkg.version);
  });

  it("keeps an Unreleased section at the top, never below a release", () => {
    if (unreleased !== -1) expect(unreleased, "the Unreleased section has to come first").toBe(0);
  });

  it("names only things the server really has", () => {
    const mentioned = new Set(newestText.match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g) ?? []);
    for (const name of mentioned) expect(source, `${name} is not in the code`).toContain(name);
  });

  it("writes the newest entry without dashes or marketing words", () => {
    expect(newestText).not.toMatch(/[\u2014\u2013]/);
    for (const word of ["seamless", "robust", "leverage", "elevate"]) {
      expect(newestText.toLowerCase(), word).not.toMatch(new RegExp("\\b" + word));
    }
    const prose = newestText.replace(/`[^`]*`/g, " ");
    const hyphenated = [...prose.matchAll(/\b[A-Za-z][A-Za-z]*-[A-Za-z][A-Za-z]*\b/g)].map((m) => m[0]);
    expect(hyphenated).toEqual([]);
  });
});
