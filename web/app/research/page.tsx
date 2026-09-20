import Link from "next/link";
import { ResearchHub } from "@/components/research-hub";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string | string[]; club?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawPlayer = Array.isArray(query.player) ? query.player[0] : query.player;
  const rawClub = Array.isArray(query.club) ? query.club[0] : query.club;
  const playerId = rawPlayer ? Number(rawPlayer.replace(/\D/g, "")) : undefined;

  return (
    <main className="league-edge-app research-page">
      <nav className="nav shell hq-nav">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="hq-nav-right">
          <Link href="/">HQ</Link>
          <span>Research</span>
        </div>
      </nav>
      <div className="shell">
        <ResearchHub
          initialPlayerId={
            playerId && Number.isInteger(playerId) && playerId > 0
              ? playerId
              : undefined
          }
          initialClub={rawClub || undefined}
        />
      </div>
    </main>
  );
}
