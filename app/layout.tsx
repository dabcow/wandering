import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Source_Serif_4 } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const ui = DM_Sans({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
});
const prose = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-prose",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Wandering",
  description:
    "A plot-tree tool for writers: branch through plot points level by level, then write alongside the tree.",
};

export const viewport: Viewport = {
  themeColor: "#f4eefb",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${display.variable} ${prose.variable}`}>
      <body>{children}</body>
    </html>
  );
}
