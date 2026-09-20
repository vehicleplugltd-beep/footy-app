
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  ScoutPlayerProfile,
  ScoutTeamProfile,
} from "@/lib/fpl";

type Standing = {
  entry_id: number;
  entry_name: string;
  player_name?: string | null;
  rank: number | null;
  last_rank?: number | null;
  event_total?: number | null;
  total: number | null;
};

type ManagerPayload = {
  manager_standing?: Standing;
  target_standing?: Standing | null;
  chaser_standings?: Standing[];
  analysis?: {
    manager?: {
      teamName?: string;
      managerName?: string;
      squad?: Array<{
        id: number;
        name: string;
        team: string;
        position: string;
        price: number;
        assistantScore: number;
        opponent: string | null;
        selectedBy?: number;
        availability?: number;
      }>;
      currentCaptain?: {
        id: number;
        name: string;
        team: string;
      } | null;
      recommendedCaptain?: {
        id: number;
        name: string;
        team: string;
      } | null;
      weakLinks?: Array<{
        player: {
          id: number;
          name: string;
          team: string;
        };
        replacement: {
          id: number;
          name: string;
          team: string;
        } | null;
        reason: string;
        gain?: number;
        horizonGain?: number;
        timing?: "NOW" | "WAIT" | "HOLD";
      }>;
    };
    overlap?: {
      count: number;
      common?: Array<{ id: number; name: string }>;
      managerOnly?: Array<{ id: number; name: string }>;
      rivalOnly?: Array<{ id: number; name: string }>;
    };
  };
  resource_map?: Array<{
    standing: Standing;
    history: {
      estimatedFreeTransfers: number;
      freeTransferConfidence?: "HIGH" | "MEDIUM";
      totalHitCost: number;
      recentHitCost: number;
      activity: "AGGRESSIVE" | "ACTIVE" | "PATIENT";
      currentHalfRemaining: string[];
      chips: Array<{
        label: string;
        event: number;
      }>;
    };
  }>;
  resource_advice?: {
    status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
    recommendation: string;
  } | null;
};

