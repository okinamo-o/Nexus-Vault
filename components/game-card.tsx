import Image from "next/image";
import Link from "next/link";

import { normalizeRequirements, requirementsToRows } from "@/lib/game-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type GameCardProps = {
  game: {
    id: string;
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
    <Link href={`/game/${game.slug}`} className="group block h-full">
      <Card className="h-full overflow-hidden bg-card transition duration-200 hover:border-primary/70 hover:shadow-lg hover:shadow-primary/10">
        <div className="relative aspect-[16/9] overflow-hidden bg-secondary/70">
          <Image
            src={imagePath}
            alt={game.title}
            fill
            loading="lazy"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="line-clamp-1 text-base">{game.title}</CardTitle>
          <CardDescription className="line-clamp-3 text-sm">{shortDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pb-5">
          {requirements.length > 0 ? (
            requirements.map((entry) => (
              <Badge key={entry.key} variant="subtle" className="bg-secondary text-xs">
                {entry.key}: {entry.value}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">Specs pending</Badge>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
