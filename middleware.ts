import { NextResponse, type NextRequest } from "next/server";

function unauthorizedResponse() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Nexus Vault Admin", charset="UTF-8"',
    },
  });
}

function decodeBasicAuthHeader(headerValue: string): { username: string; password: string } | null {
  if (!headerValue.startsWith("Basic ")) return null;

  const encoded = headerValue.slice(6).trim();
  if (!encoded) return null;

  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  // Fail closed when credentials are not configured in deployment.
  if (!expectedUsername || !expectedPassword) {
    return new NextResponse("Admin credentials are not configured.", { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return unauthorizedResponse();

  const credentials = decodeBasicAuthHeader(authHeader);
  if (!credentials) return unauthorizedResponse();

  const isValidUser = credentials.username === expectedUsername;
  const isValidPassword = credentials.password === expectedPassword;
  if (!isValidUser || !isValidPassword) return unauthorizedResponse();

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
