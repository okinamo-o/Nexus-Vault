import { NextResponse } from "next/server";

import { incrementVisitorCounter } from "@/lib/visitor-counter";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await incrementVisitorCounter();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

