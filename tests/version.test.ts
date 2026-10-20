import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

describe("version drift", () => {
  it("package.json, server.json and the npm registry all read 0.1.0", async () => {
    const expected = "0.1.0";

    const pkg = readJson("package.json");
    expect(pkg.version, "package.json version").toBe(expected);

    const server = readJson("server.json");
    expect(server.version, "server.json version").toBe(expected);
    expect(server.packages[0].version, "server.json packages[0].version").toBe(expected);

    const res = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`);
    expect(res.ok, `registry responded ${res.status}`).toBe(true);
    const registry = (await res.json()) as { version?: string };
    expect(registry.version, "npm registry latest version").toBe(expected);
  });
});
