export const RESEARCH_LIMITS = {
  requests: 10,
  candidates: 4, // discovery and evaluation maximum per adapter
  aggregateCandidates: 8,
  adapters: 4,
  totalBytes: 3_000_000,
  requestBytes: 750_000,
  durationMs: 25_000,
  requestTimeoutMs: 5000,
  redirects: 2,
  facts: 60,
} as const;
