import { daysUntil } from "../lib/format.js";

export const sprintTasks = (project, sprintId) =>
  project.tasks.filter((t) => t.sprintId === sprintId);

/** Zadania nieprzypisane do żadnego sprintu — backlog produktu. */
export const backlogTasks = (project) => project.tasks.filter((t) => !t.sprintId);

export const activeSprint = (project) =>
  project.sprints.find((s) => s.status === "active") || null;

export const points = (tasks) =>
  tasks.reduce((sum, t) => sum + (t.points || 0), 0);

/**
 * Podsumowanie sprintu: ile wzięto, ile dowieziono, ile dni zostało.
 * `committed` liczymy z bieżącego składu sprintu — przy scope creep rośnie,
 * i to jest sygnał sam w sobie.
 */
export function sprintSummary(project, sprint) {
  const tasks = sprintTasks(project, sprint.id);
  const done = tasks.filter((t) => t.status === "done");
  const committed = points(tasks);
  const completed = points(done);
  const daysLeft = daysUntil(sprint.endDate);
  const total =
    sprint.startDate && sprint.endDate
      ? Math.max(1, Math.round((new Date(sprint.endDate) - new Date(sprint.startDate)) / 86400000))
      : null;
  const elapsed = total != null && daysLeft != null ? total - daysLeft : null;

  return {
    tasks,
    done,
    committed,
    completed,
    remaining: committed - completed,
    pct: committed ? Math.round((completed / committed) * 100) : 0,
    daysLeft,
    totalDays: total,
    elapsedDays: elapsed,
    ceremoniesDone: (sprint.ceremonies || []).filter((c) => c.done).length,
    ceremoniesTotal: (sprint.ceremonies || []).length,
  };
}

/** Średnia z domkniętych sprintów — podstawa do planowania kolejnego. */
export function velocity(project) {
  const closed = project.sprints.filter((s) => s.status === "closed");
  if (closed.length === 0) return { avg: null, history: [], samples: 0 };
  const history = closed.map((s) => {
    const { completed, committed } = sprintSummary(project, s);
    return { number: s.number, completed, committed };
  });
  const avg = history.reduce((sum, h) => sum + h.completed, 0) / history.length;
  return { avg: Math.round(avg * 10) / 10, history, samples: history.length };
}

/**
 * Burndown: linia idealna vs. rzeczywiste pozostałe punkty.
 * Rzeczywistość odtwarzamy z `doneAt` zadań, więc działa wstecz bez migawek.
 */
export function burndown(project, sprint) {
  if (!sprint.startDate || !sprint.endDate) return null;
  const start = new Date(sprint.startDate).setHours(0, 0, 0, 0);
  const end = new Date(sprint.endDate).setHours(0, 0, 0, 0);
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const tasks = sprintTasks(project, sprint.id);
  const committed = points(tasks);

  const series = [];
  for (let i = 0; i <= days; i++) {
    const day = start + i * 86400000;
    const burned = tasks
      .filter((t) => t.status === "done" && t.doneAt && t.doneAt <= day + 86399999)
      .reduce((s, t) => s + (t.points || 0), 0);
    series.push({
      day: i,
      date: new Date(day),
      ideal: Math.round((committed * (1 - i / days)) * 10) / 10,
      // Przyszłych dni nie zgadujemy — linia rzeczywista urywa się na dziś.
      actual: day <= Date.now() ? committed - burned : null,
    });
  }
  return { series, committed, days };
}

/** Data końca sprintu wyliczona z daty startu i długości przyjętej w projekcie. */
export function suggestSprintDates(project) {
  const last = [...project.sprints].sort((a, b) => b.number - a.number)[0];
  const start =
    last?.endDate ? new Date(new Date(last.endDate).getTime() + 86400000) : new Date();
  const end = new Date(start.getTime() + (project.sprintLengthDays || 14) * 86400000);
  return {
    number: (last?.number || 0) + 1,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}
