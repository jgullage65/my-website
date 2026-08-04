import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const PUBLIC_ARKENA_ROUTES = new Set([
  "/",
  "/ai-builder",
  "/contact",
]);

function isProtectedRoute(pathname: string): boolean {
  return ["/api/ai-builder", "/admin"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isAllowedPublicRoute(pathname: string): boolean {
  if (PUBLIC_ARKENA_ROUTES.has(pathname)) return true;
  if (pathname.startsWith("/ai-builder/")) return true;
  return false;
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

  if (!isAllowedPublicRoute(pathname) && !pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = "/ai-builder";
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
