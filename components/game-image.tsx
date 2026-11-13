"use client";

import Image, { type ImageProps } from "next/image";
import * as React from "react";

import { FALLBACK_GAME_IMAGE, resolveGameImagePath } from "@/lib/game-data";
import { cn } from "@/lib/utils";

type GameImageProps = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
};

export function GameImage({ src, alt, className, ...props }: GameImageProps) {
  const resolved = resolveGameImagePath(src);
  const [currentSrc, setCurrentSrc] = React.useState(resolved);

  React.useEffect(() => {
    setCurrentSrc(resolved);
  }, [resolved]);

  const isFallback = currentSrc === FALLBACK_GAME_IMAGE;

  return (
    <Image
      {...props}
      src={currentSrc}
      alt={alt}
      className={cn(
        className,
        isFallback && "object-contain p-8 opacity-65"
      )}
      onError={() => {
        if (currentSrc !== FALLBACK_GAME_IMAGE) {
          setCurrentSrc(FALLBACK_GAME_IMAGE);
        }
      }}
    />
  );
}

