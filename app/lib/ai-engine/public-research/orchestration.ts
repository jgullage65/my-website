import type { BusinessIdentity, ResearchSnapshot } from "./contracts";
import { object } from "./contracts";
import { reconcileFacts } from "./reconciliation";
import type { WebsiteKnowledgeFact } from "../knowledge/websiteKnowledge";

type Event = Record<string, unknown>;
export function mergeResearchResult(
  website: Event | null,
  snapshot: ResearchSnapshot | null,
  websiteError?: unknown,
): Event {
  const imported = object(website?.import),
    knowledge = object(website?.knowledge);
  const baseline = (
    Array.isArray(knowledge.facts) ? knowledge.facts : []
  ) as WebsiteKnowledgeFact[];
  const reconciled = reconcileFacts(baseline, snapshot?.facts ?? []);
  const added = reconciled.facts.length - baseline.length,
    publicFacts = reconciled.facts.length;
  const depth = website
    ? added
      ? "website_with_supplements"
      : "full_website"
    : publicFacts
      ? "limited_public_sources"
      : "insufficient_evidence";
  const research = {
    schemaVersion: 1,
    depth,
    websiteStatus: website
      ? "complete"
      : websiteError
        ? "inaccessible"
        : "not_provided",
    ...(websiteError ? { websiteFailure: websiteError } : {}),
    supplementalStatus: snapshot ? "complete" : "unavailable",
    outcomes: snapshot?.outcomes ?? [],
    conflicts: reconciled.conflicts,
    sourceFacts: snapshot?.facts ?? [],
    coverage: snapshot?.coverage,
    pages: snapshot?.pages ?? [],
    metrics: snapshot?.metrics ?? {
      aiCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      paidRequests: 0,
    },
  };
  return {
    ...website,
    type: "result",
    ok: true,
    import: website
      ? { ...imported }
      : { businessName: snapshot?.pages[0]?.title },
    knowledge: {
      ...knowledge,
      facts: reconciled.facts,
      coverage: knowledge.coverage ?? snapshot?.coverage ?? {},
      unresolvedQuestions:
        knowledge.unresolvedQuestions ?? snapshot?.unresolvedQuestions ?? [],
    },
    research,
    pages: Array.isArray(website?.pages) ? website!.pages : [],
    sourceDocuments: [
      ...(Array.isArray(website?.sourceDocuments)
        ? website!.sourceDocuments
        : []),
      ...(snapshot?.documents ?? []),
    ],
    sourceBlocks: [
      ...(Array.isArray(website?.sourceBlocks) ? website!.sourceBlocks : []),
      ...(snapshot?.blocks ?? []),
    ],
    // Website crawl identity, diagnostics, timings and usage retain their original meaning.
    crawlAttemptId: website?.crawlAttemptId ?? snapshot?.attempt.id,
    usage: website?.usage ?? {
      model: "deterministic-only",
      aiCalls: 0,
      tokens: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    },
  };
}

/** Website terminal success is emitted before invoking the supplement. This is the publication boundary. */
export async function* independentResearchEvents(input: {
  website?: string;
  identity: BusinessIdentity | null;
  supplemental: boolean;
  websiteEvents: () => AsyncIterable<Event>;
  supplement: () => Promise<ResearchSnapshot | null>;
  signal?: AbortSignal;
}): AsyncGenerator<Event> {
  let website: Event | null = null,
    websiteError: unknown;
  if (input.website) {
    try {
      for await (const event of input.websiteEvents()) {
        if (event.type === "result") {
          website = event;
          yield event;
        } else if (event.type === "error") {
          websiteError = event.error;
          if (!input.identity || !input.supplemental) yield event;
        } else yield event;
      }
    } catch (error) {
      websiteError = {
        code: "website_stream_failed",
        message: "Website research could not be completed.",
      };
      if (!website && (!input.identity || !input.supplemental))
        yield { type: "error", error: websiteError };
    }
  }
  if (!input.identity || !input.supplemental) return;
  input.signal?.throwIfAborted();
  try {
    const snapshot = await input.supplement();
    yield mergeResearchResult(website, snapshot, websiteError);
  } catch (error) {
    if (input.signal?.aborted) return;
    if (website) {
      yield {
        ...website,
        research: {
          schemaVersion: 1,
          depth: "full_website",
          websiteStatus: "complete",
          supplementalStatus: "unavailable",
          outcomes: [],
          reason: "supplemental_research_failed",
        },
      };
    } else {
      yield {
        ...mergeResearchResult(null, null, websiteError),
        research: {
          ...object(mergeResearchResult(null, null, websiteError).research),
          reason: "supplemental_research_failed",
        },
      };
    }
  }
}
export async function* readResearchEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Event> {
  const reader = stream.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 12_000_000)
        throw new Error("research_event_too_large");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) yield JSON.parse(line);
      if (done) break;
    }
    if (buffer.trim()) yield JSON.parse(buffer);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}
export function eventResponse(
  events: AsyncIterable<Event>,
  signal?: AbortSignal,
) {
  const encoder = new TextEncoder(),
    iterator = events[Symbol.asyncIterator]();
  return new Response(
    new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          signal?.throwIfAborted();
          const next = await iterator.next();
          if (next.done) controller.close();
          else
            controller.enqueue(
              encoder.encode(JSON.stringify(next.value) + "\n"),
            );
        } catch (error) {
          controller.error(error);
          await iterator.return?.();
        }
      },
      async cancel() {
        await iterator.return?.();
      },
    }),
    {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache, no-transform",
      },
    },
  );
}
