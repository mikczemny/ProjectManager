import React from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { C, primaryButton } from "../theme.js";
import { Avatar, Panel, Muted, SectionTitle, Badge, ProgressBar } from "../components/ui.jsx";
import { memberWorkload } from "../domain/selectors.js";
import { formatHours } from "../lib/format.js";
import WorkspaceAccess from "../components/WorkspaceAccess.jsx";

export default function TeamView({ project, team, dispatch, onAdd, cloud }) {
  const loads = team.map((m) => ({ member: m, load: memberWorkload(project, m.id) }));
  const maxOpen = Math.max(1, ...loads.map((l) => l.load.open));
  const unassigned = project.tasks.filter((t) => t.status !== "done" && !t.assignee);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 760 }}>
        <SectionTitle
          right={
            <button onClick={onAdd} style={primaryButton(true)}>
              <Plus size={14} /> Dodaj osobę
            </button>
          }
        >
          Zespół i obciążenie
        </SectionTitle>
        <Muted>
          Obciążenie liczone jest z otwartych zadań w tym projekcie. Nierówny rozkład to nie kwestia
          sprawiedliwości — to ryzyko, że wszystko zatrzyma się na jednej osobie.
        </Muted>

        {unassigned.length > 0 && (
          <Panel accent={C.amber} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
              <AlertTriangle size={14} color={C.amber} />
              <span>
                {unassigned.length} otwartych zadań nie ma właściciela. Zadanie niczyje nie zostanie
                zrobione.
              </span>
            </div>
          </Panel>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {team.length === 0 && (
            <Muted>Brak osób w zespole. Dodaj pierwszą, żeby zacząć przypisywać zadania.</Muted>
          )}

          {loads.map(({ member, load }) => (
            <Panel key={member.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar member={member} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{member.name}</span>
                    {load.overdue > 0 && <Badge color={C.red}>{load.overdue} po terminie</Badge>}
                  </div>
                  <input
                    value={member.role}
                    onChange={(e) =>
                      dispatch({ type: "patchMember", memberId: member.id, patch: { role: e.target.value } })
                    }
                    placeholder="rola w zespole…"
                    style={{
                      background: "transparent", border: "none", outline: "none",
                      color: C.mutedDim, fontSize: 11.5, padding: 0, marginTop: 2, width: "100%",
                    }}
                  />
                </div>
                <div style={{ width: 110, flexShrink: 0 }}>
                  <ProgressBar pct={(load.open / maxOpen) * 100} color={C.teal} />
                  <div className="mono" style={{ fontSize: 10, color: C.mutedDim, marginTop: 4, textAlign: "right" }}>
                    {load.open} otwartych · {load.done} zrobionych
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: C.mutedDim, textAlign: "right" }}>
                    {formatHours(load.timeH)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Usunąć ${member.name}? Jej/jego zadania zostaną bez właściciela.`)) {
                      dispatch({ type: "removeMember", memberId: member.id });
                    }
                  }}
                  style={{ background: "none", border: "none", color: C.mutedDim }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Panel>
          ))}
        </div>

        {cloud && <WorkspaceAccess cloud={cloud} />}
      </div>
    </div>
  );
}
