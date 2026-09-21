import { redirect } from "next/navigation";

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawTeam = Array.isArray(query.team) ? query.team[0] : query.team;
  const leagueId = Number(id.replace(/\D/g, ""));
  const teamId = rawTeam ? Number(rawTeam.replace(/\D/g, "")) : null;

  if (
    teamId &&
    Number.isInteger(teamId) &&
    teamId > 0 &&
    Number.isInteger(leagueId) &&
    leagueId > 0
  ) {
    redirect("/team/" + teamId + "?league=" + leagueId);
  }

  redirect(teamId ? "/?team=" + teamId : "/");
}
