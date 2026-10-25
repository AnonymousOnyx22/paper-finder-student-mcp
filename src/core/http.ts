/** Why a request failed: a status came back, the request ran out of time, or the connection broke. */
export type ApiErrorKind = "http" | "timeout" | "network";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
    /** What went wrong, so a caller can tell an outage from a bad request. */
    public kind: ApiErrorKind = "http",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  /** Query params added to every request (used by APIs that put the token in the URL). */
  defaultQuery?: Record<string, string>;
  timeoutMs?: number;
  /** Milliseconds to wait before the one retry. Doubles for each further try when this is raised. */
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

export type Query = Record<string, string | number | boolean | undefined | Array<string | number>>;

export interface HttpClient {
  get<T = unknown>(path: string, query?: Query): Promise<T>;
  /** Follows RFC 5988 `Link: rel="next"` pagination and concatenates array pages. */
  getAll<T = unknown>(path: string, query?: Query, maxPages?: number): Promise<T[]>;
}

function buildUrl(base: string, path: string, query: Query = {}, defaults: Record<string, string> = {}): string {
  const url = new URL(path.startsWith("http") ? path : base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, ""));
  for (const [k, v] of Object.entries(defaults)) url.searchParams.set(k, v);
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) url.searchParams.append(k, String(item));
    } else {
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (m) return m[1];
  }
  return null;
}

/** How many times one request is tried. A single retry hides a brief blip without a long wait. */
const MAX_ATTEMPTS = 2;

/** The failures a second try can hide: a rate limit, a server error or a dropped connection. */
function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.kind === "network") return true;
  return err.kind === "http" && (err.status === 429 || err.status >= 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createClient(opts: ClientOptions): HttpClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const timeout = opts.timeoutMs ?? 20000;
  const retryDelay = opts.retryDelayMs ?? 300;

  async function attempt(url: string): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await doFetch(url, {
        headers: { Accept: "application/json", ...(opts.headers ?? {}) },
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ApiError(describeStatus(res.status), res.status, body.slice(0, 500));
      }
      return res;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new ApiError(`Request timed out after ${timeout / 1000}s`, 0, undefined, "timeout");
      }
      throw new ApiError(`Network error: ${(err as Error).message}`, 0, undefined, "network");
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(url: string): Promise<Response> {
    for (let tries = 1; ; tries++) {
      try {
        return await attempt(url);
      } catch (err) {
        if (tries >= MAX_ATTEMPTS || !isRetryable(err)) throw err;
        await sleep(retryDelay * 2 ** (tries - 1));
      }
    }
  }

  return {
    async get<T>(path: string, query?: Query): Promise<T> {
      const res = await request(buildUrl(opts.baseUrl, path, query, opts.defaultQuery));
      return (await res.json()) as T;
    },
    async getAll<T>(path: string, query?: Query, maxPages = 10): Promise<T[]> {
      const out: T[] = [];
      let url: string | null = buildUrl(opts.baseUrl, path, query, opts.defaultQuery);
      for (let page = 0; url && page < maxPages; page++) {
        const res: Response = await request(url);
        const data = (await res.json()) as T | T[];
        if (Array.isArray(data)) out.push(...data);
        else out.push(data);
        url = nextLink(res.headers.get("link"));
      }
      return out;
    },
  };
}

export function describeStatus(status: number): string {
  switch (status) {
    case 401:
      return "Not authorized. The service refused the request.";
    case 403:
      return "Access denied.";
    case 404:
      return "Not found. Check the DOI, ISBN or ID you gave.";
    case 429:
      return "Rate limited by the service. Wait a minute and try again.";
    default:
      return status >= 500 ? `The service had a problem (HTTP ${status}). Try again shortly.` : `Request failed (HTTP ${status}).`;
  }
}
