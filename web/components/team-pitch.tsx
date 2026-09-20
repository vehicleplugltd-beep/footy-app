import type { FplPitchPlayer } from "@/lib/fpl-team";

function signal(player: FplPitchPlayer) {
  if (player.availability < 75 || player.status !== "a") return { label: "DOUBT", className: "is-doubt" };
  if (player.form >= 6) return { label: "HOT", className: "is-hot" };
  if (player.transfersNet >= 50000) return { label: "RISING", className: "is-rising" };
  return { label: "STEADY", className: "" };
}

function PlayerCard({ player }: { player: FplPitchPlayer }) {
  const trend = signal(player);
  return (
    <div
      className={`pitch-player ${trend.className}`}
      title={`${player.name} · ${player.team} · Form ${player.form.toFixed(1)} · ${player.availability}% availability`}
    >
      <div className="pitch-shirt">
        <span>{player.team}</span>
        {player.isCaptain ? <b>C</b> : null}
        {player.isViceCaptain ? <b>V</b> : null}
      </div>
      <strong>{player.name}</strong>
      <small>£{player.price.toFixed(1)} · {trend.label}</small>
    </div>
  );
}

function PitchRow({ players }: { players: FplPitchPlayer[] }) {
  if (!players.length) return null;
  return (
    <div className="pitch-line">
      {players.map((player) => <PlayerCard key={player.id} player={player} />)}
    </div>
  );
}

export function TeamPitch({ squad }: { squad: FplPitchPlayer[] }) {
  const starters = squad.filter((player) => player.starter);
  const bench = squad.filter((player) => !player.starter);
  const byPosition = (position: string) => starters.filter((player) => player.position === position);

  return (
    <div className="team-pitch-wrap">
      <div className="team-pitch">
        <div className="pitch-halfway" />
        <div className="pitch-centre-circle" />
        <div className="pitch-box pitch-box-top" />
        <div className="pitch-box pitch-box-bottom" />
        <PitchRow players={byPosition("GKP")} />
        <PitchRow players={byPosition("DEF")} />
        <PitchRow players={byPosition("MID")} />
        <PitchRow players={byPosition("FWD")} />
      </div>
      <div className="team-bench">
        <div className="team-bench-head"><span>BENCH</span><small>Current Gameweek squad</small></div>
        <div className="team-bench-row">
          {bench.map((player) => <PlayerCard key={player.id} player={player} />)}
        </div>
      </div>
    </div>
  );
}
