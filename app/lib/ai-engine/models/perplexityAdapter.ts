import type { ModelDefinition } from "./registry";

export type NormalizedUsage = { inputTokens: number; outputTokens: number; totalTokens: number };
export type ModelCompletionStatus = "completed" | "incomplete";
export type ModelExecutionCategory = "configuration" | "timeout" | "aborted" | "authentication" | "rate_limit" | "availability" | "provider";

export class ModelExecutionError extends Error {
  readonly category: ModelExecutionCategory;
  readonly status: number | null;
  readonly providerCode: string | null;
  readonly requestId: string | null;
  readonly providerMessage: string | null;

  constructor(
    category: ModelExecutionCategory,
    message = "model_execution_failed",
    details: {
      status?: number | null;
      providerCode?: string | null;
      requestId?: string | null;
      providerMessage?: string | null;
    } = {},
  ) {
    super(message);
    this.name = "ModelExecutionError";
    this.category = category;
    this.status = details.status ?? null;
    this.providerCode = details.providerCode ?? null;
    this.requestId = details.requestId ?? null;
    this.providerMessage = details.providerMessage ?? null;
  }
}

export type AdapterInput = {
  model: ModelDefinition;
  messages: { role: "user" | "assistant"; content: string }[];
  instructions?: string;
  signal?: AbortSignal;
  timeoutMs: number;
};

function readProviderError(value: unknown): { code: string | null; message: string | null } {
  if (!value || typeof value !== "object") return { code: null, message: null };
  const body = value as { error?: { code?: unknown; message?: unknown }; code?: unknown; message?: unknown };
  const code = body.error?.code ?? body.code;
  const message = body.error?.message ?? body.message;
  return {
    code: typeof code === "string" ? code : null,
    message: typeof message === "string" ? message.slice(0, 500) : null,
  };
}

export async function runPerplexity(input: AdapterInput) {
  const key = process.env.PERPLEXITY_API_KEY?.trim();
  if (!key) throw new ModelExecutionError("configuration", "model_gateway_not_configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), input.timeoutMs);
  const abort = () => controller.abort("aborted");
  input.signal?.addEventListener("abort", abort, { once: true });
  const started = performance.now();

  try {
    const response = await fetch("https://api.perplexity.ai/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: input.model.gatewayModelId, instructions: input.instructions, input: input.messages }),
      signal: controller.signal,
    });
    const requestId = response.headers.get("x-request-id");

    if (!response.ok) {
      let body: unknown;
      try { body = await response.json(); } catch { body = null; }
      const providerError = readProviderError(body);
      throw new ModelExecutionError(
        response.status === 401 || response.status === 403
          ? "authentication"
          : response.status === 429
            ? "rate_limit"
            : response.status >= 500
              ? "availability"
              : "provider",
        "model_execution_failed",
        {
          status: response.status,
          providerCode: providerError.code,
          requestId,
          providerMessage: providerError.message,
        },
      );
    }

    const value = await response.json() as any;
    const incompleteReason = typeof value.incomplete_details?.reason === "string" ? value.incomplete_details.reason : null;
    const status: ModelCompletionStatus = value.status === "incomplete" || incompleteReason ? "incomplete" : "completed";
    const text = String(value.output_text ?? value.output?.flatMap((x: any) => x.content ?? []).map((x: any) => x.text ?? "").join("") ?? "").trim();
    if (!text && status === "completed") {
      throw new ModelExecutionError("provider", "model_output_empty", { requestId: requestId ?? (String(value.id ?? "") || null) });
    }
    const raw = value.usage ?? {};
    const usage = {
      inputTokens: Number(raw.input_tokens ?? 0),
      outputTokens: Number(raw.output_tokens ?? 0),
      totalTokens: Number(raw.total_tokens ?? Number(raw.input_tokens ?? 0) + Number(raw.output_tokens ?? 0)),
    };
    return {
      text,
      usage,
      status,
      incompleteReason,
      requestId: requestId ?? (String(value.id ?? "") || null),
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (error instanceof ModelExecutionError) throw error;
    if (controller.signal.aborted) throw new ModelExecutionError(input.signal?.aborted ? "aborted" : "timeout");
    throw new ModelExecutionError("provider", "model_execution_failed", {
      providerMessage: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    });
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abort);
  }
}
