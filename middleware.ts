import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const PUBLIC_ARKENA_ROUTES = new Set([
  "/",
  "/brain-builder",
  "/contact",
]);

const BRAIN_BUILDER_PAGES = new Set([
  "dashboard",
  "insights",
  "overview",
  "sources",
  "settings",
]);

function isProtectedRoute(pathname: string): boolean {
  return ["/api/ai-builder", "/admin"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAllowedPublicRoute(pathname: string): boolean {
  if (PUBLIC_ARKENA_ROUTES.has(pathname)) return true;
  if (pathname.startsWith("/brain-builder/")) return true;
  return false;
}

function legacyAiBuilderRedirect(request: Request): NextResponse | null {
  const requestUrl = new URL(request.url);
  const { pathname, searchParams } = requestUrl;

  if (pathname === "/ai-builder/projects") {
    requestUrl.pathname = "/brain-builder/projects";
    requestUrl.search = "";
    return NextResponse.redirect(requestUrl);
  }

  if (pathname === "/ai-builder/review") {
    const projectId = searchParams.get("projectId")?.trim();
    requestUrl.pathname = projectId
      ? `/brain-builder/review/${encodeURIComponent(projectId)}`
      : "/brain-builder";
    requestUrl.search = "";
    return NextResponse.redirect(requestUrl);
  }

  if (pathname !== "/ai-builder") return null;

  if (searchParams.get("new")) {
    requestUrl.pathname = "/brain-builder/new";
    requestUrl.search = "";
    return NextResponse.redirect(requestUrl);
  }

  const projectId = searchParams.get("projectId")?.trim();
  if (projectId) {
    if (searchParams.get("review") === "1" || searchParams.get("review") === "true") {
      requestUrl.pathname = `/brain-builder/review/${encodeURIComponent(projectId)}`;
    } else {
      const requestedTab = searchParams.get("tab")?.trim() || "dashboard";
      const page = BRAIN_BUILDER_PAGES.has(requestedTab)
        ? requestedTab
        : "dashboard";
      requestUrl.pathname = `/brain-builder/${page}/${encodeURIComponent(projectId)}`;
    }
    requestUrl.search = "";
    return NextResponse.redirect(requestUrl);
  }

  requestUrl.pathname = "/brain-builder";
  requestUrl.search = "";
  return NextResponse.redirect(requestUrl);
}

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  const publicDemoApi = pathname === "/api/ai-builder/public-demo/crawl";
  const cronSecret = process.env.CRON_SECRET?.trim();
  const internalCrawlWorker =
    (pathname === "/api/ai-builder/crawl" ||
      pathname === "/api/ai-builder/crawl/jobs/process") &&
    Boolean(
      cronSecret &&
        request.headers.get("authorization") === `Bearer ${cronSecret}`,
    );

  if (internalCrawlWorker) return;

  if (pathname.startsWith("/api/")) {
    if (isProtectedRoute(pathname) && !publicDemoApi) await auth.protect();
    return;
  }

  const legacyRedirect = legacyAiBuilderRedirect(request);
  if (legacyRedirect) return legacyRedirect;

  if (!isAllowedPublicRoute(pathname) && !pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/brain-builder";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isProtectedRoute(pathname)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
