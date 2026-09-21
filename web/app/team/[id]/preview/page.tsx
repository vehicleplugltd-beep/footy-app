import { redirect } from "next/navigation";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ league?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const rawLeague = Array.isArray(query.league) ? query.league[0] : query.league;
  const teamId = Number(id.replace(/\D/g, ""));
  const leagueId = rawLeague ? Number(rawLeague.replace(/\D/g, "")) : null;

  if (!Number.isInteger(teamId) || teamId <= 0) redirect("/");
  if (!leagueId || !Number.isInteger(leagueId) || leagueId <= 0) {
    redirect("/?team=" + teamId);
  }

  redirect("/team/" + teamId + "?league=" + leagueId + "#what-if");
}
