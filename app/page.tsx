import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";

import { GameCard } from "@/components/game-card";
import { SiteLogo } from "@/components/site-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { incrementVisitorCounter } from "@/lib/visitor-counter";

export const metadata: Metadata = {
  title: "Nexus Vault",
  description: "The Definitive Digital Archive.",
};

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: {
    q?: string;
    sort?: string;
    req?: string;
    mirrors?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  await incrementVisitorCounter();

  const rawQuery = searchParams?.q;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const sort = typeof searchParams?.sort === "string" ? searchParams.sort : "newest";
  const requireSpecs = searchParams?.req === "1";
  const requireMirrors = searchParams?.mirrors === "1";

  const allGames = await prisma.game.findMany({
    where: {
      isActive: true,
      ...(requireSpecs ? { requirements: { not: null } } : {}),
      ...(requireMirrors ? { downloadLinks: { some: {} } } : {}),
      ...(query
        ? {
            OR: [{ title: { contains: query } }, { description: { contains: query } }],
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      imagePath: true,
      requirements: true,
      updatedAt: true,
      createdAt: true,
      _count: {
        select: {
          downloadLinks: true,
        },
      },
    },
  });

  const games = [...allGames]
    .sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "updated") return b.updatedAt.getTime() - a.updatedAt.getTime();
      if (sort === "mirrors") return b._count.downloadLinks - a._count.downloadLinks;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 60);

  const topCharts = [...allGames]
    .sort((a, b) => {
      const scoreA = a._count.downloadLinks * 5 + (a.updatedAt.getTime() - a.createdAt.getTime()) / 86_400_000;
      const scoreB = b._count.downloadLinks * 5 + (b.updatedAt.getTime() - b.createdAt.getTime()) / 86_400_000;
      return scoreB - scoreA;
    })
    .slice(0, 6);

  const updatesFeed = [...allGames]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 8);

  return (
    <main className="min-h-screen pb-10">
      <section className="container py-10 md:py-14">
        <div className="mb-8 space-y-6 md:mb-10">
          <div className="gaming-surface surface-grid relative overflow-hidden rounded-3xl p-6 md:p-8">
            <div className="absolute -top-20 right-0 h-44 w-44 rounded-full bg-accent/30 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-primary/30 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <SiteLogo className="h-12 w-12" />
                <div>
                  <h1 className="font-heading text-3xl font-bold tracking-tight md:text-5xl">
                    <span className="text-gradient-vibrant">Nexus Vault</span>
                  </h1>
                  <p className="mt-2 max-w-xl text-sm text-slate-300 md:text-base">
                    Explore the latest additions to the archive with a faster, cleaner discovery flow.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="gaming-surface rounded-2xl p-4">
            <form method="GET" className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label htmlFor="q" className="sr-only">
                Search games
              </label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="q"
                  name="q"
                  defaultValue={query}
                  placeholder="Search by title or description..."
                  className="pl-9"
                />
              </div>
              <Button type="submit" className="md:min-w-44">
                Search Archive
              </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  name="sort"
                  defaultValue={sort}
                  className="h-11 rounded-xl border border-input/80 bg-background/55 px-3 text-sm text-foreground"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="updated">Sort: Recently Updated</option>
                  <option value="mirrors">Sort: Most Mirrors</option>
                  <option value="az">Sort: A-Z</option>
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-input/70 bg-background/45 px-3 text-sm">
                  <input type="checkbox" name="req" value="1" defaultChecked={requireSpecs} />
                  Specs only
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-input/70 bg-background/45 px-3 text-sm">
                  <input type="checkbox" name="mirrors" value="1" defaultChecked={requireMirrors} />
                  Mirrors only
                </label>
              </div>
            </form>
          </div>
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-foreground md:text-2xl">
            Fresh Drops
          </h2>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {games.length} entries
          </p>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <Card className="gaming-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Charts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topCharts.map((game, index) => (
                <Link
                  key={game.id}
                  href={`/game/${game.slug}`}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm hover:border-primary/50"
                >
                  <span className="line-clamp-1">
                    <span className="mr-2 text-muted-foreground">#{index + 1}</span>
                    {game.title}
                  </span>
                  <Badge variant="outline">{game._count.downloadLinks} mirrors</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="gaming-surface lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">New Updates Feed</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {updatesFeed.map((game) => (
                <Link
                  key={game.id}
                  href={`/game/${game.slug}`}
                  className="rounded-lg border border-border/50 px-3 py-2 hover:border-accent/60"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-slate-100">{game.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(game.updatedAt)}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {games.length === 0 ? (
          <div className="gaming-surface rounded-2xl border-dashed p-8 text-center">
            <p className="font-heading text-xl text-foreground">No games found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {query
                ? "Try a different search term or run the ingestion pipeline to refresh data."
                : "The archive is currently empty. Run the scraper pipeline to populate data."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
