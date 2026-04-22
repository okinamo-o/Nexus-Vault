import { cn } from "@/lib/utils";

type SiteLogoProps = {
  className?: string;
};

export function SiteLogo({ className }: SiteLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="Nexus Vault logo"
      className={cn("h-10 w-10", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nv-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
      </defs>
      <polygon points="50,8 86,30 50,52 14,30" fill="none" stroke="url(#nv-accent)" strokeWidth="5" />
      <polygon points="14,30 14,70 50,92 50,52" fill="none" stroke="#38BDF8" strokeWidth="5" />
      <polygon points="86,30 86,70 50,92 50,52" fill="none" stroke="#7DD3FC" strokeWidth="5" />
      <polygon points="46,39 46,61 63,50" fill="#38BDF8" />
    </svg>
  );
}
