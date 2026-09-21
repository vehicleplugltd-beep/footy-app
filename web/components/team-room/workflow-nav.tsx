type WorkflowPhase = "decision" | "plan" | "test" | "review";

const workflowItems: Array<{
  key: WorkflowPhase;
  step: string;
  label: string;
  hint: string;
  href: string;
}> = [
  { key: "decision", step: "1", label: "Decide", hint: "What now", href: "#decision" },
  { key: "plan", step: "2", label: "Plan", hint: "Path + risk", href: "#plan" },
  { key: "test", step: "3", label: "Test", hint: "What-If", href: "#what-if" },
  { key: "review", step: "4", label: "Review", hint: "Decision quality", href: "#audit" },
];

export function TeamRoomWorkflowRail({
  active,
}: {
  active: WorkflowPhase;
}) {
  return (
    <nav className="team-room-section-rail" aria-label="Team Room decision workflow">
      {workflowItems.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={active === item.key ? "active" : undefined}
          aria-current={active === item.key ? "step" : undefined}
        >
          <i>{item.step}</i>
          <span>
            <b>{item.label}</b>
            <small>{item.hint}</small>
          </span>
        </a>
      ))}
    </nav>
  );
}

export function TeamRoomMobileDock({
  active,
  decisionLabel,
  posture,
  reviewLabel,
}: {
  active: WorkflowPhase;
  decisionLabel: string;
  posture: string;
  reviewLabel: string;
}) {
  return (
    <aside className="team-room-mobile-dock" aria-label="Team Room workflow">
      <a
        className={
          "team-room-mobile-dock-action " +
          (active === "decision" ? "active" : "")
        }
        href="#decision"
      >
        <span>DECIDE</span>
        <strong>{decisionLabel}</strong>
      </a>
      <a className={active === "plan" ? "active" : ""} href="#plan">
        <span>PLAN</span>
        <strong>{posture}</strong>
      </a>
      <a className={active === "test" ? "active" : ""} href="#what-if">
        <span>TEST</span>
        <strong>What-If</strong>
      </a>
      <a className={active === "review" ? "active" : ""} href="#audit">
        <span>REVIEW</span>
        <strong>{reviewLabel}</strong>
      </a>
    </aside>
  );
}

export type { WorkflowPhase };
