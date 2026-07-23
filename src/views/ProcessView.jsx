import React, { useState } from "react";
import { Check, Lock, Plus, Trash2, Unlock, ShieldCheck, AlertTriangle } from "lucide-react";
import { C, inputStyle, primaryButton, ghostButton } from "../theme.js";
import { Panel, ProgressBar, Muted, Check as CheckBox } from "../components/ui.jsx";
import { phaseTimeline } from "../domain/guidance.js";
import { formatDate } from "../lib/format.js";

export default function ProcessView({ project, dispatch, focusPhaseId, onOpenTask, onClosePhase }) {
  const timeline = phaseTimeline(project);
  const [newPhase, setNewPhase] = useState("");

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 820 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Proces produkcji</div>
        <Muted>
          Każda faza ma bramkę — listę warunków wyjścia. Faza domyka się dopiero, gdy zadania są
          zrobione <em>i</em> wszystkie kryteria odhaczone. To celowe: zrobione zadania bez
          spełnionej bramki to najczęstszy sposób na przepchnięcie niedokończonej fazy dalej.
        </Muted>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "18px 0" }}>
          {timeline.length === 0 && (
            <Panel>
              <Muted>
                Ten projekt nie ma faz. Dodaj je poniżej albo załóż nowy projekt na bazie szablonu,
                który już zawiera sprawdzony proces.
              </Muted>
            </Panel>
          )}

          {timeline.map((entry) => (
            <PhaseCard
              key={entry.phase.id}
              entry={entry}
              project={project}
              dispatch={dispatch}
              defaultOpen={entry.state === "active" || entry.phase.id === focusPhaseId}
              onOpenTask={onOpenTask}
              onClose={() => onClosePhase(entry.phase.id)}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newPhase}
            onChange={(e) => setNewPhase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newPhase.trim()) {
                dispatch({ type: "addPhase", projectId: project.id, name: newPhase.trim() });
                setNewPhase("");
              }
            }}
            placeholder="Nazwa nowej fazy…"
            style={inputStyle}
          />
          <button
            onClick={() => {
              if (!newPhase.trim()) return;
              dispatch({ type: "addPhase", projectId: project.id, name: newPhase.trim() });
              setNewPhase("");
            }}
            disabled={!newPhase.trim()}
            style={{ ...primaryButton(Boolean(newPhase.trim())), whiteSpace: "nowrap" }}
          >
            <Plus size={14} /> Dodaj fazę
          </button>
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ entry, project, dispatch, defaultOpen, onOpenTask, onClose }) {
  const { phase, gate, state } = entry;
  const [open, setOpen] = useState(defaultOpen);
  const [newCriterion, setNewCriterion] = useState("");

  const stateColor = state === "done" ? C.green : state === "active" ? C.amber : C.mutedDim;
  const openTasks = gate.blockers.find((b) => b.kind === "tasks")?.tasks || [];

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${state === "active" ? C.borderLight : C.border}`,
        borderLeft: `2px solid ${stateColor}`,
        borderRadius: 10,
        opacity: state === "locked" ? 0.72 : 1,
      }}
    >
      {/* nagłówek */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, cursor: "pointer" }}
      >
        <div
          className="mono"
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: state === "done" ? `${C.green}22` : C.elevated,
            border: `1px solid ${stateColor}`,
            color: stateColor, fontSize: 11, fontWeight: 700,
          }}
        >
          {state === "done" ? <Check size={14} /> : state === "locked" ? <Lock size={12} /> : String(phase.order).padStart(2, "0")}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{phase.name}</span>
            {state === "active" && (
              <span style={{ fontSize: 10.5, color: C.amber, fontWeight: 600 }}>← TU JESTEŚ</span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: C.mutedDim, marginTop: 3 }}>
            {gate.tasksDone}/{gate.tasksTotal} zadań · bramka {gate.criteriaChecked}/{gate.criteriaTotal}
            {phase.completedAt && ` · domknięta ${formatDate(new Date(phase.completedAt).toISOString())}`}
          </div>
        </div>

        <div style={{ width: 90, flexShrink: 0 }}>
          <ProgressBar
            pct={gate.tasksTotal ? (gate.tasksDone / gate.tasksTotal) * 100 : 0}
            color={state === "done" ? C.green : C.amber}
          />
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${C.border}` }}>
          {phase.tip && (
            <div
              style={{
                fontSize: 12.5, color: C.muted, lineHeight: 1.55, marginTop: 12,
                background: C.elevated, border: `1px solid ${C.border}`,
                borderLeft: `2px solid ${C.amber}`, borderRadius: 6, padding: "10px 12px",
              }}
            >
              {phase.tip}
            </div>
          )}

          {/* bramka */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <ShieldCheck size={14} color={C.teal} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Bramka wyjścia</span>
            </div>
            {phase.gate && (
              <Muted size={12}>
                <span style={{ display: "block", marginBottom: 10 }}>{phase.gate}</span>
              </Muted>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {phase.criteria.length === 0 && (
                <Muted size={12}>
                  Ta faza nie ma kryteriów — domknie się, gdy tylko zadania będą zrobione. Dopisz
                  warunki, jeśli chcesz, żeby program pilnował czegoś więcej.
                </Muted>
              )}
              {phase.criteria.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <CheckBox
                      checked={c.checked}
                      disabled={state === "locked"}
                      onChange={() =>
                        dispatch({
                          type: "toggleCriterion",
                          projectId: project.id,
                          phaseId: phase.id,
                          criterionId: c.id,
                        })
                      }
                      label={c.text}
                      sub={c.checkedAt ? `odhaczone ${new Date(c.checkedAt).toLocaleString("pl-PL")}` : null}
                    />
                  </div>
                  <button
                    onClick={() =>
                      dispatch({
                        type: "deleteCriterion",
                        projectId: project.id,
                        phaseId: phase.id,
                        criterionId: c.id,
                      })
                    }
                    style={{ background: "none", border: "none", color: C.mutedDim, padding: 2 }}
                    title="Usuń kryterium"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCriterion.trim()) {
                    dispatch({
                      type: "addCriterion",
                      projectId: project.id,
                      phaseId: phase.id,
                      text: newCriterion.trim(),
                    });
                    setNewCriterion("");
                  }
                }}
                placeholder="+ dodaj kryterium wyjścia i Enter"
                style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px" }}
              />
            </div>
          </div>

          {/* co blokuje */}
          {openTasks.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <AlertTriangle size={14} color={C.amber} />
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  Niezrobione zadania fazy ({openTasks.length})
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {openTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => onOpenTask(t.id)}
                    className="hoverbox"
                    style={{
                      fontSize: 12.5, color: C.muted, padding: "6px 9px",
                      borderRadius: 6, border: `1px solid ${C.border}`, cursor: "pointer",
                    }}
                  >
                    {t.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* akcja domknięcia */}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
            {state === "done" ? (
              <button
                onClick={() =>
                  dispatch({ type: "reopenPhase", projectId: project.id, phaseId: phase.id })
                }
                style={ghostButton}
              >
                <Unlock size={13} /> Otwórz fazę ponownie
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={!gate.canClose}
                  style={primaryButton(gate.canClose)}
                  title={gate.canClose ? "" : "Bramka nie jest spełniona"}
                >
                  <Check size={14} /> Domknij fazę
                </button>
                {!gate.canClose && (
                  <span style={{ fontSize: 12, color: C.mutedDim }}>
                    {gate.blockers.map((b) => b.text).join(" ")}
                  </span>
                )}
              </>
            )}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                if (confirm(`Usunąć fazę „${phase.name}"? Zadania zostaną, stracą tylko przypisanie.`)) {
                  dispatch({ type: "deletePhase", projectId: project.id, phaseId: phase.id });
                }
              }}
              style={{ background: "none", border: "none", color: C.mutedDim, padding: 4 }}
              title="Usuń fazę"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
