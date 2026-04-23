import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getVisitorCounter } from "@/lib/visitor-counter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Ops",
  description: "Nexus Vault operations dashboard.",
};

async function updateGameState(formData: FormData) {
  "use server";

  const gameId = Number(formData.get("gameId"));
  const action = String(formData.get("action"));
  if (!Number.isFinite(gameId)) return;

  if (action === "activate") {
    await prisma.game.update({ where: { id: gameId }, data: { isActive: true } });
  } else if (action === "deactivate") {
    await prisma.game.update({ where: { id: gameId }, data: { isActive: false } });
  } else if (action === "touch") {
    await prisma.game.update({ where: { id: gameId }, data: { updatedAt: new Date() } });
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const [totalGames, activeGames, totalMirrors, totalVisitors, latestGames] = await Promise.all([
    prisma.game.count(),
    prisma.game.count({ where: { isActive: true } }),
    prisma.downloadLink.count(),
    getVisitorCounter(),
    prisma.game.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        isActive: true,
        updatedAt: true,
        _count: {
          select: {
            downloadLinks: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <main className="min-h-screen pb-10">
      <section className="container py-10 md:py-14">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gradient-vibrant md:text-4xl">Admin Ops</h1>
            <p className="text-sm text-muted-foreground">Moderation and synchronization controls.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back to site</Link>
          </Button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="gaming-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Entries</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{totalGames}</CardContent>
          </Card>
          <Card className="gaming-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Entries</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{activeGames}</CardContent>
          </Card>
          <Card className="gaming-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mirror Records</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{totalMirrors}</CardContent>
          </Card>
          <Card className="gaming-surface">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Visitors</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{totalVisitors}</CardContent>
          </Card>
        </div>

        <Card className="gaming-surface">
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestGames.map((game) => (
              <div
                key={game.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/35 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <Link href={`/game/${game.slug}`} className="text-sm font-semibold text-foreground hover:text-primary">
                    {game.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Updated{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(game.updatedAt)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant={game.isActive ? "default" : "outline"}>
                      {game.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">{game._count.downloadLinks} mirrors</Badge>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={updateGameState}>
                    <input type="hidden" name="gameId" value={game.id} />
                    <input type="hidden" name="action" value="touch" />
                    <Button type="submit" variant="secondary" size="sm">
                      Refresh Timestamp
                    </Button>
                  </form>
                  <form action={updateGameState}>
                    <input type="hidden" name="gameId" value={game.id} />
                    <input type="hidden" name="action" value={game.isActive ? "deactivate" : "activate"} />
                    <Button type="submit" variant={game.isActive ? "outline" : "default"} size="sm">
                      {game.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
