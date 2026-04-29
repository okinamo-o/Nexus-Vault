import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Suggestion = {
  title: string;
  slug: string;
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function commonPrefixLength(a: string, b: string) {
  const max = Math.min(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return max;
}

// Simple Levenshtein for short strings (titles + user query).
function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = new Array<number>(n + 1).fill(0);
  for (let j = 0; j <= n; j += 1) dp[j] = j;

  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

function scoreTitle(title: string, q: string) {
  const t = normalize(title);
  if (!q) return 0;

  if (t === q) return 1_000_000;

  let score = 0;
  if (t.startsWith(q)) score += 250_000;
  if (t.includes(q)) score += 80_000;

  const prefix = commonPrefixLength(t, q);
  score += prefix * 150;

  // Fuzzy: compare only the beginning window for performance.
  const window = t.slice(0, q.length + 10);
  const dist = levenshtein(window, q);
  const maxLen = Math.max(window.length, q.length);
  const normalized = Math.max(0, 1 - dist / Math.max(1, maxLen));
  score += Math.round(normalized * 50_000);

  return score;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json<Suggestion[]>([]);
  }

  const searchTerms = q.split(/\s+/).filter(Boolean);

  const candidates = await prisma.game.findMany({
    where: {
      isActive: true,
      ...(searchTerms.length > 0
        ? {
            AND: searchTerms.map((term) => ({
              title: { contains: term, mode: "insensitive" },
            })),
          }
        : {}),
    },
    select: {
      title: true,
      slug: true,
    },
    take: 30,
    orderBy: { updatedAt: "desc" },
  });

  const qNorm = normalize(q);
  const scored = candidates
    .map((g) => ({
      title: g.title,
      slug: g.slug,
      score: scoreTitle(g.title, qNorm),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const results: Suggestion[] = scored.map(({ title, slug }) => ({ title, slug }));
  return NextResponse.json(results);
}

