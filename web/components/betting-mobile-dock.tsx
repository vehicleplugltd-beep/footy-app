"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/betting", label: "Today", icon: "⌂" },
  { href: "/betting/results", label: "Results", icon: "✓" },
  { href: "/betting/tools", label: "Analyzer", icon: "◇" },
  { href: "/betting/my-bets", label: "My Bets", icon: "◎" },
];

export function BettingMobileDock() {
  const pathname = usePathname();

  return (
    <nav className="betting-mobile-dock" aria-label="Betting mobile navigation">
      {items.map((item) => {
        const active =
          item.href === "/betting"
            ? pathname === "/betting"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            <b>{item.icon}</b>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
