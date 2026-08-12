import { timingSafeEqual } from "node:crypto";
import { runBusinessWebsiteResearchRequest } from "@/app/lib/ai-engine/research/businessKnowledgePack";
import { normalizeExternalReference, toLeadForgeEvent, type LeadForgeResearchRequest } from "./contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function authorized(request: Request): boolean {
  const secret = process.env.LEADFORGE_RESEARCH_API_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  const supplied = authorization.slice("Bearer ".length);
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ success: false, status: "failed", error: { code, message } }, { status });
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<Record<string, unknown>[]> {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  const events: Record<string, unknown>[] = [];
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += value ?? "";
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) events.push(JSON.parse(line));
    if (done) break;
  }
  if (buffer.trim()) events.push(JSON.parse(buffer));
  return events;
}

function transformEventStream(source: ReadableStream<Uint8Array>, externalReference?: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) controller.enqueue(encoder.encode(`${JSON.stringify(toLeadForgeEvent(JSON.parse(line), externalReference))}\n`));
          if (done) break;
        }
        buffer += decoder.decode();
        if (buffer.trim()) controller.enqueue(encoder.encode(`${JSON.stringify(toLeadForgeEvent(JSON.parse(buffer), externalReference))}\n`));
        controller.close();
      } catch (error) { controller.error(error); }
    },
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) return jsonError(401, "unauthorized", "A valid LeadForge internal bearer token is required.");

  let body: LeadForgeResearchRequest;
  try { body = await request.json() as LeadForgeResearchRequest; }
  catch { return jsonError(400, "invalid_json", "The request body must be valid JSON."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return jsonError(400, "invalid_request", "The request body must be a JSON object.");

  let externalReference: string | undefined;
  try { externalReference = normalizeExternalReference(body.externalReference); }
  catch { return jsonError(400, "external_reference_invalid", "externalReference must be a non-empty string of at most 200 characters."); }

  const coreRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ website: body.website, modelId: body.modelId }),
    signal: request.signal,
  });
  const coreResponse = await runBusinessWebsiteResearchRequest(coreRequest, { internalWorker: true });
  if (!coreResponse.ok) {
    let error: unknown = { code: "research_request_failed", message: "Website research could not be started." };
    try {
      const payload = await coreResponse.json() as { error?: unknown };
      if (payload.error) error = payload.error;
    } catch { /* Keep the stable, non-sensitive fallback. */ }
    return Response.json({ success: false, status: "failed", externalReference, error }, { status: coreResponse.status });
  }
  if (!coreResponse.body) return jsonError(500, "research_incomplete", "Website research ended without a response stream.");

  const streaming = new URL(request.url).searchParams.get("stream") === "true";
  if (streaming) return new Response(transformEventStream(coreResponse.body, externalReference), { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache, no-transform" } });

  try {
    const events = await readEvents(coreResponse.body);
    const terminal = [...events].reverse().find((event) => event.type === "result" || event.type === "error");
    if (!terminal) return jsonError(500, "research_incomplete", "Website research ended without a result.");
    const response = toLeadForgeEvent(terminal, externalReference);
    return Response.json(response, { status: terminal.type === "result" ? 200 : 422 });
  } catch (error) {
    console.error("LEADFORGE_RESEARCH_RESPONSE_FAILED", { message: error instanceof Error ? error.message : String(error) });
    return jsonError(500, "internal_error", "Website research could not be completed.");
  }
}
