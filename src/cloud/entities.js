/**
 * Most między kształtem domenowym a wierszami w bazie.
 *
 * Jedno miejsce opisuje obie strony przekładu, dzięki czemu zapis i odczyt nie
 * mogą się rozjechać. Nowe pole encji dodaje się tutaj raz, nie w dwóch
 * funkcjach oddalonych o pół pliku.
 */

const toTs = (ms) => (ms == null ? null : new Date(ms).toISOString());
const fromTs = (iso) => (iso == null ? null : new Date(iso).getTime());

/**
 * Kolejność ma znaczenie przy zapisie: encja musi trafić do bazy po tym,
 * do czego się odwołuje (zadanie po fazie i sprincie). Przy kasowaniu
 * przechodzimy tę listę od końca.
 */
export const COLLECTIONS = [
  {
    table: "members",
    flatten: (state) =>
      state.team.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role || "",
        user_id: m.userId ?? null,
      })),
  },
  {
    table: "templates",
    flatten: (state) =>
      state.templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description || "",
        phases: t.phases || [],
        created_at: toTs(t.createdAt),
      })),
  },
  {
    table: "projects",
    flatten: (state) =>
      state.projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        template_id: p.templateId ?? null,
        template_name: p.templateName || "",
        repo_url: p.repoUrl || "",
        sprint_length_days: p.sprintLengthDays ?? 14,
        milestones: p.milestones || [],
        created_at: toTs(p.createdAt),
        archived_at: toTs(p.archivedAt),
      })),
  },
  {
    table: "phases",
    flatten: (state) =>
      state.projects.flatMap((p) =>
        p.phases.map((ph) => ({
          id: ph.id,
          project_id: p.id,
          order: ph.order,
          name: ph.name || "",
          tip: ph.tip || "",
          gate: ph.gate || "",
          completed_at: toTs(ph.completedAt),
        }))
      ),
  },
  {
    table: "phase_criteria",
    flatten: (state) =>
      state.projects.flatMap((p) =>
        p.phases.flatMap((ph) =>
          (ph.criteria || []).map((c) => ({
            id: c.id,
            phase_id: ph.id,
            text: c.text || "",
            checked: Boolean(c.checked),
            checked_at: toTs(c.checkedAt),
            checked_by: c.checkedBy ?? null,
          }))
        )
      ),
  },
  {
    table: "sprints",
    flatten: (state) =>
      state.projects.flatMap((p) =>
        p.sprints.map((s) => ({
          id: s.id,
          project_id: p.id,
          number: s.number,
          goal: s.goal || "",
          start_date: s.startDate ?? null,
          end_date: s.endDate ?? null,
          status: s.status,
          ceremonies: s.ceremonies || [],
          retro_notes: s.retroNotes || "",
          closed_at: toTs(s.closedAt),
        }))
      ),
  },
  {
    table: "tasks",
    flatten: (state) =>
      state.projects.flatMap((p) =>
        p.tasks.map((t) => ({
          id: t.id,
          project_id: p.id,
          phase_id: t.phaseId ?? null,
          sprint_id: t.sprintId ?? null,
          title: t.title || "",
          description: t.description || "",
          status: t.status,
          priority: t.priority,
          type: t.type,
          assignee: t.assignee ?? null,
          points: t.points ?? null,
          estimate_h: t.estimateH ?? null,
          due_date: t.dueDate ?? null,
          blocked_by: t.blockedBy || [],
          created_at: toTs(t.createdAt),
          done_at: toTs(t.doneAt),
          updated_at: toTs(t.updatedAt),
        }))
      ),
  },
  {
    table: "task_links",
    flatten: (state) =>
      state.projects.flatMap((p) =>
        p.tasks.flatMap((t) =>
          (t.links || []).map((l) => ({
            id: l.id,
            task_id: t.id,
            label: l.label || "",
            url: l.url,
          }))
        )
      ),
  },
  {
    table: "comments",
    flatten: (state) =>
      state.projects.flatMap((p) =>
        p.tasks.flatMap((t) =>
          (t.comments || []).map((c) => ({
            id: c.id,
            task_id: t.id,
            author_id: c.authorId ?? null,
            text: c.text,
            created_at: toTs(c.createdAt),
          }))
        )
      ),
  },
  {
    table: "time_entries",
    /**
     * Wpisy z tożsamością lokalną nie trafiają do chmury — nie mają autora,
     * którego baza mogłaby przypisać. Zostają w kopii lokalnej jako historia.
     */
    flatten: (state) =>
      state.projects.flatMap((p) =>
        p.tasks.flatMap((t) =>
          (t.timeEntries || [])
            .filter((e) => e.userId && e.userId !== "local")
            .map((e) => ({
              id: e.id,
              task_id: t.id,
              user_id: e.userId,
              started_at: toTs(e.startedAt),
              ended_at: toTs(e.endedAt),
            }))
        )
      ),
  },
];

