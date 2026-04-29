import type { Metadata } from "next";
import { Manrope, Outfit } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: {
    default: "Nexus Vault",
    template: "%s | Nexus Vault",
  },
  description: "The Definitive Digital Archive.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.png",
  },
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${outfit.variable} dark`}
      suppressHydrationWarning
    >
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className="antialiased">
        {children}
        {/* Adsterra Global Scripts */}
        <Script
          src="https://pl29293508.profitablecpmratenetwork.com/5d/13/7c/5d137c2f0fe64ee80a87395c1201dac6.js"
          strategy="lazyOnload"
        />
        <Script
          src="https://pl29293509.profitablecpmratenetwork.com/01/26/8f/01268f79cb8f751a836a8d3d1da7d92c.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
