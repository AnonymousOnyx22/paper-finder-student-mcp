import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { tools } from "../src/tools.js";

const post = readFileSync(new URL("../POST.md", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

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

/** The example prompt each tool description carries. */
const toolPrompts = tools
  .map((t) => t.description.match(/Example prompt: '([^']+)'/)?.[1] ?? "")
  .filter(Boolean);

/** A prompt without its quotes and without the final full stop, so two prompts can be compared. */
function plain(prompt: string): string {
  return prompt
    .replace(/^["']|["']$/g, "")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();
}

describe("POST.md install block", () => {
  const install = section(post, "Install");

  it("runs the published package with npx", () => {
    const bash = blocks(install, "bash");
    expect(bash.length).toBe(1);
    expect(bash[0].trim()).toBe(`npx -y ${pkg.name}`);
  });

  it("names the same client config files the README names", () => {
    for (const file of ["claude_desktop_config.json", ".cursor/mcp.json", ".vscode/mcp.json"]) {
      expect(install, file).toContain(file);
      expect(readme, file).toContain(file);
    }
  });

  it("asks for the Node version the package asks for", () => {
    expect(pkg.engines.node).toBe(">=20");
    expect(install).toContain("Node 20 or newer");
  });
});

describe("POST.md pitch", () => {
  const paragraphs = section(post, "Pitch")
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !p.startsWith("#"));
  const pitch = paragraphs[0] ?? "";

  it("is one paragraph of plain text", () => {
    expect(paragraphs.length).toBe(1);
    expect(pitch.length).toBeGreaterThan(200);
    expect(pitch.length).toBeLessThan(900);
  });

  it("names OpenAlex and says that no key is needed", () => {
    expect(pitch).toContain("OpenAlex");
    expect(pitch).toContain("no key");
  });

  it("describes only what the tools do", () => {
    for (const claim of ["citation count", "one line abstract", "free to read", "DOI", "npx"]) {
      expect(pitch, claim).toContain(claim);
    }
  });
});

describe("POST.md example prompts", () => {
  const prompts = section(post, "Example prompts")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());

  it("gives three prompts", () => {
    expect(prompts.length).toBe(3);
  });

  it("uses prompts that the tools answer", () => {
    for (const prompt of prompts) {
      expect(toolPrompts.map(plain), prompt).toContain(plain(prompt));
    }
  });
});

describe("POST.md comparison", () => {
  const rows = section(post, "How it compares")
    .split("\n")
    .filter((line) => line.trim().startsWith("|"));

  it("copies rows that the README table also has", () => {
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(readme).toContain(row);
  });
});

describe("POST.md writing", () => {
  it("has no dashes and no marketing words", () => {
    expect(post).not.toMatch(/[\u2014\u2013]/);
    for (const word of ["seamless", "robust", "leverage", "elevate"]) {
      expect(post.toLowerCase(), word).not.toMatch(new RegExp("\\b" + word));
    }
  });

  it("keeps hyphens for package names, file names and flags only", () => {
    const prose = post.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
    const hyphenated = [...prose.matchAll(/\b[A-Za-z][A-Za-z]*-[A-Za-z][A-Za-z]*\b/g)].map(
      (m) => m[0],
    );
    expect(hyphenated).toEqual([]);
  });
});
