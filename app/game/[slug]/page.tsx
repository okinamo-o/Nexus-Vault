import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeDownloadLinks, normalizeRequirements, requirementsToRows } from "@/lib/game-data";
import { prisma } from "@/lib/prisma";

type GameDetailProps = {
  params: {
    slug: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: GameDetailProps): Promise<Metadata> {
  const game = await prisma.game.findUnique({
    where: { slug: params.slug },
    select: { title: true, description: true },
  });

  if (!game) {
    return { title: "Game Not Found" };
  }

  return {
    title: game.title,
    description: game.description.slice(0, 150),
  };
}

export default async function GameDetailPage({ params }: GameDetailProps) {
  const game = await prisma.game.findFirst({
    where: {
      slug: params.slug,
      isActive: true,
    },
    include: {
      downloadLinks: true,
    },
  });

  if (!game) {
    notFound();
  }

  const requirements = requirementsToRows(normalizeRequirements(game.requirements));
  const downloadLinks = normalizeDownloadLinks(game.downloadLinks);
  const imagePath = game.imagePath
    ? game.imagePath.startsWith("/")
      ? game.imagePath
      : `/games/${game.imagePath}`
    : "/window.svg";

  return (
    <main className="min-h-screen py-10 md:py-14">
      <section className="container max-w-5xl space-y-6">
        <Button asChild variant="ghost" className="w-fit text-muted-foreground hover:text-foreground">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to archive
          </Link>
        </Button>

        <article className="overflow-hidden rounded-2xl border border-border/70 bg-card/95">
          <div className="relative aspect-[16/8] w-full bg-secondary">
            <Image
              src={imagePath}
              alt={game.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>

          <div className="space-y-8 p-6 md:p-10">
            <header className="space-y-4">
              <Badge className="bg-primary/20 text-primary">Editorial Entry</Badge>
              <h1 className="font-heading text-3xl font-bold leading-tight text-foreground md:text-4xl">
                {game.title}
              </h1>
              <p className="max-w-3xl whitespace-pre-line text-base leading-7 text-slate-200">
                {game.description}
              </p>
            </header>

            <section className="grid gap-5 md:grid-cols-2">
              <Card className="bg-background/60">
                <CardHeader>
                  <CardTitle>System Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  {requirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Requirements are not available yet for this title.
                    </p>
                  ) : (
                    <dl className="space-y-3 text-sm">
                      {requirements.map((item) => (
                        <div
                          key={item.key}
                          className="grid grid-cols-[120px_1fr] gap-3 border-b border-border/50 pb-3 last:border-b-0"
                        >
                          <dt className="font-semibold text-primary">{item.key}</dt>
                          <dd className="text-slate-200">{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-background/60">
                <CardHeader>
                  <CardTitle>Download Mirrors</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {downloadLinks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Download mirrors are currently unavailable.
                    </p>
                  ) : (
                    downloadLinks.map((link) => (
                      <Button key={link.url} asChild className="w-full justify-between">
                        <a
                          href={`/api/exit?url=${encodeURIComponent(link.url)}`}
                          rel="noreferrer noopener"
                          target="_blank"
                        >
                          {link.label}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}
