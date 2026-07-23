import React, { useState } from "react";
import { Play, Plus, Trash2, Flag, ArrowDown, ArrowUp, Repeat, TrendingUp } from "lucide-react";
import { C, inputStyle, primaryButton, ghostButton, selectStyle } from "../theme.js";
import { Panel, Muted, ProgressBar, Badge, Check as CheckBox, SectionTitle } from "../components/ui.jsx";
import {
  activeSprint, sprintSummary, backlogTasks, velocity, burndown, points,
} from "../domain/scrum.js";
import { formatDate } from "../lib/format.js";
import { PRIORITIES } from "../theme.js";

export default function SprintView({ project, dispatch, onOpenTask }) {
  const sprint = activeSprint(project);
  const planned = project.sprints.filter((s) => s.status === "planned");
  const closed = project.sprints.filter((s) => s.status === "closed");
  const backlog = backlogTasks(project).filter((t) => t.status !== "done");
  const v = velocity(project);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 900 }}>
        {sprint ? (
          <ActiveSprint project={project} sprint={sprint} dispatch={dispatch} onOpenTask={onOpenTask} velocityAvg={v.avg} />
        ) : (
          <Panel accent={C.amber} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Żaden sprint nie jest aktywny
            </div>
            <Muted>
              Fazy mówią, CO ma być zrobione. Sprint mówi, KIEDY. Bez aktywnego sprintu praca nie ma
              ram czasowych, a velocity nie ma z czego się policzyć.
            </Muted>
            <button
              onClick={() => dispatch({ type: "createSprint", projectId: project.id })}
              style={{ ...primaryButton(true), marginTop: 12 }}
            >
              <Plus size={14} /> Zaplanuj sprint
            </button>
          </Panel>
        )}

        {/* --- zaplanowane sprinty --- */}
        {planned.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <SectionTitle>Zaplanowane</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {planned.map((s) => {
                const sum = sprintSummary(project, s);
                return (
                  <Panel key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        Sprint {s.number}
                        {s.goal ? ` — ${s.goal}` : ""}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: C.mutedDim, marginTop: 2 }}>
                        {formatDate(s.startDate)} → {formatDate(s.endDate)} · {sum.committed} pkt ·{" "}
                        {sum.tasks.length} zadań
                      </div>
                    </div>
                    <button
                      onClick={() => dispatch({ type: "startSprint", projectId: project.id, sprintId: s.id })}
                      style={primaryButton(true)}
                    >
                      <Play size={13} /> Start
                    </button>
                    <button
                      onClick={() => dispatch({ type: "deleteSprint", projectId: project.id, sprintId: s.id })}
                      style={{ background: "none", border: "none", color: C.mutedDim }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </Panel>
                );
              })}
            </div>
          </div>
        )}

        {/* --- backlog --- */}
        <SectionTitle
          right={
            !sprint && planned.length === 0 ? null : (
              <span className="mono" style={{ fontSize: 11, color: C.mutedDim }}>
                {points(backlog)} pkt w backlogu
              </span>
            )
          }
        >
          Backlog produktu ({backlog.length})
        </SectionTitle>
        <Muted>
          Zadania, które nie są wzięte na żaden sprint. Uporządkowany backlog to warunek sensownego
          planowania — góra listy powinna być gotowa do wzięcia od ręki.
        </Muted>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12, marginBottom: 24 }}>
          {backlog.length === 0 && <Muted size={12.5}>Backlog jest pusty.</Muted>}
          {backlog.map((t) => (
            <BacklogRow
              key={t.id}
              task={t}
              project={project}
              dispatch={dispatch}
              onOpenTask={onOpenTask}
              targetSprint={sprint || planned[0] || null}
            />
          ))}
        </div>

        {/* --- historia i velocity --- */}
        {closed.length > 0 && (
          <>
            <SectionTitle
              right={
                v.avg != null && (
                  <span className="mono" style={{ fontSize: 11, color: C.teal }}>
                    <TrendingUp size={11} style={{ verticalAlign: -1 }} /> średnia {v.avg} pkt
                  </span>
                )
              }
            >
              Historia sprintów
            </SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {closed
                .slice()
                .sort((a, b) => b.number - a.number)
                .map((s) => {
                  const sum = sprintSummary(project, s);
                  const hit = sum.committed > 0 ? sum.completed / sum.committed : 1;
                  return (
                    <Panel key={s.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>
                            Sprint {s.number}
                            {s.goal ? ` — ${s.goal}` : ""}
                          </div>
                          <div className="mono" style={{ fontSize: 10.5, color: C.mutedDim, marginTop: 2 }}>
                            {formatDate(s.startDate)} → {formatDate(s.endDate)}
                          </div>
                        </div>
                        <Badge color={hit >= 0.8 ? C.green : hit >= 0.6 ? C.amber : C.red}>
                          {sum.completed}/{sum.committed} pkt
                        </Badge>
                      </div>
                      {s.retroNotes && (
                        <div
                          style={{
                            fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 10,
                            background: C.elevated, borderRadius: 6, padding: "8px 10px",
                            borderLeft: `2px solid ${C.purple}`,
                          }}
                        >
                          <strong style={{ color: C.purple }}>Retro:</strong> {s.retroNotes}
                        </div>
                      )}
                    </Panel>
                  );
                })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function ActiveSprint({ project, sprint, dispatch, onOpenTask, velocityAvg }) {
  const sum = sprintSummary(project, sprint);
  const chart = burndown(project, sprint);
  const [goal, setGoal] = useState(sprint.goal);
  const [retro, setRetro] = useState(sprint.retroNotes);

  const patch = (p) => dispatch({ type: "patchSprint", projectId: project.id, sprintId: sprint.id, patch: p });

  const late = sum.daysLeft != null && sum.daysLeft < 0;

  return (
    <Panel accent={late ? C.red : C.amber} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Flag size={16} color={C.amber} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>Sprint {sprint.number}</span>
        <Badge color={late ? C.red : C.green}>
          {sum.daysLeft == null
            ? "brak dat"
            : late
              ? `${Math.abs(sum.daysLeft)} dni po terminie`
              : `${sum.daysLeft} dni do końca`}
        </Badge>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            if (confirm("Domknąć sprint? Niedowiezione zadania wrócą do backlogu.")) {
              dispatch({ type: "closeSprint", projectId: project.id, sprintId: sprint.id });
            }
          }}
          style={ghostButton}
        >
          <Repeat size={13} /> Domknij sprint
        </button>
      </div>

      {/* cel */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
          Cel sprintu
        </div>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onBlur={() => patch({ goal })}
          placeholder="Jedno zdanie, które zespół umie powtórzyć z pamięci…"
          style={inputStyle}
        />
      </div>

      {/* daty */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10.5, color: C.mutedDim, marginBottom: 4 }}>START</div>
          <input
            type="date"
            value={sprint.startDate || ""}
            onChange={(e) => patch({ startDate: e.target.value || null })}
            style={selectStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: C.mutedDim, marginBottom: 4 }}>KONIEC</div>
          <input
            type="date"
            value={sprint.endDate || ""}
            onChange={(e) => patch({ endDate: e.target.value || null })}
            style={selectStyle}
          />
        </div>
      </div>

      {/* postęp */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <ProgressBar pct={sum.pct} color={late ? C.red : C.green} height={6} />
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
          {sum.completed}/{sum.committed} pkt
        </span>
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: C.mutedDim, marginBottom: 14 }}>
        {sum.done.length}/{sum.tasks.length} zadań zrobionych
        {velocityAvg != null && ` · velocity ${velocityAvg} pkt`}
        {velocityAvg != null && sum.committed > velocityAvg * 1.2 && (
          <span style={{ color: C.red }}> · wzięto więcej niż średnia velocity</span>
        )}
      </div>

      {chart && chart.committed > 0 && <Burndown chart={chart} />}

      {/* ceremonie */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10.5, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          Ceremonie
        </div>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          {sprint.ceremonies.map((c) => (
            <CheckBox
              key={c.key}
              checked={c.done}
              label={c.label}
              onChange={() =>
                dispatch({ type: "toggleCeremony", projectId: project.id, sprintId: sprint.id, key: c.key })
              }
            />
          ))}
        </div>
      </div>

      {/* retro */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10.5, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
          Wnioski z retrospektywy
        </div>
        <textarea
          value={retro}
          onChange={(e) => setRetro(e.target.value)}
          onBlur={() => patch({ retroNotes: retro })}
          rows={2}
          placeholder="Co poprawiamy w kolejnym sprincie? Wniosek bez zadania to tylko westchnienie."
          style={{ ...inputStyle, fontSize: 12.5, resize: "vertical" }}
        />
      </div>

      {/* zadania sprintu */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10.5, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          Zakres sprintu ({sum.tasks.length})
        </div>
        {sum.tasks.length === 0 && (
          <Muted size={12.5}>Sprint jest pusty — weź zadania z backlogu poniżej.</Muted>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sum.tasks.map((t) => (
            <div
              key={t.id}
              className="hoverbox"
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                borderRadius: 7, border: `1px solid ${C.border}`, background: C.elevated,
              }}
            >
              <span
                onClick={() => onOpenTask(t.id)}
                style={{
                  flex: 1, fontSize: 12.5, cursor: "pointer",
                  color: t.status === "done" ? C.mutedDim : C.text,
                  textDecoration: t.status === "done" ? "line-through" : "none",
                }}
              >
                {t.title}
              </span>
              {t.points != null && (
                <Badge color={C.teal}>{t.points} pkt</Badge>
              )}
              <button
                title="Zdejmij ze sprintu"
                onClick={() =>
                  dispatch({ type: "patchTask", projectId: project.id, taskId: t.id, patch: { sprintId: null } })
                }
                style={{ background: "none", border: "none", color: C.mutedDim, display: "flex" }}
              >
                <ArrowDown size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Prosty burndown w SVG — bez zewnętrznej biblioteki wykresów. */
function Burndown({ chart }) {
  const W = 520;
  const H = 110;
  const pad = { l: 26, r: 8, t: 8, b: 16 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(chart.committed, 1);
  const x = (d) => pad.l + (d / chart.days) * iw;
  const y = (v) => pad.t + ih - (v / max) * ih;

  const actual = chart.series.filter((p) => p.actual != null);
  const line = (pts, key) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day)},${y(p[key])}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 320, height: H }}>
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ih} stroke={C.border} />
        <line x1={pad.l} y1={pad.t + ih} x2={W - pad.r} y2={pad.t + ih} stroke={C.border} />
        <text x={2} y={pad.t + 8} fill={C.mutedDim} fontSize={9} fontFamily="monospace">
          {chart.committed}
        </text>
        <text x={2} y={pad.t + ih} fill={C.mutedDim} fontSize={9} fontFamily="monospace">
          0
        </text>
        <path d={line(chart.series, "ideal")} fill="none" stroke={C.mutedDim} strokeWidth={1} strokeDasharray="3 3" />
        {actual.length > 0 && (
          <path d={line(actual, "actual")} fill="none" stroke={C.amber} strokeWidth={2} />
        )}
      </svg>
      <div className="mono" style={{ fontSize: 10, color: C.mutedDim, marginTop: -4 }}>
        <span style={{ color: C.amber }}>——</span> rzeczywiste pozostałe punkty ·{" "}
        <span>- - -</span> linia idealna
      </div>
    </div>
  );
}

function BacklogRow({ task, project, dispatch, onOpenTask, targetSprint }) {
  const prio = PRIORITIES[task.priority];
  return (
    <div
      className="hoverbox"
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
        borderRadius: 7, border: `1px solid ${C.border}`, background: C.panel,
      }}
    >
      <span onClick={() => onOpenTask(task.id)} style={{ flex: 1, fontSize: 12.5, cursor: "pointer" }}>
        {task.title}
      </span>
      <Badge color={prio.color}>{prio.label}</Badge>
      {task.points != null ? (
        <Badge color={C.teal}>{task.points} pkt</Badge>
      ) : (
        <Badge color={C.mutedDim}>bez estymaty</Badge>
      )}
      {targetSprint && (
        <button
          title={`Weź na sprint ${targetSprint.number}`}
          onClick={() =>
            dispatch({
              type: "patchTask",
              projectId: project.id,
              taskId: task.id,
              patch: { sprintId: targetSprint.id },
            })
          }
          style={{ background: "none", border: "none", color: C.teal, display: "flex" }}
        >
          <ArrowUp size={14} />
        </button>
      )}
    </div>
  );
}
