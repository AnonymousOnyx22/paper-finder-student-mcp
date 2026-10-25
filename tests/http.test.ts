import { describe, it, expect } from "vitest";
import { createClient, ApiError } from "../src/core/http.js";

const replies = (...statuses: number[]) => {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return new Response(JSON.stringify({ ok: status === 200 }), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};

describe("createClient retry", () => {
  it("tries once more after a server error and returns the second answer", async () => {
    const { calls, fetchImpl } = replies(503, 200);
    const client = createClient({ baseUrl: "https://example.test", fetchImpl, retryDelayMs: 1 });
    expect(await client.get("/works")).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it("gives up after the second rate limit", async () => {
    const { calls, fetchImpl } = replies(429);
    const client = createClient({ baseUrl: "https://example.test", fetchImpl, retryDelayMs: 1 });
    await expect(client.get("/works")).rejects.toMatchObject({ status: 429 });
    expect(calls).toHaveLength(2);
  });

  it("does not retry a request that was wrong, like a 404", async () => {
    const { calls, fetchImpl } = replies(404, 200);
    const client = createClient({ baseUrl: "https://example.test", fetchImpl, retryDelayMs: 1 });
    await expect(client.get("/works/doi:none")).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
  });
});
