import React from "react";
import {
  AlertTriangle, ArrowRight, Check, Compass, Lock, Sparkles, Target,
} from "lucide-react";
import { C } from "../theme.js";
import { Panel, ProgressBar, Muted, Badge } from "../components/ui.jsx";
import { nextSteps, phaseTimeline, currentPhaseEntry } from "../domain/guidance.js";
import { activeSprint, sprintSummary, velocity } from "../domain/scrum.js";
import { projectProgress } from "../domain/selectors.js";

const LEVELS = {
  block: { color: C.red, icon: AlertTriangle, label: "Blokuje" },
  do: { color: C.amber, icon: Target, label: "Zrób teraz" },
  hint: { color: C.teal, icon: Sparkles, label: "Warto" },
};

export default function NowView({ project, onNavigate }) {
  const steps = nextSteps(project);
  const timeline = phaseTimeline(project);
  const current = currentPhaseEntry(project);
  const sprint = activeSprint(project);
  const progress = projectProgress(project);
  const v = velocity(project);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 860 }}>
        {/* --- gdzie jesteśmy --- */}
        <Panel accent={C.amber} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Compass size={16} color={C.amber} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {current
                ? `Faza ${current.phase.order} z ${project.phases.length}: ${current.phase.name}`
                : project.phases.length === 0
                  ? "Projekt nie ma zdefiniowanego procesu"
                  : "Proces zakończony"}
            </span>
          </div>

          {current?.phase.tip && (
            <div
              style={{
                fontSize: 13,
                color: C.muted,
                lineHeight: 1.6,
                background: C.elevated,
                border: `1px solid ${C.border}`,
                borderLeft: `2px solid ${C.amber}`,
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 12,
              }}
            >
              {current.phase.tip}
            </div>
          )}

          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12 }}>
            <Metric label="Postęp projektu" value={`${progress.pct}%`} sub={`${progress.done}/${progress.total} zadań`} />
            {current && (
              <Metric
                label="Bramka fazy"
                value={`${current.gate.criteriaChecked}/${current.gate.criteriaTotal}`}
                sub="kryteriów odhaczonych"
                color={current.gate.canClose ? C.green : C.amber}
              />
            )}
            {sprint && (
              <Metric
                label={`Sprint ${sprint.number}`}
                value={`${sprintSummary(project, sprint).completed}/${sprintSummary(project, sprint).committed} pkt`}
                sub={
                  sprintSummary(project, sprint).daysLeft != null
                    ? `${sprintSummary(project, sprint).daysLeft} dni do końca`
                    : "brak dat"
                }
              />
            )}
            {v.avg != null && (
              <Metric label="Velocity" value={`${v.avg} pkt`} sub={`średnia z ${v.samples} sprintów`} />
            )}
          </div>
        </Panel>

        {/* --- co teraz --- */}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Co teraz?</div>
        <Muted>
          Lista jest posortowana od tego, co blokuje proces. Kliknij krok, żeby przejść tam, gdzie
          się go wykonuje.
        </Muted>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0 24px" }}>
          {steps.length === 0 && (
            <Panel>
              <Muted>Nic nie blokuje i nic nie czeka. Rzadki stan — wykorzystaj go.</Muted>
            </Panel>
          )}
          {steps.map((step, i) => {
            const meta = LEVELS[step.level];
            const Icon = meta.icon;
            return (
              <div
                key={i}
                onClick={() => onNavigate(step.action)}
                className="hoverbox"
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderLeft: `2px solid ${meta.color}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  cursor: "pointer",
                }}
              >
                <Icon size={15} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{step.title}</span>
                    <Badge color={meta.color}>{meta.label}</Badge>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{step.detail}</div>
                </div>
                <ArrowRight size={14} color={C.mutedDim} style={{ flexShrink: 0, marginTop: 3 }} />
              </div>
            );
          })}
        </div>

        {/* --- oś procesu --- */}
        {timeline.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Proces</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {timeline.map(({ phase, gate, state }) => (
                <div
                  key={phase.id}
                  onClick={() => onNavigate({ view: "process", phaseId: phase.id })}
                  className="hoverbox"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 9,
                    background: state === "active" ? C.elevated : "transparent",
                    border: `1px solid ${state === "active" ? C.borderLight : C.border}`,
                    cursor: "pointer",
                    opacity: state === "locked" ? 0.5 : 1,
                  }}
                >
                  <PhaseMark state={state} order={phase.order} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: state === "active" ? 600 : 500 }}>
                      {phase.name}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: C.mutedDim, marginTop: 2 }}>
                      {gate.tasksDone}/{gate.tasksTotal} zadań · {gate.criteriaChecked}/
                      {gate.criteriaTotal} bramki
                    </div>
                  </div>
                  <div style={{ width: 90 }}>
                    <ProgressBar
                      pct={gate.tasksTotal ? (gate.tasksDone / gate.tasksTotal) * 100 : 0}
                      color={state === "done" ? C.green : C.amber}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PhaseMark({ state, order }) {
  const map = {
    done: { bg: `${C.green}22`, border: C.green, color: C.green },
    active: { bg: `${C.amber}22`, border: C.amber, color: C.amber },
    locked: { bg: C.elevated, border: C.border, color: C.mutedDim },
  };
  const s = map[state];
  return (
    <div
      className="mono"
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {state === "done" ? (
        <Check size={13} />
      ) : state === "locked" ? (
        <Lock size={12} />
      ) : (
        String(order).padStart(2, "0")
      )}
    </div>
  );
}

function Metric({ label, value, sub, color = C.text }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color, marginTop: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.mutedDim }}>{sub}</div>
    </div>
  );
}
