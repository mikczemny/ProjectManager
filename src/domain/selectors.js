import { daysUntil } from "../lib/format.js";

/** Czas zadania łącznie z trwającymi pomiarami, w sekundach. */
export function taskTime(task, now = Date.now()) {
  return (task.timeEntries || []).reduce(
    (sum, e) => sum + ((e.endedAt ?? now) - e.startedAt) / 1000,
    0
  );
}

/** Czas wniesiony przez konkretną osobę — podstawa rozliczeń w zespole. */
export function taskTimeByUser(task, userId, now = Date.now()) {
  return (task.timeEntries || [])
    .filter((e) => e.userId === userId)
    .reduce((sum, e) => sum + ((e.endedAt ?? now) - e.startedAt) / 1000, 0);
}

/** Pomiar w toku dla danej osoby (albo dowolnej, gdy userId pominięte). */
export function runningEntry(task, userId) {
  return (task.timeEntries || []).find(
    (e) => e.endedAt == null && (userId === undefined || e.userId === userId)
  );
}

export const isTimerRunning = (task, userId) => Boolean(runningEntry(task, userId));

export function projectTime(project, now = Date.now()) {
  return project.tasks.reduce((sum, t) => sum + taskTime(t, now), 0);
}

export function projectProgress(project) {
  const total = project.tasks.length;
  const done = project.tasks.filter((t) => t.status === "done").length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function phaseStats(project, phase) {
  const tasks = project.tasks.filter((t) => t.phaseId === phase.id);
  const done = tasks.filter((t) => t.status === "done").length;
  return {
    tasks,
    done,
    total: tasks.length,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    complete: tasks.length > 0 && done === tasks.length,
  };
}

/** Faza, w której projekt realnie jest: pierwsza niedomknięta. */
export function currentPhase(project) {
  const ordered = [...project.phases].sort((a, b) => a.order - b.order);
  return ordered.find((ph) => !phaseStats(project, ph).complete) || null;
}

export function estimateVsActual(project) {
  let estimateH = 0;
  let actualH = 0;
  let estimated = 0;
  project.tasks.forEach((t) => {
    if (t.estimateH != null) {
      estimateH += t.estimateH;
      estimated += 1;
    }
    actualH += taskTime(t) / 3600;
  });
  const ratio = estimateH > 0 ? actualH / estimateH : null;
  return { estimateH, actualH, estimated, total: project.tasks.length, ratio };
}

export function isOverdue(task) {
  if (task.status === "done" || !task.dueDate) return false;
  const d = daysUntil(task.dueDate);
  return d != null && d < 0;
}

export function isDueSoon(task, withinDays = 3) {
  if (task.status === "done" || !task.dueDate) return false;
  const d = daysUntil(task.dueDate);
  return d != null && d >= 0 && d <= withinDays;
}

/** Zadania zablokowane przez inne, jeszcze niezrobione. */
export function blockers(project, task) {
  if (!task.blockedBy?.length) return [];
  return project.tasks.filter(
    (t) => task.blockedBy.includes(t.id) && t.status !== "done"
  );
}

export function memberWorkload(project, memberId) {
  const assigned = project.tasks.filter((t) => t.assignee === memberId);
  const done = assigned.filter((t) => t.status === "done");
  const open = assigned.filter((t) => t.status !== "done");
  return {
    assigned,
    open: open.length,
    done: done.length,
    total: assigned.length,
    timeH: assigned.reduce((s, t) => s + taskTime(t), 0) / 3600,
    overdue: assigned.filter(isOverdue).length,
  };
}

/**
 * Sygnały ryzyka dla projektu — to, co warto zobaczyć zanim się posypie.
 * Każdy wpis: { level: "warn"|"danger", text }.
 */
export function projectRisks(project) {
  const risks = [];
  const overdue = project.tasks.filter(isOverdue);
  if (overdue.length > 0) {
    risks.push({
      level: "danger",
      text: `${overdue.length} zadań po terminie.`,
    });
  }

  const inProgress = project.tasks.filter((t) => t.status === "inprogress");
  if (inProgress.length > 5) {
    risks.push({
      level: "warn",
      text: `${inProgress.length} zadań równolegle w trakcie — za dużo otwartych frontów.`,
    });
  }

  const stuckReview = project.tasks.filter(
    (t) => t.status === "review" && Date.now() - t.updatedAt > 7 * 86400000
  );
  if (stuckReview.length > 0) {
    risks.push({
      level: "warn",
      text: `${stuckReview.length} zadań wisi w Review dłużej niż tydzień.`,
    });
  }

  const blocked = project.tasks.filter(
    (t) => t.status !== "done" && blockers(project, t).length > 0
  );
  if (blocked.length > 0) {
    risks.push({
      level: "warn",
      text: `${blocked.length} zadań zablokowanych przez inne.`,
    });
  }

  const { ratio } = estimateVsActual(project);
  if (ratio != null && ratio > 1.3) {
    risks.push({
      level: "danger",
      text: `Czas rzeczywisty przekracza estymatę o ${Math.round((ratio - 1) * 100)}%.`,
    });
  }

  const unassigned = project.tasks.filter(
    (t) => t.status !== "done" && !t.assignee
  );
  if (unassigned.length > 0) {
    risks.push({
      level: "warn",
      text: `${unassigned.length} otwartych zadań bez właściciela.`,
    });
  }

  return risks;
}

/** Filtrowanie tablicy. Wszystkie pola filtra są opcjonalne. */
export function filterTasks(tasks, filter = {}) {
  return tasks.filter((t) => {
    if (filter.assignee === "__none__" && t.assignee) return false;
    if (filter.assignee && filter.assignee !== "__none__" && t.assignee !== filter.assignee)
      return false;
    if (filter.priority && t.priority !== filter.priority) return false;
    if (filter.type && t.type !== filter.type) return false;
    if (filter.phaseId === "__none__" && t.phaseId) return false;
    if (filter.phaseId && filter.phaseId !== "__none__" && t.phaseId !== filter.phaseId)
      return false;
    if (filter.overdueOnly && !isOverdue(t)) return false;
    if (filter.text) {
      const q = filter.text.toLowerCase();
      const hay = `${t.title} ${t.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function isFilterActive(filter = {}) {
  return Boolean(
    filter.assignee ||
      filter.priority ||
      filter.type ||
      filter.phaseId ||
      filter.overdueOnly ||
      filter.text
  );
}
