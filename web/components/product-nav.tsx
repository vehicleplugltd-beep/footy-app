import Link from "next/link";

type ProductArea = "hq" | "team" | "research";

export function ProductNav({
  active,
  teamHref,
  teamName,
  researchHref = "/research",
}: {
  active: ProductArea;
  teamHref?: string;
  teamName?: string;
  researchHref?: string;
}) {
  const items = [
    { key: "hq" as const, label: "HQ", href: "/" },
    ...(teamHref
      ? [{ key: "team" as const, label: teamName ?? "Team Room", href: teamHref }]
      : []),
    { key: "research" as const, label: "Research", href: researchHref },
  ];

  return (
    <nav className="nav shell footy-product-nav" aria-label="Footy primary">
      <Link className="brand brand-link" href="/">
        <span className="brand-mark">F</span>
        <span>Footy</span>
      </Link>

      <div className="footy-product-nav-links">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={active === item.key ? "active" : undefined}
            aria-current={active === item.key ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/betting" aria-label="Open Footy Edge betting analytics">
          Edge 18+
        </Link>
      </div>
    </nav>
  );
}
