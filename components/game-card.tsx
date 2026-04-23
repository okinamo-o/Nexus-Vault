import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { normalizeRequirements, requirementsToRows } from "@/lib/game-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type GameCardProps = {
  game: {
    id: number;
    title: string;
    slug: string;
    description: string;
    imagePath: string;
    requirements: unknown;
  };
};

export function GameCard({ game }: GameCardProps) {
  const requirements = requirementsToRows(normalizeRequirements(game.requirements)).slice(0, 2);
  const imagePath = game.imagePath
    ? game.imagePath.startsWith("/")
      ? game.imagePath
      : `/games/${game.imagePath}`
    : "/window.svg";
  const shortDescription =
    game.description.length > 140 ? `${game.description.slice(0, 137).trim()}...` : game.description;

  return (
    <Link href={`/game/${game.slug}`} className="group gaming-glow block h-full">
      <Card className="h-full overflow-hidden border-border/70 bg-card/80 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60">
        <div className="relative aspect-[16/9] overflow-hidden bg-secondary/70">
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-background/85 via-background/10 to-transparent" />
          <Image
            src={imagePath}
            alt={game.title}
            fill
            loading="lazy"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-[1.07]"
          />
          <div className="absolute bottom-3 left-3 z-20">
            <Badge variant="default" className="uppercase">
              New Entry
            </Badge>
          </div>
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="line-clamp-2 text-base text-slate-100">{game.title}</CardTitle>
          <CardDescription className="line-clamp-3 text-sm text-slate-300/90">
            {shortDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 pb-4">
          {requirements.length > 0 ? (
            requirements.map((entry) => (
              <Badge key={entry.key} variant="subtle" className="text-xs">
                {entry.key}: {entry.value}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Specs pending</Badge>
          )}
          <span className="ml-auto inline-flex items-center text-xs font-semibold uppercase tracking-wider text-primary">
            View
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
