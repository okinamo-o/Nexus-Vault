"use client";

import { useEffect, useRef } from "react";

export default function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !containerRef.current.getAttribute("data-ad-loaded")) {
      const script = document.createElement("script");
      script.src = "https://pl29293510.profitablecpmratenetwork.com/8baca3706a2107dd6b265e6c0fbbccd9/invoke.js";
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      
      containerRef.current.appendChild(script);
      containerRef.current.setAttribute("data-ad-loaded", "true");
    }
  }, []);

  return (
    <div className="my-6 flex flex-col items-center justify-center overflow-hidden rounded-xl bg-background/20 p-2 border border-border/40">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground/60">Advertisement</p>
      <div 
        ref={containerRef}
        id="container-8baca3706a2107dd6b265e6c0fbbccd9" 
        className="w-full max-w-[728px] min-h-[90px]"
      />
    </div>
  );
}
