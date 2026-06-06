import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block /dev/* in production
  if (
    (pathname.startsWith("/dev/") || pathname.startsWith("/api/dev/")) &&
    process.env.NODE_ENV !== "development"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  // Channel guard: redirect to /dashboard/channels if no channel selected
  if (pathname.startsWith("/dashboard/") && pathname !== "/dashboard/channels") {
    const channelId = request.cookies.get("cg_channel_id")?.value;
    if (!channelId) {
      return NextResponse.redirect(new URL("/dashboard/channels", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dev/:path*", "/api/dev/:path*", "/dashboard/:path*"],
};
