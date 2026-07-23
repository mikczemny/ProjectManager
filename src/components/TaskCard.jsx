import React, { useState, useEffect } from "react";
import { Pause, Play, MessageSquare, CalendarClock, Ban } from "lucide-react";
import { C, PRIORITIES, TASK_TYPES } from "../theme.js";
import { formatDuration, formatDate, daysUntil } from "../lib/format.js";
import { Avatar, Badge } from "./ui.jsx";
import { taskTime, isOverdue, isDueSoon, blockers, isTimerRunning } from "../domain/selectors.js";

export default function TaskCard({ task, project, team, phase, onOpen, onToggleTimer, currentUserId }) {
  // Zielony timer oznacza „ja mierzę". Pomiar kolegi widać w sumie czasu,
  // ale przycisk nie udaje, że jest twój.
  const running = isTimerRunning(task, currentUserId);
  const anyRunning = isTimerRunning(task);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  const member = team.find((m) => m.id === task.assignee);
  const prio = PRIORITIES[task.priority];
  const type = TASK_TYPES[task.type] || TASK_TYPES.feature;
  const overdue = isOverdue(task);
  const dueSoon = isDueSoon(task);
  const blocked = blockers(project, task);

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
      onClick={onOpen}
      className="hoverbox"
      style={{
        background: C.elevated,
        border: `1px solid ${overdue ? C.red : C.border}`,
        borderRadius: 9,
        padding: "10px 11px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span className="mono" style={{ fontSize: 9.5, color: type.color, fontWeight: 700, letterSpacing: 0.4 }}>
          {type.short}
        </span>
        {phase && (
          <span className="mono" style={{ fontSize: 9.5, color: C.mutedDim, letterSpacing: 0.3 }}>
            · {String(phase.order).padStart(2, "0")} {phase.name.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, marginBottom: 8 }}>
        {task.title}
      </div>

      {blocked.length > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 5, fontSize: 11,
            color: C.red, marginBottom: 6,
          }}
        >
          <Ban size={11} /> zablokowane przez {blocked.length}
        </div>
      )}

      {task.dueDate && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 5, fontSize: 11, marginBottom: 6,
            color: overdue ? C.red : dueSoon ? C.amber : C.mutedDim,
          }}
        >
          <CalendarClock size={11} />
          {overdue
            ? `po terminie o ${Math.abs(daysUntil(task.dueDate))} dni`
            : formatDate(task.dueDate)}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <Badge color={prio.color}>{prio.label}</Badge>
          {task.points != null && <Badge color={C.teal}>{task.points}</Badge>}
          {task.comments.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, color: C.mutedDim, fontSize: 11 }}>
              <MessageSquare size={11} /> {task.comments.length}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleTimer();
            }}
            title={anyRunning && !running ? "Ktoś inny mierzy czas na tym zadaniu" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: running ? `${C.amber}22` : "transparent",
              border: `1px solid ${running ? C.amber : anyRunning ? C.teal : C.border}`,
              borderRadius: 5, padding: "3px 6px",
              color: running ? C.amber : anyRunning ? C.teal : C.mutedDim,
            }}
          >
            {running ? <Pause size={10} /> : <Play size={10} />}
            <span className="mono" style={{ fontSize: 10 }}>{formatDuration(taskTime(task))}</span>
          </button>
          <Avatar member={member} size={20} />
        </div>
      </div>
    </div>
  );
}
