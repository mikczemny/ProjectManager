import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  makeTask,
  makeMember,
  makePhase,
  makeCriterion,
  makeSprint,
  makeMilestone,
  makeProject,
  makeTemplate,
  buildProjectFromTemplate,
  buildTemplateFromProject,
} from "../domain/schema.js";
import { loadState, saveState } from "../domain/storage.js";
import { BUILT_IN_TEMPLATES } from "../domain/templates.js";
import { gateStatus } from "../domain/guidance.js";
import { suggestSprintDates } from "../domain/scrum.js";
import { uid } from "../lib/format.js";

/* ---------------------------------------------------------------------- */
/*  Reducer                                                                 */
/* ---------------------------------------------------------------------- */

/** Podmienia projekt o danym id, przepuszczając go przez `fn`. */
function mapProject(state, projectId, fn) {
  return {
    ...state,
    projects: state.projects.map((p) => (p.id === projectId ? fn(p) : p)),
  };
}

/** Jak wyżej, ale operuje na liście zadań projektu. */
function mapTasks(state, projectId, fn) {
  return mapProject(state, projectId, (p) => ({ ...p, tasks: fn(p.tasks) }));
}

function touch(task, patch) {
  const next = { ...task, ...patch, updatedAt: Date.now() };
  // doneAt utrzymujemy automatycznie — potrzebne do metryk przepustowości.
  if (patch.status === "done" && task.status !== "done") next.doneAt = Date.now();
  if (patch.status && patch.status !== "done") next.doneAt = null;
  return next;
}

