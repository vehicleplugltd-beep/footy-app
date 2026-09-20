import { redirect } from "next/navigation";

export default async function SquadLabPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[]; league?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawTeam = Array.isArray(query.team) ? query.team[0] : query.team;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const teamId = rawTeam ? Number(rawTeam.replace(/\D/g, "")) : null;
  const leagueId = rawLeague ? Number(rawLeague.replace(/\D/g, "")) : null;

  if (teamId && Number.isInteger(teamId) && teamId > 0) {
    const leagueQuery =
      leagueId && Number.isInteger(leagueId) && leagueId > 0
        ? `?league=${leagueId}`
        : "";
    redirect(`/team/${teamId}${leagueQuery}#build-test`);
  }

  redirect("/");
}
