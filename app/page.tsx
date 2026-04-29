import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";

import { GameCard } from "@/components/game-card";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchSuggestionsInput } from "@/components/search-suggestions-input";
import { HomeSearchFilters } from "@/components/home-search-filters";
import { prisma } from "@/lib/prisma";
import { incrementVisitorCounter } from "@/lib/visitor-counter";
import AdBanner from "@/components/ad-banner";

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
  const searchTerms = query.split(/\s+/).filter(Boolean);
  const sort = typeof searchParams?.sort === "string" ? searchParams.sort : "newest";
  const requireSpecs = searchParams?.req === "1";
  const requireMirrors = searchParams?.mirrors === "1";

  const baseWhere = {
    isActive: true,
    ...(requireSpecs ? { requirements: { not: null } } : {}),
    ...(requireMirrors ? { downloadLinks: { some: {} } } : {}),
    ...(searchTerms.length > 0
      ? {
          AND: searchTerms.map((term) => ({
            OR: [
              { title: { contains: term, mode: "insensitive" as const } },
              { description: { contains: term, mode: "insensitive" as const } },
            ],
          })),
        }
      : {}),
  };

  const [totalMatched, games, topCharts, updatesFeed] = await Promise.all([
    prisma.game.count({ where: baseWhere }),
    prisma.game.findMany({
      where: baseWhere,
      orderBy:
        sort === "az"
          ? { title: "asc" }
          : sort === "updated"
          ? { updatedAt: "desc" }
          : sort === "mirrors"
          ? { downloadLinks: { _count: "desc" } }
          : { createdAt: "desc" },
      take: 60,
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
          select: { downloadLinks: true },
        },
      },
    }),
    prisma.game.findMany({
      where: baseWhere,
      orderBy: [
        { downloadLinks: { _count: "desc" } },
        { updatedAt: "desc" },
      ],
      take: 6,
      select: {
        id: true,
        title: true,
        slug: true,
        _count: {
          select: { downloadLinks: true },
        },
      },
    }),
    prisma.game.findMany({
      where: baseWhere,
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        slug: true,
        updatedAt: true,
      },
    }),
  ]);

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
                <SearchSuggestionsInput initialValue={query} />
              </div>
              <Button type="submit" className="md:min-w-44">
                Search Archive
              </Button>
              </div>
              <HomeSearchFilters
                currentSort={sort}
                requireSpecs={requireSpecs}
                requireMirrors={requireMirrors}
              />
            </form>
          </div>
          <AdBanner />
        </div>

        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-foreground md:text-2xl">
            Fresh Drops
          </h2>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {games.length} entries{totalMatched !== games.length ? ` / ${totalMatched}` : ""}
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
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm hover:border-primary/50"
                >
                  <span className="line-clamp-1 flex-1 min-w-0">
                    <span className="mr-2 text-muted-foreground">#{index + 1}</span>
                    {game.title}
                  </span>
                  <Badge variant="outline" className="shrink-0 whitespace-nowrap">
                    {game._count.downloadLinks} mirrors
                  </Badge>
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
