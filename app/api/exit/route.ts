import { NextRequest, NextResponse } from "next/server";

const allowedProtocols = new Set(["http:", "https:"]);

export function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url query parameter." }, { status: 400 });
  }

  let destination: URL;

  try {
    destination = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid redirect URL." }, { status: 400 });
  }

  if (!allowedProtocols.has(destination.protocol)) {
    return NextResponse.json({ error: "Unsupported URL protocol." }, { status: 400 });
  }

  const response = NextResponse.redirect(destination.toString(), 302);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
