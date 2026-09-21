import { ResearchHub } from "@/components/research-hub";
import { ProductNav } from "@/components/product-nav";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    player?: string | string[];
    club?: string | string[];
    team?: string | string[];
    league?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const rawPlayer = Array.isArray(query.player) ? query.player[0] : query.player;
  const rawClub = Array.isArray(query.club) ? query.club[0] : query.club;
  const rawTeam = Array.isArray(query.team) ? query.team[0] : query.team;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const playerId = rawPlayer ? Number(rawPlayer.replace(/\D/g, "")) : undefined;
  const teamId = rawTeam ? Number(rawTeam.replace(/\D/g, "")) : null;
  const leagueId = rawLeague ? Number(rawLeague.replace(/\D/g, "")) : null;
  const teamHref =
    teamId &&
    Number.isInteger(teamId) &&
    teamId > 0 &&
    leagueId &&
    Number.isInteger(leagueId) &&
    leagueId > 0
      ? "/team/" + teamId + "?league=" + leagueId
      : undefined;

  return (
    <main className="league-edge-app research-page">
      <ProductNav active="research" teamHref={teamHref} />
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
