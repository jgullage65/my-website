import { requestSafeDestination } from "../crawler/crawlBusinessWebsite";
import { policyRejection, restrictedContent, robotsDecision } from "./policy";
import type { SourcePolicy } from "./contracts";

function combineSignals(signals: AbortSignal[]): AbortSignal {
  return (
    AbortSignal as typeof AbortSignal & {
      any(signals: AbortSignal[]): AbortSignal;
    }
  ).any(signals);
}
import { RESEARCH_LIMITS } from "./limits";
export { RESEARCH_LIMITS } from "./limits";
type WireResponse = Awaited<ReturnType<typeof requestSafeDestination>>;
export type ResearchTransport = (
  url: URL,
  options: { signal: AbortSignal; headers: Record<string, string> },
) => Promise<WireResponse>;
export type SlotLease = { release(): Promise<void> };
export type Slot = (host: string, interval: number) => Promise<boolean | SlotLease>;
export class ResearchSkip extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}
const slots = new Map<string, { next: number; active: boolean }>();
export const localSlot: Slot = async (host, interval) => {
  const now = Date.now();
  const prior = slots.get(host);
  if (prior?.active || (prior?.next ?? 0) > now) return false;
  const lease = { next: now + interval, active: true };
  slots.set(host, lease);
  return { release: async () => { lease.active = false; } };
};
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(new ResearchSkip("cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
export class ResearchFetcher {
  readonly metrics = { requests: 0, bytes: 0 };
  readonly signal: AbortSignal;
  private requestCeiling: number = RESEARCH_LIMITS.requests;
  private scopeSignal?: AbortSignal;
  async withinRequestBudget<T>(allowance: number, work: () => Promise<T>, durationMs: number = RESEARCH_LIMITS.durationMs): Promise<T> {
    const priorSignal = this.scopeSignal;
    this.scopeSignal = combineSignals([this.signal, ...(priorSignal ? [priorSignal] : []), AbortSignal.timeout(Math.max(1, Math.floor(durationMs)))]);
    const previous = this.requestCeiling;
    this.requestCeiling = Math.min(previous, this.metrics.requests + Math.max(0, allowance));
    try { return await work(); } finally { this.requestCeiling = previous; this.scopeSignal = priorSignal; }
  }
  private readonly robots = new Map<string, string>();
  private readonly seen = new Set<string>();
  private readonly hostRequests = new Map<string, number>();
  constructor(
    signal?: AbortSignal,
    private wire: ResearchTransport = requestSafeDestination,
    private slot: Slot = localSlot,
  ) {
    this.signal = signal
      ? combineSignals([
          signal,
          AbortSignal.timeout(RESEARCH_LIMITS.durationMs),
        ])
      : AbortSignal.timeout(RESEARCH_LIMITS.durationMs);
  }
  private async request(
    url: URL,
    policy: SourcePolicy,
    headers: Record<string, string> = {},
    interval = policy.minIntervalMs,
  ) {
    (this.scopeSignal ?? this.signal).throwIfAborted();
    if (
      this.metrics.requests >= RESEARCH_LIMITS.requests ||
      this.metrics.bytes >= RESEARCH_LIMITS.totalBytes
    )
      throw new ResearchSkip("aggregate_budget_exhausted");
    if (this.metrics.requests >= this.requestCeiling) throw new ResearchSkip("adapter_request_budget_exhausted");
    if ((this.hostRequests.get(url.host) ?? 0) >= 7)
      throw new ResearchSkip("domain_request_budget_exhausted");
    // Slot is shared across server instances in production. No in-request retry of denied/rate-limited responses.
    let lease: boolean | SlotLease;
    for (let tries = 0; !(lease = await this.slot(url.host, interval)); tries++) {
      if (tries >= 6) throw new ResearchSkip("domain_busy");
      await wait(Math.min(interval, 2000), this.scopeSignal ?? this.signal);
    }
    this.metrics.requests++;
    this.hostRequests.set(url.host, (this.hostRequests.get(url.host) ?? 0) + 1);
    const signal = combineSignals([
      this.scopeSignal ?? this.signal,
      AbortSignal.timeout(RESEARCH_LIMITS.requestTimeoutMs),
    ]);
    try {
    const response = await this.wire(url, {
      signal,
      headers: {
        "user-agent": "BusinessResearchBot/1.0 (+https://leadforgeapp.net)",
        accept:
          "application/json, text/html, application/pdf;q=0.8, text/plain;q=0.5",
        ...headers,
      },
    });
    // Never send cookies, credentials or authorization. Redirects are handled by this class, not the transport.
    const reader = response.body.getReader();
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    const cancel = () => {
      void reader.cancel().catch(() => undefined);
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      if (
        Number(response.headers.get("content-length")) >
        Math.min(policy.maxBytes, RESEARCH_LIMITS.requestBytes)
      )
        throw new ResearchSkip("response_too_large");
      while (true) {
        signal.throwIfAborted();
        const { value, done } = await reader.read();
        signal.throwIfAborted();
        if (done) break;
        bytes += value.byteLength;
        this.metrics.bytes += value.byteLength;
        if (
          bytes > Math.min(policy.maxBytes, RESEARCH_LIMITS.requestBytes) ||
          this.metrics.bytes > RESEARCH_LIMITS.totalBytes
        )
          throw new ResearchSkip("response_too_large");
        chunks.push(value);
      }
    } finally {
      signal.removeEventListener("abort", cancel);
      await reader.cancel().catch(() => undefined);
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    return {
      status: response.status,
      headers: response.headers,
      bytes: buffer,
      text: new TextDecoder().decode(buffer),
    };
    } finally {
      if (typeof lease === "object") await lease.release();
    }
  }
  async get(
    input: string,
    policy: SourcePolicy,
    conditional: Record<string, string> = {},
  ) {
    let url = new URL(input);
    const chain: string[] = [];
    if (this.seen.has(url.href)) throw new ResearchSkip("duplicate_request");
    this.seen.add(url.href);
    for (let hop = 0; hop <= RESEARCH_LIMITS.redirects; hop++) {
      const rejection = policyRejection(url, policy);
      if (rejection) throw new ResearchSkip(rejection);
      if (!this.robots.has(url.origin)) {
        const robots = await this.request(new URL("/robots.txt", url), policy);
        if (robots.status === 404) this.robots.set(url.origin, "");
        else if (robots.status === 200 && !/<html/i.test(robots.text))
          this.robots.set(url.origin, robots.text);
        else throw new ResearchSkip("robots_unavailable");
      }
      const robot = robotsDecision(this.robots.get(url.origin)!, url);
      if (!robot.allowed) throw new ResearchSkip("robots_disallowed");
      if (robot.delayMs > RESEARCH_LIMITS.durationMs)
        throw new ResearchSkip("crawl_delay_exceeds_budget");
      const response = await this.request(
        url,
        policy,
        conditional,
        Math.max(policy.minIntervalMs, robot.delayMs),
      );
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (hop === RESEARCH_LIMITS.redirects)
          throw new ResearchSkip("redirect_limit");
        const location = response.headers.get("location");
        if (!location) throw new ResearchSkip("invalid_redirect");
        chain.push(url.href);
        url = new URL(location, url);
        continue;
      }
      if ([401, 403, 407].includes(response.status))
        throw new ResearchSkip("authentication_or_access_denied");
      if (response.status === 429 || response.status === 503)
        throw new ResearchSkip("rate_limited_backoff");
      if (response.status === 304) return { ...response, url: url.href, chain };
      if (response.status !== 200)
        throw new ResearchSkip("source_http_" + response.status);
      const contentType = response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim();
      if (
        ![
          "application/json",
          "application/vnd.api+json",
          "text/html",
          "application/pdf",
          "text/plain",
          "application/xml",
          "text/xml",
        ].includes(contentType ?? "")
      )
        throw new ResearchSkip("unsupported_content_type");
      const restriction = restrictedContent(response.headers, response.text);
      if (restriction) throw new ResearchSkip(restriction);
      return { ...response, url: url.href, chain };
    }
    throw new ResearchSkip("redirect_limit");
  }
}
