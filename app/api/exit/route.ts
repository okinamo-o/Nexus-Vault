import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export async function GET(request: NextRequest) {
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

  if (!ALLOWED_PROTOCOLS.has(destination.protocol)) {
    return NextResponse.json({ error: "Unsupported URL protocol." }, { status: 400 });
  }

  const normalizedUrl = destination.toString();
  const candidates = rawUrl === normalizedUrl ? [rawUrl] : [rawUrl, normalizedUrl];

  // Prevent open-redirect abuse by allowing only mirrors stored in DownloadLink.
  const archivedMirror = await prisma.downloadLink.findFirst({
    where: {
      url: { in: candidates },
      game: { isActive: true },
    },
    select: { id: true, url: true },
  });

  if (!archivedMirror) {
    return NextResponse.json(
      { error: "Redirect target is not an archived mirror." },
      { status: 403 }
    );
  }

  const response = NextResponse.redirect(archivedMirror.url, 302);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