export function reducer(state, action) {
  switch (action.type) {
    /* --- cały stan --- */
    case "replaceState":
      return action.state;

    case "setActiveProject":
      return { ...state, settings: { ...state.settings, activeProjectId: action.id } };

    /* --- projekty --- */
    case "createProject": {
      const project = buildProjectFromTemplate(action.name, action.template);
      return {
        ...state,
        projects: [...state.projects, project],
        settings: { ...state.settings, activeProjectId: project.id },
      };
    }

    case "importProject": {
      // Nadajemy nowe id, żeby import nie nadpisał istniejącego projektu.
      const idMap = new Map();
      const phases = (action.project.phases || []).map((ph) => {
        const fresh = makePhase({ ...ph, id: uid() });
        idMap.set(ph.id, fresh.id);
        return fresh;
      });
      const sprintMap = new Map();
      const sprints = (action.project.sprints || []).map((s) => {
        const fresh = makeSprint({ ...s, id: uid() });
        sprintMap.set(s.id, fresh.id);
        return fresh;
      });
      const project = makeProject({
        ...action.project,
        id: uid(),
        phases,
        sprints,
        tasks: (action.project.tasks || []).map((t) =>
          makeTask({
            ...t,
            id: uid(),
            phaseId: idMap.get(t.phaseId) ?? null,
            sprintId: sprintMap.get(t.sprintId) ?? null,
            // Blokady odnoszą się do starych id — czyścimy, zamiast zostawiać
            // wiszące referencje.
            blockedBy: [],
          })
        ),
      });
      return {
        ...state,
        projects: [...state.projects, project],
        settings: { ...state.settings, activeProjectId: project.id },
      };
    }

    case "patchProject":
      return mapProject(state, action.projectId, (p) => ({ ...p, ...action.patch }));

    case "deleteProject": {
      const projects = state.projects.filter((p) => p.id !== action.projectId);
      const activeProjectId =
        state.settings.activeProjectId === action.projectId
          ? projects[0]?.id || null
          : state.settings.activeProjectId;
      return { ...state, projects, settings: { ...state.settings, activeProjectId } };
    }

    case "archiveProject":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        archivedAt: p.archivedAt ? null : Date.now(),
      }));

    /* --- fazy --- */
    case "addPhase":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: [
          ...p.phases,
          makePhase({ order: p.phases.length + 1, name: action.name }),
        ],
      }));

    case "patchPhase":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id === action.phaseId ? { ...ph, ...action.patch } : ph
        ),
      }));

    case "deletePhase":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: p.phases
          .filter((ph) => ph.id !== action.phaseId)
          .map((ph, i) => ({ ...ph, order: i + 1 })),
        // Zadania nie znikają razem z fazą — tracą tylko przypisanie.
        tasks: p.tasks.map((t) =>
          t.phaseId === action.phaseId ? { ...t, phaseId: null } : t
        ),
      }));

    /* --- bramki faz --- */
    case "toggleCriterion":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id !== action.phaseId
            ? ph
            : {
                ...ph,
                criteria: ph.criteria.map((c) =>
                  c.id !== action.criterionId
                    ? c
                    : {
                        ...c,
                        checked: !c.checked,
                        checkedAt: !c.checked ? Date.now() : null,
                        checkedBy: !c.checked ? action.memberId || null : null,
                      }
                ),
              }
        ),
      }));

    case "addCriterion":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id === action.phaseId
            ? { ...ph, criteria: [...ph.criteria, makeCriterion({ text: action.text })] }
            : ph
        ),
      }));

    case "deleteCriterion":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id === action.phaseId
            ? { ...ph, criteria: ph.criteria.filter((c) => c.id !== action.criterionId) }
            : ph
        ),
      }));

    /**
     * Domknięcie fazy przechodzi przez bramkę — reducer jest ostatnią linią
     * obrony, nawet jeśli UI puściłby kliknięcie.
     */
    case "closePhase": {
      const project = state.projects.find((p) => p.id === action.projectId);
      const phase = project?.phases.find((ph) => ph.id === action.phaseId);
      if (!project || !phase) return state;
      if (!gateStatus(project, phase).canClose) {
        console.warn("Bramka fazy nie jest spełniona — domknięcie odrzucone.");
        return state;
      }
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id === action.phaseId ? { ...ph, completedAt: Date.now() } : ph
        ),
      }));
    }

    case "reopenPhase":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        phases: p.phases.map((ph) =>
          ph.id === action.phaseId ? { ...ph, completedAt: null } : ph
        ),
      }));

    /* --- sprinty --- */
    case "createSprint": {
      const project = state.projects.find((p) => p.id === action.projectId);
      if (!project) return state;
      const suggested = suggestSprintDates(project);
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        sprints: [
          ...p.sprints,
          makeSprint({
            ...suggested,
            goal: action.goal || "",
            startDate: action.startDate || suggested.startDate,
            endDate: action.endDate || suggested.endDate,
          }),
        ],
      }));
    }

    case "patchSprint":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        sprints: p.sprints.map((s) =>
          s.id === action.sprintId ? { ...s, ...action.patch } : s
        ),
      }));

    case "startSprint":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        // Tylko jeden sprint może być aktywny naraz — to nie jest ograniczenie
        // techniczne, tylko sedno rytmu.
        sprints: p.sprints.map((s) =>
          s.id === action.sprintId
            ? { ...s, status: "active" }
            : s.status === "active"
              ? { ...s, status: "closed", closedAt: Date.now() }
              : s
        ),
      }));

    case "closeSprint":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        sprints: p.sprints.map((s) =>
          s.id === action.sprintId
            ? { ...s, status: "closed", closedAt: Date.now() }
            : s
        ),
        // Niedowiezione zadania wracają do backlogu zamiast ciągnąć się
        // w zamkniętym sprincie i fałszować velocity.
        tasks: p.tasks.map((t) =>
          t.sprintId === action.sprintId && t.status !== "done"
            ? { ...t, sprintId: null }
            : t
        ),
      }));

    case "deleteSprint":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        sprints: p.sprints.filter((s) => s.id !== action.sprintId),
        tasks: p.tasks.map((t) =>
          t.sprintId === action.sprintId ? { ...t, sprintId: null } : t
        ),
      }));

    case "toggleCeremony":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        sprints: p.sprints.map((s) =>
          s.id !== action.sprintId
            ? s
            : {
                ...s,
                ceremonies: s.ceremonies.map((c) =>
                  c.key === action.key ? { ...c, done: !c.done } : c
                ),
              }
        ),
      }));

    /* --- zadania --- */
    case "addTask":
      return mapTasks(state, action.projectId, (tasks) => [
        ...tasks,
        makeTask({
          title: action.title,
          status: action.status || "todo",
          phaseId: action.phaseId ?? null,
        }),
      ]);

    case "patchTask":
      return mapTasks(state, action.projectId, (tasks) =>
        tasks.map((t) => (t.id === action.taskId ? touch(t, action.patch) : t))
      );

    case "moveTask":
      return mapTasks(state, action.projectId, (tasks) =>
        tasks.map((t) =>
          t.id === action.taskId ? touch(t, { status: action.status }) : t
        )
      );

    case "deleteTask":
      return mapTasks(state, action.projectId, (tasks) =>
        tasks
          .filter((t) => t.id !== action.taskId)
          // Sprzątamy wiszące referencje w blokadach.
          .map((t) =>
            t.blockedBy?.includes(action.taskId)
              ? { ...t, blockedBy: t.blockedBy.filter((id) => id !== action.taskId) }
              : t
          )
      );

    case "toggleTimer":
      return mapTasks(state, action.projectId, (tasks) =>
        tasks.map((t) => {
          if (t.id !== action.taskId) return t;
          if (t.timerStartedAt) {
            const elapsed = (Date.now() - t.timerStartedAt) / 1000;
            return touch(t, { timeSpent: t.timeSpent + elapsed, timerStartedAt: null });
          }
          return touch(t, { timerStartedAt: Date.now() });
        })
      );

    case "addComment":
      return mapTasks(state, action.projectId, (tasks) =>
        tasks.map((t) =>
          t.id === action.taskId
            ? touch(t, {
                comments: [
                  ...t.comments,
                  { id: uid(), text: action.text, createdAt: Date.now() },
                ],
              })
            : t
        )
      );

    case "addLink":
      return mapTasks(state, action.projectId, (tasks) =>
        tasks.map((t) =>
          t.id === action.taskId
            ? touch(t, {
                links: [...(t.links || []), { id: uid(), label: action.label, url: action.url }],
              })
            : t
        )
      );

    case "removeLink":
      return mapTasks(state, action.projectId, (tasks) =>
        tasks.map((t) =>
          t.id === action.taskId
            ? touch(t, { links: (t.links || []).filter((l) => l.id !== action.linkId) })
            : t
        )
      );

    /* --- kamienie milowe --- */
    case "addMilestone":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        milestones: [
          ...p.milestones,
          makeMilestone({ name: action.name, date: action.date }),
        ],
      }));

    case "patchMilestone":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        milestones: p.milestones.map((m) =>
          m.id === action.milestoneId ? { ...m, ...action.patch } : m
        ),
      }));

    case "deleteMilestone":
      return mapProject(state, action.projectId, (p) => ({
        ...p,
        milestones: p.milestones.filter((m) => m.id !== action.milestoneId),
      }));

    /* --- zespół --- */
    case "addMember":
      return {
        ...state,
        team: [...state.team, makeMember({ name: action.name, role: action.role || "" })],
      };

    case "patchMember":
      return {
        ...state,
        team: state.team.map((m) =>
          m.id === action.memberId ? { ...m, ...action.patch } : m
        ),
      };

    case "removeMember":
      return {
        ...state,
        team: state.team.filter((m) => m.id !== action.memberId),
        // Osoba znika z zespołu — jej zadania zostają, tracą tylko właściciela.
        projects: state.projects.map((p) => ({
          ...p,
          tasks: p.tasks.map((t) =>
            t.assignee === action.memberId ? { ...t, assignee: null } : t
          ),
        })),
      };

    /* --- szablony --- */
    case "saveProjectAsTemplate": {
      const project = state.projects.find((p) => p.id === action.projectId);
      if (!project) return state;
      const template = buildTemplateFromProject(project, {
        name: action.name,
        description: action.description,
      });
      return { ...state, templates: [...state.templates, template] };
    }

    case "importTemplate":
      return {
        ...state,
        templates: [
          ...state.templates,
          makeTemplate({ ...action.template, id: uid(), builtIn: false }),
        ],
      };

    case "patchTemplate":
      return {
        ...state,
        templates: state.templates.map((t) =>
          t.id === action.templateId ? { ...t, ...action.patch } : t
        ),
      };

    case "deleteTemplate":
      return {
        ...state,
        templates: state.templates.filter((t) => t.id !== action.templateId),
      };

    default:
      console.warn("Nieznana akcja:", action.type);
      return state;
  }
}

/* ---------------------------------------------------------------------- */
/*  Context                                                                 */
/* ---------------------------------------------------------------------- */

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, loadState);

  // Pierwszy render nie może nadpisać zapisu — czekamy na zmianę stanu.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    saveState(state);
  }, [state]);

  const value = useMemo(() => {
    const activeProject =
      state.projects.find((p) => p.id === state.settings.activeProjectId) || null;

    // Wbudowane szablony i własne trafiają do jednej listy — UI ich nie rozróżnia
    // poza znacznikiem `builtIn`, który decyduje o możliwości edycji.
    const allTemplates = [
      ...BUILT_IN_TEMPLATES.filter((t) => t.id !== "blank"),
      ...state.templates,
      ...BUILT_IN_TEMPLATES.filter((t) => t.id === "blank"),
    ];

    return { state, dispatch, activeProject, allTemplates };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore musi być użyte wewnątrz <StoreProvider>");
  return ctx;
}
