type CachedProjectResponse = {
  body: string;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
};

const projectResponseCache = new Map<string, CachedProjectResponse>();
let installed = false;
let originalFetch: typeof window.fetch | null = null;

function projectIdFromRequest(input: RequestInfo | URL, init?: RequestInit): string | null {
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (method.toUpperCase() !== "GET") return null;

  const rawUrl =
    input instanceof Request
      ? input.url
      : input instanceof URL
        ? input.toString()
        : input;
  const url = new URL(rawUrl, window.location.origin);
  if (url.origin !== window.location.origin) return null;

  const match = url.pathname.match(/^\/api\/ai-builder\/projects\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function installProjectResponseCache() {
  if (installed || typeof window === "undefined") return;

  installed = true;
  originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const projectId = projectIdFromRequest(input, init);
    const cached = projectId ? projectResponseCache.get(projectId) : undefined;

    if (projectId && cached) {
      projectResponseCache.delete(projectId);
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
      });
    }

    return originalFetch!(input, init);
  };
}

export async function warmAiBuilderProjectResponse(projectId: string): Promise<void> {
  if (typeof window === "undefined" || !projectId) return;
  installProjectResponseCache();
  if (projectResponseCache.has(projectId)) return;

  const response = await originalFetch!(
    `/api/ai-builder/projects/${encodeURIComponent(projectId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return;

  projectResponseCache.set(projectId, {
    body: await response.text(),
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()),
  });
}
