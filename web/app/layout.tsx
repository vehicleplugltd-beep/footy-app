import type { Metadata } from "next";
import "./globals.css";
import "./research-layer.css";

export const metadata: Metadata = {
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
