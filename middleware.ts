import { clerkMiddleware } from "@clerk/nextjs/server";

function isProtectedRoute(pathname: string): boolean {
  return ["/api/ai-builder", "/admin"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default clerkMiddleware(async (auth, request) => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const internalCrawlWorker = (request.nextUrl.pathname === "/api/ai-builder/crawl" || request.nextUrl.pathname === "/api/ai-builder/crawl/jobs/process")
    && Boolean(cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`);
  if (internalCrawlWorker) return;
  if (isProtectedRoute(request.nextUrl.pathname)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
