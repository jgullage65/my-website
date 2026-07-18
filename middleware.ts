import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Clerk will replace this closed gate. Page-level requireAdmin checks remain
  // the authoritative authorization boundary as defense in depth.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
