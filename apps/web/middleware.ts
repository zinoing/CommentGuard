// DEV ONLY — remove before GA
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Block /dev/* entirely in production
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dev/:path*", "/api/dev/:path*"],
};
