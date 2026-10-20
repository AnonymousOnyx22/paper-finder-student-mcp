import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const readJson = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const parts = (v: string) => v.split(".").map(Number);
const notNewer = (a: string, b: string) => { const [x, y] = [parts(a), parts(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return true; };

describe("version drift", () => {
  it("package.json and server.json give the same version", () => {
    const pkg = readJson("package.json");
    const server = readJson("server.json");
    expect(server.version, "server.json version").toBe(pkg.version);
    expect(server.packages[0].version, "server.json packages[0].version").toBe(pkg.version);
  });

  it("npm never has a newer version than this repo", async () => {
    const pkg = readJson("package.json");
    let res: Response;
    try { res = await fetch(`https://registry.npmjs.org/${pkg.name}/latest`, { signal: AbortSignal.timeout(8000) }); } catch { return; } // offline, nothing to compare
    if (!res.ok) return;
    const latest = ((await res.json()) as { version?: string }).version;
    if (latest) expect(notNewer(latest, pkg.version), `npm has ${latest}, the repo has ${pkg.version}`).toBe(true);
  });
});
