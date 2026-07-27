import assert from "node:assert/strict";
import test from "node:test";
import { applyCrawlEvent, configuredCrawlEndpoint, consumeCrawlEvents, TerminalCrawlWorkerError } from "./crawlJobProcessor";

const stream = (...chunks: string[]) => new ReadableStream<Uint8Array>({
  start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); },
});

test("anchors the authenticated crawl endpoint to the configured trusted origin", () => {
  assert.equal(configuredCrawlEndpoint("https://builder.example.test").toString(), "https://builder.example.test/api/ai-builder/crawl");
  assert.equal(configuredCrawlEndpoint("http://localhost:3000").toString(), "http://localhost:3000/api/ai-builder/crawl");
  assert.equal(configuredCrawlEndpoint("http://[::1]:3000").toString(), "http://[::1]:3000/api/ai-builder/crawl");
  assert.throws(() => configuredCrawlEndpoint(undefined), /is required/);
  assert.throws(() => configuredCrawlEndpoint("http://external.example.test"), /must use HTTPS/);
  assert.throws(() => configuredCrawlEndpoint("https://user:secret@example.test/path?token=secret"), /must be an origin/);
});

test("consumes fragmented NDJSON and a final event without a newline", async () => {
  const events: Record<string, unknown>[] = [];
  await consumeCrawlEvents(stream('{"type":"crawl_', 'progress","pagesCrawled":1}\n{"type":"result"}'), async (event) => { events.push(event); });
  assert.deepEqual(events, [{ type:"crawl_progress", pagesCrawled:1 }, { type:"result" }]);
});

test("rejects malformed and oversized worker events", async () => {
  await assert.rejects(consumeCrawlEvents(stream("not-json\n"), async () => undefined), SyntaxError);
  await assert.rejects(consumeCrawlEvents(stream(JSON.stringify({ type:"result", value:"x".repeat(200) })), async () => undefined, 100), /oversized event/);
});

test("maps worker events to monotonic job transitions and terminal errors", async () => {
  const progress: Record<string, unknown>[] = [];
  const update = async (value: Record<string, unknown>) => { progress.push(value); };
  assert.equal(await applyCrawlEvent({type:"crawl_progress",pagesCrawled:2,pagesDiscovered:4},update),null);
  assert.equal(await applyCrawlEvent({type:"crawl_complete",pagesCrawled:3,pagesDiscovered:5},update),null);
  assert.equal(await applyCrawlEvent({type:"progress",percent:80},update),null);
  const result={type:"result",ok:true};
  assert.equal(await applyCrawlEvent(result,update),result);
  await assert.rejects(applyCrawlEvent({type:"error",error:{message:"invalid website"}},update),TerminalCrawlWorkerError);
  assert.deepEqual(progress,[
    {state:"crawling",pagesCrawled:2,pagesDiscovered:4},
    {state:"processing",pagesCrawled:3,pagesDiscovered:5,crawlComplete:true,processingPercent:70},
    {state:"processing",processingPercent:80},
  ]);
});
