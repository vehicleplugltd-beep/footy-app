
import Link from "next/link";
import { TeamConnectForm } from "@/components/team-connect-form";
import { FrontOffice } from "@/components/front-office";
import { getFplTeamDiscovery } from "@/lib/fpl-team";
import { footyQuip } from "@/lib/footy-voice";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ team?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawTeam = Array.isArray(query.team) ? query.team[0] : query.team;
  const teamId = rawTeam ? Number(rawTeam.replace(/\D/g, "")) : undefined;

  let team = null;
  let teamError: string | null = null;

  if (teamId && Number.isInteger(teamId) && teamId > 0) {
    try {
      team = await getFplTeamDiscovery(teamId);
    } catch (error) {
      teamError =
        error instanceof Error
          ? error.message
          : "Footy could not load that FPL team.";
    }
  }

  return (
    <main className="league-edge-app footy-hq">
      <nav className="nav shell hq-nav">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="hq-nav-right">
          <span>FPL Assistant Manager</span>
          {team ? (
            <Link href={"/review?team=" + team.id}>Review</Link>
          ) : null}
        </div>
      </nav>

      <section className="shell hq-connect">
        <div className="hq-connect-copy">
          <span>FPL HQ</span>
          <h1>Connect your team. See what matters now — and why.</h1>
          <p>
            Footy turns live FPL state, mini-league pressure and underlying
            football process into a clear decision, its evidence, and the
            failure mode that could make it wrong.
          </p>
          <blockquote className="footy-quip">{footyQuip("hq")}</blockquote>
        </div>

        <div className="hq-connect-form">
          <TeamConnectForm />
          {teamError ? (
            <div className="hq-team-error">{teamError}</div>
          ) : null}
        </div>
      </section>

      <FrontOffice team={team} />

      <section className="shell hq-flow">
        <div>
          <span>HOW FOOTY FLOWS</span>
          <h2>HQ → Team Room → Preview</h2>
          <p className="hq-flow-principle">
            Decision first. Evidence second. Model depth only when you ask for it.
          </p>
        </div>
        <div>
          <p>
            <b>HQ</b> gives you the live player market and loads your team.
          </p>
          <p>
            <b>Team Room</b> combines squad quality with the mini-league battle.
          </p>
          <p>
            <b>Preview</b> lets you follow Footy’s suggestion or build your own.
          </p>
        </div>
      </section>

      <footer className="shell footer minimal-footer">
        <p>Live FPL data. Underlying football process. Mini-league context.</p>
        <p>LOAD TEAM → CHOOSE LEAGUE → DECIDE → PREVIEW</p>
      </footer>
    </main>
  );
}
