import type { Metadata } from "next";
import "./globals.css";
import "./research-layer.css";
import "./product-structure.css";

export const metadata: Metadata = process.env.FOOTY_APP_MODE === "edge" ? {
  title: "Footy Edge — Football Value Research",
  description: "Independent football process, model probabilities and verified bookmaker price research. 18+.",
} : {
  title: "Footy — Your FPL Assistant Manager",
  description:
    "A live FPL assistant manager for squad decisions, scouting, mini-league intelligence and multi-Gameweek planning.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
