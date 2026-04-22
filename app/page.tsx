import type { Metadata } from "next";
import { Search } from "lucide-react";

import { GameCard } from "@/components/game-card";
import { SiteLogo } from "@/components/site-logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Nexus Vault",
  description: "The Definitive Digital Archive.",
};

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: {
    q?: string;
  };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const rawQuery = searchParams?.q;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";

  const games = await prisma.game.findMany({
    where: {
      isActive: true,
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
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 60,
  });

  return (
    <main className="min-h-screen">
      <section className="container py-12 md:py-16">
        <div className="mb-8 flex flex-col gap-6 md:mb-10">
          <div className="flex items-center gap-4">
            <SiteLogo className="h-12 w-12" />
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Nexus Vault
              </h1>
              <p className="text-muted-foreground">The Definitive Digital Archive.</p>
            </div>
          </div>

          <form
            method="GET"
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/80 p-4 backdrop-blur md:flex-row md:items-center"
          >
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
            <Button type="submit">Search Archive</Button>
          </form>
        </div>

        {games.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-8 text-center">
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
