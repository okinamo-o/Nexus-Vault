import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_WWW_AUTHENTICATE, verifyAdminAuthorization } from "@/lib/admin-auth";

export function middleware(request: NextRequest) {
  const authResult = verifyAdminAuthorization(request.headers.get("authorization"));

  if (!authResult.ok) {
    if (authResult.status === 503) {
      return new NextResponse(authResult.message, { status: 503 });
    }
    return new NextResponse(authResult.message, {
      status: 401,
      headers: {
        "WWW-Authenticate": ADMIN_WWW_AUTHENTICATE,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
