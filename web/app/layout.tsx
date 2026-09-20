import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Footy League Edge — Beat Your Mini-League",
  description:
    "Connect your FPL mini-league, track the people you want to beat, get automatic weekly recaps and league-specific decision support.",
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