function DrawerShell({
  title,
  kicker,
  onClose,
  children,
}: {
  title: string;
  kicker: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", close);
    document.body.classList.add("intel-open");
    return () => {
      window.removeEventListener("keydown", close);
      document.body.classList.remove("intel-open");
    };
  }, [onClose]);

  return (
    <div className="intel-layer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="intel-backdrop"
        aria-label="Close profile"
        onClick={onClose}
      />
      <aside className="intel-drawer">
        <header className="intel-head">
          <div>
            <span>{kicker}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="intel-body">{children}</div>
      </aside>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="intel-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function EvidenceBlock({
  rows,
  source,
  confidence,
  caveat,
}: {
  rows: Array<{
    label: string;
    value: string;
    kind: "FACT" | "MODEL";
  }>;
  source: string;
  confidence: string;
  caveat?: string;
}) {
  return (
    <section className="intel-evidence">
      <div className="intel-section-head">
        <div>
          <span>EVIDENCE USED</span>
          <h3>Why Footy can say this</h3>
        </div>
        <small>{confidence}</small>
      </div>
      <div className="intel-evidence-list">
        {rows.map((row) => (
          <div key={row.label}>
            <em className={row.kind === "FACT" ? "evidence-fact" : "evidence-model"}>
              {row.kind}
            </em>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      <div className="intel-source-line">
        <span>SOURCE</span>
        <strong>{source}</strong>
      </div>
      {caveat ? (
        <div className="intel-caveat">
          <span>LIMIT</span>
          <p>{caveat}</p>
        </div>
      ) : null}
    </section>
  );
}

export function PlayerIntelDrawer({
  profile,
  teams,
  onClose,
  onOpenTeam,
}: {
  profile: ScoutPlayerProfile | null;
  teams: ScoutTeamProfile[];
  onClose: () => void;
  onOpenTeam: (team: ScoutTeamProfile) => void;
}) {
  if (!profile) return null;

  const player = profile.player;
  const isKeeper = player.position === "GKP";
  const processMetricLabel = isKeeper ? "Goals prevented/90" : "Reg xGI/90";
  const processMetricValue: number | null = isKeeper
    ? profile.evidence?.goalsPreventedPer90 ?? null
    : profile.evidence?.regressedXgiPer90 ?? player.xgiPer90;
  const team = teams.find((item) => item.team === player.teamName) ?? null;
  const read =
    profile.status === "BUY_NOW"
      ? "The current window is strong enough to act if he fits your squad structure."
      : profile.status === "FUTURE_TARGET"
        ? "The player grades well, but the better buying window is later. Timing matters more than chasing the name now."
        : profile.epa.undervalued
          ? "The underlying output is ahead of the current FPL return. Keep him high on the shortlist, but still respect fixture and minutes risk."
          : "There is a credible case, but not enough separation from alternatives to force the move.";

  return (
    <DrawerShell
      kicker="PLAYER DOSSIER"
      title={player.name}
      onClose={onClose}
    >
      <section className="intel-summary">
        <div>
          <span>{profile.epa.undervalued ? "UNDERVALUED" : profile.status.replaceAll("_", " ")}</span>
          <h3>{player.teamName} · {player.position}</h3>
          <p>£{player.price.toFixed(1)}m · {player.totalPoints} pts · {player.selectedBy.toFixed(1)}% owned</p>
        </div>
        {team ? (
          <button type="button" onClick={() => onOpenTeam(team)}>
            Club profile →
          </button>
        ) : null}
      </section>

      <section className="intel-read">
        <span>FOOTY'S READ</span>
        <strong>{read}</strong>
      </section>

      <div className="intel-decision-band">
        <div>
          <span>CONFIDENCE</span>
          <strong>{profile.decisionConfidence}</strong>
        </div>
        <div>
          <span>FAILURE MODE</span>
          <strong>{profile.risks[0] ?? "Role, minutes or team news can change the call."}</strong>
        </div>
      </div>

      <EvidenceBlock
        rows={[
          {
            label: isKeeper ? "Post-shot goalkeeping" : "Role-adjusted involvement",
            value: isKeeper
              ? profile.evidence
                ? profile.evidence.goalsPreventedPer90.toFixed(2) +
                  " goals prevented/90"
                : "Post-shot evidence unavailable"
              : (profile.evidence?.regressedXgiPer90 ?? player.xgiPer90).toFixed(2) +
                " xGI/90",
            kind: "MODEL",
          },
          {
            label: "Expected vs realised attack",
            value:
              (profile.epa.underperformanceGap >= 0 ? "+" : "") +
              profile.epa.underperformanceGap.toFixed(2) +
              " pts/90 gap",
            kind: "MODEL",
          },
          {
            label: "Marginal value",
            value:
              (profile.epa.epa >= 0 ? "+" : "") +
              profile.epa.epa.toFixed(2) +
              " EPA vs " +
              profile.epa.replacementXP.toFixed(2) +
              " replacement xP",
            kind: "MODEL",
          },
          {
            label: "Timing",
            value:
              "Best 3GW window " +
              profile.bestWindow.startName +
              "–" +
              profile.bestWindow.endName,
            kind: "MODEL",
          },
          {
            label: "Minutes / availability",
            value:
              profile.epa.expectedMinutes.toFixed(0) +
              " expected mins · " +
              player.availability +
              "% available",
            kind: "MODEL",
          },
        ]}
        source={profile.coreSources.join(" · ")}
        confidence={profile.decisionConfidence + " DECISION CONFIDENCE"}
        caveat="EPA, future ratings and timing are model outputs, not observed facts. Team news, role changes and a small minutes sample can move the conclusion."
      />

      <section className="intel-grid intel-grid-primary">
        <Metric label="EPA" value={(profile.epa.epa >= 0 ? "+" : "") + profile.epa.epa.toFixed(2)} sub="vs replacement" />
        <Metric
          label="Risk"
          value={profile.riskProfile.downsideRisk + "/100"}
          sub={profile.riskProfile.assetType}
        />
        <Metric
          label="Floor / Ceiling"
          value={profile.riskProfile.floor.toFixed(1) + " / " + profile.riskProfile.ceiling.toFixed(1)}
          sub={"volatility " + profile.riskProfile.volatility.toFixed(1)}
        />
        <Metric
          label={processMetricLabel}
          value={
            processMetricValue == null
              ? "—"
              : (processMetricValue >= 0 && isKeeper ? "+" : "") +
                processMetricValue.toFixed(2)
          }
          sub={
            isKeeper
              ? profile.evidence
                ? "recent post-shot process"
                : "evidence unavailable"
              : profile.evidence?.priorAvailable
                ? "prior-regressed"
                : "current evidence"
          }
        />
        <Metric label="Expected mins" value={profile.epa.expectedMinutes.toFixed(0)} sub={player.availability + "% available"} />
        <Metric label="6GW" value={profile.score6.toFixed(1)} sub={profile.bestWindow.startName + " best window"} />
      </section>

      <section className="intel-section intel-risk-profile">
        <div className="intel-section-head">
          <div>
            <span>RISK-ADJUSTED PROFILE</span>
            <h3>{profile.riskProfile.assetType} asset · downside {profile.riskProfile.downsideRisk}/100</h3>
          </div>
          <small>{profile.riskProfile.floor.toFixed(1)} floor → {profile.riskProfile.ceiling.toFixed(1)} ceiling</small>
        </div>
        <div className="intel-stat-list">
          <p><span>Model floor</span><b>{profile.riskProfile.floor.toFixed(1)}</b></p>
          <p><span>Model ceiling</span><b>{profile.riskProfile.ceiling.toFixed(1)}</b></p>
          <p><span>Volatility</span><b>{profile.riskProfile.volatility.toFixed(1)}</b></p>
          <p><span>Downside risk</span><b>{profile.riskProfile.downsideRisk}/100</b></p>
        </div>
        <div className="intel-risk-drivers">
          {profile.riskProfile.drivers.map((driver) => <p key={driver}>{driver}</p>)}
        </div>
        <small className="intel-risk-caveat">
          Floor/ceiling are model distribution proxies from minutes reliability, attacking involvement,
          clean-sheet exposure, fixture variance and workload—not observed historical percentiles.
        </small>
      </section>

      <details className="intel-audit intel-model-depth">
        <summary>Open model depth</summary>
        <section className="intel-section">
          <div className="intel-section-head">
            <div>
              <span>UNDERLYING</span>
              <h3>What is driving the rating?</h3>
            </div>
          </div>
          <div className="intel-stat-list">
            <p><span>Official xG / 90</span><b>{player.xgPer90.toFixed(2)}</b></p>
            <p><span>Official xA / 90</span><b>{player.xaPer90.toFixed(2)}</b></p>
            <p><span>Regressed xGI / 90</span><b>{(profile.evidence?.regressedXgiPer90 ?? player.xgiPer90).toFixed(2)}</b></p>
            <p><span>Prior xGI / 90</span><b>{profile.evidence?.priorAvailable ? profile.evidence.priorXgiPer90.toFixed(2) : "—"}</b></p>
            <p><span>Current evidence weight</span><b>{profile.evidence ? Math.round(profile.evidence.currentEvidenceWeight * 100) + "%" : "—"}</b></p>
            <p><span>Form</span><b>{player.form.toFixed(1)}</b></p>
            <p><span>Starts / minutes</span><b>{player.starts} / {player.minutes}</b></p>
            <p><span>Start reliability</span><b>{Math.round(player.startReliability * 100)}%</b></p>
            <p><span>Bonus</span><b>{player.bonus}</b></p>
            <p><span>Transfers net</span><b>{player.transfersNet >= 0 ? "+" : ""}{player.transfersNet.toLocaleString()}</b></p>
          </div>
        </section>
      </details>

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span>FIXTURE WINDOW</span>
            <h3>When does he become most useful?</h3>
          </div>
          <small>{profile.bestWindow.startName} → {profile.bestWindow.endName}</small>
        </div>
        <div className="intel-fixtures">
          {profile.horizon.map((fixture) => (
            <div key={fixture.eventId}>
              <span>{fixture.name}</span>
              <strong>{fixture.opponent ?? "—"} {fixture.homeAway !== "—" ? "(" + fixture.homeAway + ")" : ""}</strong>
              <small>FDR {fixture.difficulty} · {fixture.score.toFixed(1)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="intel-two-col">
        <div>
          <span>WHY</span>
          {profile.reasons.map((reason) => <p key={reason}>{reason}</p>)}
        </div>
        <div>
          <span>RISKS</span>
          {profile.risks.map((risk) => <p key={risk}>{risk}</p>)}
        </div>
      </section>

      <details className="intel-audit">
        <summary>Show EPA calculation & sources</summary>
        <div className="intel-stat-list">
          <p><span>Base xP</span><b>{profile.epa.baseXP.toFixed(2)}</b></p>
          <p><span>Replacement xP</span><b>{profile.epa.replacementXP.toFixed(2)}</b></p>
          <p><span>Expected minutes</span><b>{profile.epa.expectedMinutes.toFixed(0)}</b></p>
          <p><span>Underperformance gap</span><b>{profile.epa.underperformanceGap.toFixed(2)}</b></p>
        </div>
        {profile.coreSources.map((source) => <p key={source}>{source}</p>)}
      </details>
    </DrawerShell>
  );
}

export function TeamIntelDrawer({
  team,
  players,
  onClose,
  onOpenPlayer,
}: {
  team: ScoutTeamProfile | null;
  players: ScoutPlayerProfile[];
  onClose: () => void;
  onOpenPlayer: (profile: ScoutPlayerProfile) => void;
}) {
  if (!team) return null;

  const process = team.process;
  const read = !process
    ? "The fixture run is visible, but Footy does not have enough reconciled process data to make a strong structural claim."
    : process.attackIndex >= 1.06 && process.attackTrend > 0.03
      ? "The attack is above baseline and improving. Attackers deserve extra attention while the fixture run remains supportive."
      : process.defenceIndex >= 1.06 && process.defenceTrend > 0.03
        ? "Defensive process is one of the stronger signals. Defenders and goalkeeper become more interesting when fixtures cooperate."
        : team.outlook === "TOUGH RUN"
          ? "The process may be reasonable, but the schedule is doing them no favours. Avoid paying for points that need perfect fixtures to arrive."
          : "The profile is balanced rather than exceptional. Player role and price should decide which assets, if any, are worth owning.";

  return (
    <DrawerShell kicker="CLUB PROFILE" title={team.team} onClose={onClose}>
      <section className="intel-summary">
        <div>
          <span>{team.outlook}</span>
          <h3>6GW average FDR {team.averageDifficulty.toFixed(1)}</h3>
          <p>{process ? Math.round(process.sourceConfidence * 100) + "% process-source confidence" : "Process data unavailable"}</p>
        </div>
      </section>

      <section className="intel-read">
        <span>FOOTY'S READ</span>
        <strong>{read}</strong>
      </section>

      <EvidenceBlock
        rows={
          process
            ? [
                {
                  label: "Attack level / trend",
                  value:
                    process.attackIndex.toFixed(2) +
                    " index · " +
                    (process.attackTrend >= 0 ? "+" : "") +
                    Math.round(process.attackTrend * 100) +
                    "%",
                  kind: "MODEL" as const,
                },
                {
                  label: "Non-penalty process",
                  value:
                    process.metrics.npxg.toFixed(2) +
                    " npxG · " +
                    process.metrics.npxga.toFixed(2) +
                    " npxGA",
                  kind: "FACT" as const,
                },
                {
                  label: "Shot quality / territory",
                  value:
                    process.metrics.shotsOnTarget.toFixed(1) +
                    " SOT · " +
                    process.metrics.boxTouches.toFixed(1) +
                    " box touches",
                  kind: "FACT" as const,
                },
                {
                  label: "Schedule",
                  value:
                    team.averageDifficulty.toFixed(1) +
                    " average FDR over next six",
                  kind: "FACT" as const,
                },
              ]
            : [
                {
                  label: "Schedule",
                  value:
                    team.averageDifficulty.toFixed(1) +
                    " average FDR over next six",
                  kind: "FACT" as const,
                },
              ]
        }
        source={
          process
            ? "Footy canonical team-process layer · Official FPL fixtures"
            : "Official FPL fixtures"
        }
        confidence={
          process
            ? Math.round(process.sourceConfidence * 100) + "% SOURCE CONFIDENCE"
            : "FIXTURE DATA ONLY"
        }
        caveat={
          process
            ? "The attack/defence indices and trend are Footy model transformations of measured team process. Tactical claims are excluded when the feed does not measure them reliably."
            : "Footy is deliberately not making an underlying-process claim because reconciled team data is unavailable."
        }
      />

      {process ? (
        <>
          <section className="intel-grid">
            <Metric label="Attack" value={process.attackIndex.toFixed(2)} sub={(process.attackTrend >= 0 ? "+" : "") + Math.round(process.attackTrend * 100) + "% trend"} />
            <Metric label="Defence" value={process.defenceIndex.toFixed(2)} sub={(process.defenceTrend >= 0 ? "+" : "") + Math.round(process.defenceTrend * 100) + "% trend"} />
            <Metric label="npxG" value={process.metrics.npxg.toFixed(2)} />
            <Metric label="npxGA" value={process.metrics.npxga.toFixed(2)} />
            <Metric label="SOT" value={process.metrics.shotsOnTarget.toFixed(1)} />
            <Metric label="SOT conc." value={process.metrics.sotConceded.toFixed(1)} />
            <Metric label="Set xG" value={process.metrics.setPieceXg.toFixed(2)} />
            <Metric label="PPDA" value={process.metrics.ppda.toFixed(1)} />
          </section>

          <section className="intel-section">
            <div className="intel-section-head">
              <div>
                <span>PROCESS</span>
                <h3>Structured team data</h3>
              </div>
            </div>
            <div className="intel-stat-list">
              <p><span>xG / xGA</span><b>{process.metrics.xg.toFixed(2)} / {process.metrics.xga.toFixed(2)}</b></p>
              <p><span>npxG / npxGA</span><b>{process.metrics.npxg.toFixed(2)} / {process.metrics.npxga.toFixed(2)}</b></p>
              <p><span>Shots / SOT</span><b>{process.metrics.shots.toFixed(1)} / {process.metrics.shotsOnTarget.toFixed(1)}</b></p>
              <p><span>Big chances</span><b>{process.metrics.bigChances.toFixed(1)}</b></p>
              <p><span>Box touches</span><b>{process.metrics.boxTouches.toFixed(1)}</b></p>
              <p><span>Key passes</span><b>{process.metrics.keyPasses.toFixed(1)}</b></p>
              <p><span>xA</span><b>{process.metrics.xa.toFixed(2)}</b></p>
              <p><span>Territory proxy</span><b>{process.metrics.territoryProxy.toFixed(1)}%</b></p>
            </div>
          </section>
        </>
      ) : null}

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span>FIXTURES</span>
            <h3>Next eight Gameweeks</h3>
          </div>
        </div>
        <div className="intel-fixtures">
          {team.fixtures.map((fixture) => (
            <div key={fixture.eventId}>
              <span>{fixture.name}</span>
              <strong>{fixture.opponentShort} ({fixture.homeAway})</strong>
              <small>FDR {fixture.difficulty}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span>ASSETS</span>
            <h3>Players best placed to benefit</h3>
          </div>
        </div>
        <div className="intel-player-links">
          {players
            .filter((profile) => profile.player.teamName === team.team)
            .sort((a, b) => b.score6 - a.score6)
            .map((profile) => (
              <button
                type="button"
                key={profile.player.id}
                onClick={() => onOpenPlayer(profile)}
              >
                <span>
                  <b>{profile.player.name}</b>
                  <small>
                    {profile.player.position} · £{profile.player.price.toFixed(1)}m ·{" "}
                    {profile.reasons[0] ?? "Modelled from role, process and fixtures."}
                  </small>
                </span>
                <strong>{profile.score6.toFixed(1)} <small>6GW</small></strong>
              </button>
            ))}
        </div>
      </section>
    </DrawerShell>
  );
}

export function ManagerIntelDrawer({
  leagueId,
  standing,
  onClose,
}: {
  leagueId: number;
  standing: Standing | null;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<ManagerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!standing) return;
    const standingId = standing.entry_id;
    const controller = new AbortController();

    async function load() {
      try {
        setPayload(null);
        setError(null);
        const response = await fetch(
          "/api/league/" + leagueId + "/manager/" + standingId + "?staff=1",
          { cache: "no-store", signal: controller.signal },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Manager analysis unavailable.");
        setPayload(body);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Manager analysis unavailable.");
      }
    }

    void load();
    return () => controller.abort();
  }, [leagueId, standing]);

  if (!standing) return null;

  const history = payload?.resource_map?.find(
    (item) => item.standing.entry_id === standing.entry_id,
  )?.history;
  const manager = payload?.analysis?.manager;
  const target = payload?.target_standing;
  const chaser = payload?.chaser_standings?.[0];
  const read = history
    ? history.activity === "AGGRESSIVE"
      ? "This manager changes the team frequently and has already paid for moves. Their current squad can move quickly, but aggressive behaviour also creates hit-cost risk."
      : history.estimatedFreeTransfers >= 2
        ? "They have flexibility to react. Any ownership edge you have today may disappear quickly, so focus on durable football edges rather than temporary surprise."
        : "Their immediate flexibility looks limited. A strong move now can create separation before they can easily respond."
    : "Public resource history is incomplete, so Footy is not making a strong claim about their next move.";

  return (
    <DrawerShell
      kicker="OPPOSITION DOSSIER"
      title={standing.entry_name}
      onClose={onClose}
    >
      <section className="intel-summary">
        <div>
          <span>RANK #{standing.rank ?? "—"}</span>
          <h3>{standing.player_name || manager?.managerName || "FPL manager"}</h3>
          <p>{standing.total ?? "—"} pts · GW {standing.event_total ?? "—"}</p>
        </div>
      </section>

      <section className="intel-read">
        <span>FOOTY'S READ</span>
        <strong>{read}</strong>
      </section>

      <EvidenceBlock
        rows={[
          {
            label: "League position",
            value:
              "#" +
              (standing.rank ?? "—") +
              " · " +
              (standing.total ?? "—") +
              " pts",
            kind: "FACT",
          },
          {
            label: "Free-transfer flexibility",
            value:
              history?.estimatedFreeTransfers != null
                ? history.estimatedFreeTransfers +
                  " estimated FTs (" +
                  (history.freeTransferConfidence ?? "MEDIUM") +
                  ")"
                : "Unavailable",
            kind: "MODEL",
          },
          {
            label: "Transfer behaviour",
            value: history
              ? history.activity +
                " · -" +
                history.totalHitCost +
                " total hit cost"
              : "Unavailable",
            kind: history ? "FACT" : "MODEL",
          },
          {
            label: "Chip position",
            value: history
              ? history.currentHalfRemaining.length +
                " remaining · " +
                (history.currentHalfRemaining.join(", ") || "none")
              : "Unavailable",
            kind: "FACT",
          },
          {
            label: "Public squad",
            value:
              manager?.squad?.length != null
                ? manager.squad.length +
                  " players · captain " +
                  (manager.currentCaptain?.name ?? "unknown")
                : "Loading",
            kind: "FACT",
          },
        ]}
        source="Official/public FPL league standings, completed squad history, transfer history and chip history"
        confidence={
          history?.freeTransferConfidence
            ? history.freeTransferConfidence + " FT ESTIMATE CONFIDENCE"
            : "PUBLIC DATA ONLY"
        }
        caveat="Footy cannot see a rival's private transfer plan before the deadline. Free transfers are reconstructed from completed public history and are labelled as estimates."
      />

      <section className="intel-grid">
        <Metric label="Rank" value={"#" + (standing.rank ?? "—")} />
        <Metric label="Total" value={standing.total ?? "—"} />
        <Metric label="Est. FTs" value={history?.estimatedFreeTransfers ?? "—"} sub={history?.freeTransferConfidence ? history.freeTransferConfidence + " confidence" : undefined} />
        <Metric label="Hits" value={history ? "-" + history.totalHitCost : "—"} />
        <Metric label="Chips left" value={history?.currentHalfRemaining.length ?? "—"} />
        <Metric label="Activity" value={history?.activity ?? "—"} />
        <Metric label="Above" value={target?.entry_name ?? "—"} sub={target?.total != null && standing.total != null ? Math.max(0, target.total - standing.total) + " pts" : undefined} />
        <Metric label="Below" value={chaser?.entry_name ?? "—"} sub={chaser?.total != null && standing.total != null ? Math.max(0, standing.total - chaser.total) + " pts" : undefined} />
      </section>

      <section className="intel-section">
        <div className="intel-section-head">
          <div>
            <span>PUBLIC SQUAD</span>
            <h3>What they own now</h3>
          </div>
          <small>{manager?.currentCaptain ? "Captain " + manager.currentCaptain.name : ""}</small>
        </div>
        {!payload && !error ? <div className="intel-loading">Building opposition report…</div> : null}
        {error ? <div className="intel-error">{error}</div> : null}
        <div className="intel-manager-squad">
          {(manager?.squad ?? []).map((player) => (
            <Link key={player.id} href={"/research?player=" + player.id}>
              <span><b>{player.name}</b><small>{player.team} · {player.position} · £{player.price.toFixed(1)}m</small></span>
              <strong>{player.assistantScore.toFixed(1)}<small>Footy</small></strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="intel-two-col">
        <div>
          <span>RESOURCE EDGE</span>
          <p>{payload?.resource_advice?.recommendation ?? "No reliable resource comparison available."}</p>
          {history?.currentHalfRemaining.length ? (
            <p><b>Chips left:</b> {history.currentHalfRemaining.join(", ")}</p>
          ) : null}
        </div>
        <div>
          <span>WEAK LINKS / ROUTES</span>
          {(manager?.weakLinks ?? []).map((move) => (
            <p key={move.player.id}>
              <b>{move.player.name}</b>
              {move.replacement ? " → " + move.replacement.name : " · hold"}
              {move.timing ? " · " + move.timing : ""}
            </p>
          ))}
        </div>
      </section>

      <details className="intel-audit">
        <summary>Why this opposition report can help</summary>
        <p>
          Footy uses only public FPL information: current public squad after the
          deadline, completed transfer history, chips already used, estimated
          free transfers, points gaps and modelled player quality. It does not
          know a rival's private pre-deadline transfer intentions.
        </p>
      </details>
    </DrawerShell>
  );
}
