import type { Metadata } from "next";
import "./betting.css";
import { BettingMobileDock } from "@/components/betting-mobile-dock";

export const metadata: Metadata = {
  title: "Footy Edge — Football Value Betting Analytics",
  description:
    "Football probability, fair-price, value and betting-performance analytics. 18+ only.",
};

export default function BettingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <BettingMobileDock />
    </>
  );
}
