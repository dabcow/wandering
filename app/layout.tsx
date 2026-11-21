import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const prose = Source_Serif_4({ subsets: ["latin"], variable: "--font-prose", display: "swap" });

export const metadata: Metadata = {
  title: "Wandering",
  description:
    "Speak or type a rough idea, shape its style, and work the draft paragraph by paragraph.",
};

export const viewport: Viewport = {
  themeColor: "#0c0f13",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${prose.variable}`}>
      <body>{children}</body>
    </html>
  );
}
