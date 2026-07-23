import React, { useState, useEffect } from "react";
import { Clock, Pause, Play, Send, Trash2, X, Link2, Ban } from "lucide-react";
import { C, STATUSES, PRIORITIES, TASK_TYPES, selectStyle, inputStyle } from "../theme.js";
import { Field, Badge } from "./ui.jsx";
import { formatDuration, formatDateTime } from "../lib/format.js";
import { taskTime, blockers } from "../domain/selectors.js";

export default function TaskModal({ task, project, team, dispatch, onClose }) {
  const [comment, setComment] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const running = !!task.timerStartedAt;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const patch = (p) =>
    dispatch({ type: "patchTask", projectId: project.id, taskId: task.id, patch: p });

  const phase = project.phases.find((p) => p.id === task.phaseId);
  const blocked = blockers(project, task);
  const candidates = project.tasks.filter((t) => t.id !== task.id);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(10,11,15,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
          width: 620, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 12 }}>
          <input
            value={task.title}
            onChange={(e) => patch({ title: e.target.value })}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: C.text, fontSize: 16, fontWeight: 600,
            }}
          />
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {phase && (
            <div className="mono" style={{ fontSize: 11, color: C.mutedDim }}>
              FAZA {String(phase.order).padStart(2, "0")} · {phase.name.toUpperCase()}
            </div>
          )}

          {blocked.length > 0 && (
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5,
                color: C.red, background: `${C.red}14`, border: `1px solid ${C.red}44`,
                borderRadius: 8, padding: "9px 11px",
              }}
            >
              <Ban size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Zablokowane przez: {blocked.map((b) => b.title).join(", ")}. Dokończ je najpierw.
              </span>
            </div>
          )}

          {/* --- pola --- */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Status">
              <select value={task.status} onChange={(e) => patch({ status: e.target.value })} style={selectStyle}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Typ">
              <select value={task.type} onChange={(e) => patch({ type: e.target.value })} style={selectStyle}>
                {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Priorytet">
              <select value={task.priority} onChange={(e) => patch({ priority: e.target.value })} style={selectStyle}>
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Właściciel">
              <select
                value={task.assignee || ""}
                onChange={(e) => patch({ assignee: e.target.value || null })}
                style={selectStyle}
              >
                <option value="">— brak —</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Faza">
              <select
                value={task.phaseId || ""}
                onChange={(e) => patch({ phaseId: e.target.value || null })}
                style={selectStyle}
              >
                <option value="">— poza fazami —</option>
                {[...project.phases].sort((a, b) => a.order - b.order).map((p) => (
                  <option key={p.id} value={p.id}>{p.order}. {p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Sprint">
              <select
                value={task.sprintId || ""}
                onChange={(e) => patch({ sprintId: e.target.value || null })}
                style={selectStyle}
              >
                <option value="">— backlog —</option>
                {project.sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    Sprint {s.number} {s.status === "active" ? "(aktywny)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Story points">
              <input
                type="number"
                min={0}
                value={task.points ?? ""}
                onChange={(e) => patch({ points: e.target.value === "" ? null : Number(e.target.value) })}
                style={{ ...selectStyle, width: 80 }}
              />
            </Field>
            <Field label="Estymata (godz.)">
              <input
                type="number"
                min={0}
                step={0.5}
                value={task.estimateH ?? ""}
                onChange={(e) => patch({ estimateH: e.target.value === "" ? null : Number(e.target.value) })}
                style={{ ...selectStyle, width: 90 }}
              />
            </Field>
            <Field label="Termin">
              <input
                type="date"
                value={task.dueDate || ""}
                onChange={(e) => patch({ dueDate: e.target.value || null })}
                style={selectStyle}
              />
            </Field>
          </div>

          {/* --- opis --- */}
          <div>
            <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Opis / kryteria akceptacji
            </div>
            <textarea
              value={task.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Jako… chcę… żeby…  Kryteria akceptacji: …"
              rows={3}
              style={{ ...inputStyle, fontSize: 13, resize: "vertical" }}
            />
          </div>

          {/* --- blokady --- */}
          {candidates.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Zablokowane przez
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  patch({ blockedBy: [...(task.blockedBy || []), e.target.value] });
                }}
                style={{ ...selectStyle, width: "100%" }}
              >
                <option value="">+ dodaj blokadę…</option>
                {candidates
                  .filter((t) => !(task.blockedBy || []).includes(t.id))
                  .map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {(task.blockedBy || []).map((id) => {
                  const t = project.tasks.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <span
                      key={id}
                      onClick={() => patch({ blockedBy: task.blockedBy.filter((b) => b !== id) })}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
                        fontSize: 11.5, padding: "3px 8px", borderRadius: 5,
                        border: `1px solid ${C.border}`,
                        color: t.status === "done" ? C.green : C.muted,
                      }}
                    >
                      {t.title} <X size={10} />
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- czas --- */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} color={C.muted} />
              <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                {formatDuration(taskTime(task))}
              </span>
              {task.estimateH != null && (
                <Badge color={taskTime(task) / 3600 > task.estimateH ? C.red : C.mutedDim}>
                  estymata {task.estimateH}g
                </Badge>
              )}
            </div>
            <button
              onClick={() => dispatch({ type: "toggleTimer", projectId: project.id, taskId: task.id })}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7,
                border: `1px solid ${running ? C.amber : C.borderLight}`,
                background: running ? `${C.amber}22` : "transparent",
                color: running ? C.amber : C.text, fontSize: 12.5, fontWeight: 600,
              }}
            >
              {running ? <Pause size={13} /> : <Play size={13} />}
              {running ? "Zatrzymaj" : "Start"}
            </button>
          </div>

          {/* --- linki --- */}
          <div>
            <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Linki (PR, issue, dokument)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
              {(task.links || []).map((l) => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                  <Link2 size={12} color={C.teal} />
                  <a href={l.url} target="_blank" rel="noreferrer" style={{ color: C.teal, flex: 1, wordBreak: "break-all" }}>
                    {l.label || l.url}
                  </a>
                  <button
                    onClick={() => dispatch({ type: "removeLink", projectId: project.id, taskId: task.id, linkId: l.id })}
                    style={{ background: "none", border: "none", color: C.mutedDim }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && linkUrl.trim()) {
                  dispatch({
                    type: "addLink",
                    projectId: project.id,
                    taskId: task.id,
                    url: linkUrl.trim(),
                    label: "",
                  });
                  setLinkUrl("");
                }
              }}
              placeholder="+ wklej URL i Enter"
              style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px" }}
            />
          </div>

          {/* --- komentarze --- */}
          <div>
            <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Komentarze · dziennik zmian
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {task.comments.length === 0 && (
                <div style={{ fontSize: 12.5, color: C.mutedDim }}>Brak komentarzy.</div>
              )}
              {task.comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 8, fontSize: 12.5 }}>
                  <span className="mono" style={{ color: C.teal, flexShrink: 0 }}>#{c.id.slice(0, 5)}</span>
                  <div>
                    <div style={{ color: C.text }}>{c.text}</div>
                    <div className="mono" style={{ color: C.mutedDim, fontSize: 10.5, marginTop: 1 }}>
                      {formatDateTime(c.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && comment.trim()) {
                    dispatch({ type: "addComment", projectId: project.id, taskId: task.id, text: comment.trim() });
                    setComment("");
                  }
                }}
                placeholder="Dodaj komentarz…"
                style={{ ...inputStyle, fontSize: 12.5, padding: "8px 10px" }}
              />
              <button
                onClick={() => {
                  if (!comment.trim()) return;
                  dispatch({ type: "addComment", projectId: project.id, taskId: task.id, text: comment.trim() });
                  setComment("");
                }}
                style={{ background: C.amber, border: "none", borderRadius: 7, padding: "0 12px", color: C.bg }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => {
              if (confirm("Usunąć zadanie?")) {
                dispatch({ type: "deleteTask", projectId: project.id, taskId: task.id });
                onClose();
              }
            }}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 12px",
              color: C.red, fontSize: 12.5,
            }}
          >
            <Trash2 size={13} /> Usuń zadanie
          </button>
        </div>
      </div>
    </div>
  );
}
