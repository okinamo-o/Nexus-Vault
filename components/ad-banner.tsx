"use client";

import { useEffect, useRef } from "react";

export default function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const script = document.createElement("script");
    script.src =
      "https://pl29293510.profitablecpmratenetwork.com/8baca3706a2107dd6b265e6c0fbbccd9/invoke.js";
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, []);

  return (
    <div className="my-6 flex flex-col items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-background/20 p-2">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">
        Advertisement
      </p>
      <div
        ref={containerRef}
        id="container-8baca3706a2107dd6b265e6c0fbbccd9"
        className="min-h-[90px] w-full max-w-[728px]"
      />
    </div>
  );
}
