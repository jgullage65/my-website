import { clerkMiddleware } from "@clerk/nextjs/server";

function isProtectedRoute(pathname: string): boolean {
  return ["/ai-builder", "/api/ai-builder", "/admin"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request.nextUrl.pathname)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
