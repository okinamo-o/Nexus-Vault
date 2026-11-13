"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export function AdsterraScripts() {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <Script
        src="https://pl29293508.profitablecpmratenetwork.com/5d/13/7c/5d137c2f0fe64ee80a87395c1201dac6.js"
        strategy="lazyOnload"
      />
      <Script
        src="https://pl29293509.profitablecpmratenetwork.com/01/26/8f/01268f79cb8f751a836a8d3d1da7d92c.js"
        strategy="lazyOnload"
      />
    </>
  );
}

