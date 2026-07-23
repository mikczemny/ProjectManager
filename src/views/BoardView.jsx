import React, { useState } from "react";
import { Filter, X } from "lucide-react";
import { C, STATUSES, PRIORITIES, TASK_TYPES, selectStyle } from "../theme.js";
import TaskCard from "../components/TaskCard.jsx";
import { filterTasks, isFilterActive } from "../domain/selectors.js";
import { activeSprint } from "../domain/scrum.js";
import { Badge } from "../components/ui.jsx";

export default function BoardView({ project, team, dispatch, filter, setFilter, onOpenTask, currentUserId }) {
  const [dragOver, setDragOver] = useState(null);
  const [newTask, setNewTask] = useState("");
  const sprint = activeSprint(project);

  const scoped = filter.sprintOnly && sprint
    ? project.tasks.filter((t) => t.sprintId === sprint.id)
    : project.tasks;
  const visible = filterTasks(scoped, filter);

  const phaseById = (id) => project.phases.find((p) => p.id === id) || null;

  const set = (patch) => setFilter((f) => ({ ...f, ...patch }));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* --- filtry --- */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
          borderBottom: `1px solid ${C.border}`, flexWrap: "wrap",
        }}
      >
        <Filter size={13} color={C.mutedDim} />
        <input
          value={filter.text || ""}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="Szukaj…"
          style={{ ...selectStyle, width: 150 }}
        />
        <select value={filter.assignee || ""} onChange={(e) => set({ assignee: e.target.value || null })} style={selectStyle}>
          <option value="">Każdy</option>
          <option value="__none__">Bez właściciela</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={filter.priority || ""} onChange={(e) => set({ priority: e.target.value || null })} style={selectStyle}>
          <option value="">Każdy priorytet</option>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filter.type || ""} onChange={(e) => set({ type: e.target.value || null })} style={selectStyle}>
          <option value="">Każdy typ</option>
          {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {project.phases.length > 0 && (
          <select value={filter.phaseId || ""} onChange={(e) => set({ phaseId: e.target.value || null })} style={selectStyle}>
            <option value="">Każda faza</option>
            <option value="__none__">Bez fazy</option>
            {[...project.phases].sort((a, b) => a.order - b.order).map((p) => (
              <option key={p.id} value={p.id}>{p.order}. {p.name}</option>
            ))}
          </select>
        )}
        <Toggle active={!!filter.overdueOnly} onClick={() => set({ overdueOnly: !filter.overdueOnly })} color={C.red}>
          Po terminie
        </Toggle>
        {sprint && (
          <Toggle active={!!filter.sprintOnly} onClick={() => set({ sprintOnly: !filter.sprintOnly })} color={C.amber}>
            Tylko sprint {sprint.number}
          </Toggle>
        )}
        {(isFilterActive(filter) || filter.sprintOnly) && (
          <button
            onClick={() => setFilter({})}
            style={{ background: "none", border: "none", color: C.mutedDim, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
          >
            <X size={12} /> wyczyść
          </button>
        )}
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: C.mutedDim }}>
          {visible.length}/{project.tasks.length} zadań
        </span>
      </div>

      {/* --- kolumny --- */}
      <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
        <div style={{ display: "flex", gap: 14, minWidth: 900, height: "100%" }}>
          {STATUSES.map((col) => {
            const tasks = visible.filter((t) => t.status === col.key);
            const isOver = dragOver === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData("text/task");
                  if (taskId) {
                    dispatch({ type: "moveTask", projectId: project.id, taskId, status: col.key });
                  }
                  setDragOver(null);
                }}
                style={{
                  flex: 1, minWidth: 240,
                  background: isOver ? C.elevated : C.panel,
                  border: `1px solid ${isOver ? col.color : C.border}`,
                  borderRadius: 12, display: "flex", flexDirection: "column",
                  transition: "background 0.12s, border-color 0.12s",
                }}
              >
                <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: C.mutedDim }}>{tasks.length}</span>
                  <div style={{ flex: 1 }} />
                  {col.key === "inprogress" && tasks.length > 5 && (
                    <Badge color={C.red}>za dużo naraz</Badge>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      project={project}
                      team={team}
                      phase={phaseById(task.phaseId)}
                      currentUserId={currentUserId}
                      onOpen={() => onOpenTask(task.id)}
                      onToggleTimer={() =>
                        dispatch({
                          type: "toggleTimer",
                          projectId: project.id,
                          taskId: task.id,
                          userId: currentUserId,
                        })
                      }
                    />
                  ))}
                </div>

                {col.key === "todo" && (
                  <div style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>
                    <input
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newTask.trim()) {
                          dispatch({
                            type: "addTask",
                            projectId: project.id,
                            title: newTask.trim(),
                            // Nowe zadanie ląduje w fazie, na którą patrzymy —
                            // inaczej wypadałoby poza proces.
                            phaseId: filter.phaseId && filter.phaseId !== "__none__" ? filter.phaseId : null,
                          });
                          setNewTask("");
                        }
                      }}
                      placeholder="+ dodaj zadanie i Enter"
                      style={{
                        width: "100%", background: "transparent", border: "none",
                        outline: "none", fontSize: 12.5, color: C.muted, padding: 4,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Toggle({ active, onClick, children, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, padding: "6px 10px", borderRadius: 7,
        border: `1px solid ${active ? color : C.border}`,
        background: active ? `${color}22` : "transparent",
        color: active ? color : C.muted,
      }}
    >
      {children}
    </button>
  );
}