/** Składa stan aplikacji z wierszy pobranych z bazy. */
export function buildStateFromRows(rows, base) {
  const byId = (list) => new Map(list.map((r) => [r.id, r]));

  const criteriaByPhase = groupBy(rows.phase_criteria, "phase_id");
  const linksByTask = groupBy(rows.task_links, "task_id");
  const commentsByTask = groupBy(rows.comments, "task_id");
  const entriesByTask = groupBy(rows.time_entries, "task_id");
  const phasesByProject = groupBy(rows.phases, "project_id");
  const sprintsByProject = groupBy(rows.sprints, "project_id");
  const tasksByProject = groupBy(rows.tasks, "project_id");

  const projects = rows.projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    templateId: p.template_id,
    templateName: p.template_name || "",
    repoUrl: p.repo_url || "",
    sprintLengthDays: p.sprint_length_days ?? 14,
    milestones: p.milestones || [],
    createdAt: fromTs(p.created_at),
    archivedAt: fromTs(p.archived_at),
    phases: (phasesByProject.get(p.id) || [])
      .map((ph) => ({
        id: ph.id,
        order: ph.order,
        name: ph.name,
        tip: ph.tip || "",
        gate: ph.gate || "",
        completedAt: fromTs(ph.completed_at),
        criteria: (criteriaByPhase.get(ph.id) || []).map((c) => ({
          id: c.id,
          text: c.text,
          checked: c.checked,
          checkedAt: fromTs(c.checked_at),
          checkedBy: c.checked_by,
        })),
      }))
      .sort((a, b) => a.order - b.order),
    sprints: (sprintsByProject.get(p.id) || [])
      .map((s) => ({
        id: s.id,
        number: s.number,
        goal: s.goal || "",
        startDate: s.start_date,
        endDate: s.end_date,
        status: s.status,
        ceremonies: s.ceremonies || [],
        retroNotes: s.retro_notes || "",
        closedAt: fromTs(s.closed_at),
      }))
      .sort((a, b) => a.number - b.number),
    tasks: (tasksByProject.get(p.id) || []).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      status: t.status,
      priority: t.priority,
      type: t.type,
      phaseId: t.phase_id,
      sprintId: t.sprint_id,
      assignee: t.assignee,
      points: t.points,
      estimateH: t.estimate_h == null ? null : Number(t.estimate_h),
      dueDate: t.due_date,
      blockedBy: t.blocked_by || [],
      createdAt: fromTs(t.created_at),
      updatedAt: fromTs(t.updated_at),
      doneAt: fromTs(t.done_at),
      links: (linksByTask.get(t.id) || []).map((l) => ({
        id: l.id,
        label: l.label,
        url: l.url,
      })),
      comments: (commentsByTask.get(t.id) || [])
        .map((c) => ({
          id: c.id,
          text: c.text,
          authorId: c.author_id,
          createdAt: fromTs(c.created_at),
        }))
        .sort((a, b) => a.createdAt - b.createdAt),
      timeEntries: (entriesByTask.get(t.id) || []).map((e) => ({
        id: e.id,
        userId: e.user_id,
        startedAt: fromTs(e.started_at),
        endedAt: fromTs(e.ended_at),
      })),
    })),
  }));

  const team = rows.members.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role || "",
    userId: m.user_id,
  }));

  const templates = rows.templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description || "",
    builtIn: false,
    phases: t.phases || [],
    createdAt: fromTs(t.created_at),
  }));

  const active = byId(projects).has(base?.settings?.activeProjectId)
    ? base.settings.activeProjectId
    : projects[0]?.id || null;

  return {
    ...base,
    projects,
    team,
    templates,
    settings: { ...base.settings, activeProjectId: active },
  };
}

function groupBy(list, key) {
  const map = new Map();
  for (const row of list || []) {
    const k = row[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}
