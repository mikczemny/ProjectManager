import { uid } from "../lib/format.js";

/**
 * Wersja schematu danych.
 *
 * Podbijaj przy KAŻDEJ zmianie kształtu danych i dopisuj krok w MIGRATIONS.
 * Dzięki temu istniejące produkcje w localStorage przeżywają aktualizację
 * aplikacji zamiast się kasować.
 */
export const SCHEMA_VERSION = 3;

/* ---------------------------------------------------------------------- */
/*  Konstruktory encji                                                      */
/* ---------------------------------------------------------------------- */

export function makeTask(patch = {}) {
  return {
    id: uid(),
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    type: "feature",
    phaseId: null,
    /** Null = zadanie siedzi w backlogu, nie jest wzięte na żaden sprint. */
    sprintId: null,
    assignee: null,
    /** Story pointy (Scrum). Estymata w godzinach żyje obok, dla rozliczenia czasu. */
    points: null,
    estimateH: null,
    timeSpent: 0,
    timerStartedAt: null,
    dueDate: null,
    blockedBy: [],
    links: [],
    comments: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    doneAt: null,
    ...patch,
  };
}

/**
 * Kryterium wyjścia z fazy. Bramka to lista takich kryteriów — faza nie
 * domyka się, dopóki wszystkie nie są odhaczone, nawet jeśli zadania są
 * zrobione. To jest mechanizm, który pilnuje procesu zamiast tylko go opisywać.
 */
export function makeCriterion(patch = {}) {
  return {
    id: uid(),
    text: "",
    checked: false,
    checkedAt: null,
    checkedBy: null,
    ...patch,
  };
}

export function makePhase(patch = {}) {
  return {
    id: uid(),
    order: 1,
    name: "",
    tip: "",
    /** Jednozdaniowe podsumowanie bramki — nagłówek nad kryteriami. */
    gate: "",
    /** Kryteria wyjścia (Definition of Done fazy). */
    criteria: [],
    /** Ustawiane dopiero, gdy faza przejdzie bramkę. */
    completedAt: null,
    ...patch,
  };
}

/**
 * Sprint — rytm Scrum. Zadania przypisuje się do sprintu niezależnie od fazy:
 * faza mówi CO musi być zrobione, sprint mówi KIEDY to robimy.
 */
export function makeSprint(patch = {}) {
  return {
    id: uid(),
    number: 1,
    goal: "",
    startDate: null,
    endDate: null,
    status: "planned", // planned | active | closed
    /** Ceremonie Scrum jako checklista — żeby nie wypadły z rytmu. */
    ceremonies: [
      { key: "planning", label: "Sprint planning", done: false },
      { key: "review", label: "Sprint review", done: false },
      { key: "retro", label: "Retrospektywa", done: false },
    ],
    /** Wnioski z retro — wracają w widoku kolejnego sprintu. */
    retroNotes: "",
    closedAt: null,
    ...patch,
  };
}

export function makeMilestone(patch = {}) {
  return {
    id: uid(),
    name: "",
    date: null,
    done: false,
    ...patch,
  };
}

export function makeMember(patch = {}) {
  return {
    id: uid(),
    name: "",
    role: "",
    ...patch,
  };
}

export function makeProject(patch = {}) {
  return {
    id: uid(),
    name: "",
    description: "",
    templateId: null,
    templateName: "",
    repoUrl: "",
    phases: [],
    tasks: [],
    sprints: [],
    milestones: [],
    /** Domyślna długość sprintu w dniach — używana przy zakładaniu kolejnego. */
    sprintLengthDays: 14,
    createdAt: Date.now(),
    archivedAt: null,
    ...patch,
  };
}

export function makeTemplate(patch = {}) {
  return {
    id: uid(),
    name: "",
    description: "",
    builtIn: false,
    phases: [],
    createdAt: Date.now(),
    ...patch,
  };
}

export function emptyState() {
  return {
    version: SCHEMA_VERSION,
    projects: [],
    team: [],
    templates: [],
    settings: { activeProjectId: null },
  };
}

/* ---------------------------------------------------------------------- */
/*  Tworzenie projektu z szablonu                                           */
/* ---------------------------------------------------------------------- */

/**
 * Buduje projekt na podstawie szablonu.
 *
 * Kluczowe: fazy są KOPIOWANE do projektu, nie trzymane jako referencja do
 * szablonu. Późniejsza edycja lub usunięcie szablonu nie zmienia i nie psuje
 * projektów, które już z niego powstały.
 */
export function buildProjectFromTemplate(name, template) {
  const phases = (template.phases || []).map((p, i) =>
    makePhase({
      order: p.order ?? i + 1,
      name: p.name,
      tip: p.tip || "",
      gate: p.gate || "",
      criteria: (p.criteria || []).map((text) => makeCriterion({ text })),
    })
  );

  const tasks = [];
  (template.phases || []).forEach((p, i) => {
    const phase = phases[i];
    (p.tasks || []).forEach((t) => {
      tasks.push(
        makeTask({
          title: t.title,
          priority: t.priority || "medium",
          type: t.type || "feature",
          estimateH: t.estimateH ?? null,
          points: t.points ?? null,
          phaseId: phase.id,
        })
      );
    });
  });

  return makeProject({
    name,
    description: template.description || "",
    templateId: template.id,
    templateName: template.name,
    phases,
    tasks,
  });
}

/**
 * Odwrotność powyższego — zamienia istniejący projekt w szablon wielokrotnego
 * użytku. To jest mechanizm, który czyni z aplikacji szkielet: każda udana
 * produkcja może stać się punktem startowym kolejnej.
 *
 * Zrzucane są tylko dane strukturalne (fazy, zadania, estymaty). Czas pracy,
 * przypisania, komentarze i terminy zostają w projekcie.
 */
export function buildTemplateFromProject(project, { name, description } = {}) {
  const phases = [...project.phases]
    .sort((a, b) => a.order - b.order)
    .map((ph) => ({
      order: ph.order,
      name: ph.name,
      tip: ph.tip,
      gate: ph.gate,
      // Kryteria wracają jako czysty tekst — odhaczenia są stanem projektu,
      // nie częścią procesu.
      criteria: (ph.criteria || []).map((c) => c.text),
      tasks: project.tasks
        .filter((t) => t.phaseId === ph.id)
        .map((t) => ({
          title: t.title,
          priority: t.priority,
          type: t.type,
          estimateH: t.estimateH,
          points: t.points,
        })),
    }));

  // Zadania bez fazy trafiają do dodatkowej fazy "Pozostałe", żeby nic nie zginęło.
  const orphans = project.tasks.filter((t) => !t.phaseId);
  if (orphans.length > 0) {
    phases.push({
      order: phases.length + 1,
      name: "Pozostałe",
      tip: "",
      gate: "",
      criteria: [],
      tasks: orphans.map((t) => ({
        title: t.title,
        priority: t.priority,
        type: t.type,
        estimateH: t.estimateH,
        points: t.points,
      })),
    });
  }

  return makeTemplate({
    name: name || `${project.name} (szablon)`,
    description: description || project.description || "",
    builtIn: false,
    phases,
  });
}

/* ---------------------------------------------------------------------- */
/*  Migracje                                                                */
/* ---------------------------------------------------------------------- */

/**
 * Każdy krok podnosi stan o jedną wersję. Kroki muszą być czyste i odporne na
 * niekompletne dane — czytamy z localStorage, więc nie mamy gwarancji kształtu.
 */
const MIGRATIONS = {
  /**
   * v1 → v2
   *  - `task.phase = {order, name}` (kopia z szablonu) → `project.phases[]` + `task.phaseId`
   *  - projekt dostaje własne fazy zamiast polegać na globalnej tablicy TEMPLATES
   *  - nowe pola zadania: type / estimateH / dueDate / blockedBy / links / updatedAt / doneAt
   */
  1: (state) => {
    const projects = (state.projects || []).map((p) => {
      const byOrder = new Map();
      (p.tasks || []).forEach((t) => {
        if (t.phase && !byOrder.has(t.phase.order)) {
          byOrder.set(
            t.phase.order,
            makePhase({ order: t.phase.order, name: t.phase.name })
          );
        }
      });
      const phases = [...byOrder.values()].sort((a, b) => a.order - b.order);

      const tasks = (p.tasks || []).map((t) => {
        const phase = t.phase ? byOrder.get(t.phase.order) : null;
        const { phase: _drop, ...rest } = t;
        return makeTask({
          ...rest,
          phaseId: phase ? phase.id : null,
          updatedAt: t.createdAt || Date.now(),
          doneAt: t.status === "done" ? t.createdAt || Date.now() : null,
        });
      });

      return makeProject({ ...p, phases, tasks });
    });

    return {
      ...state,
      version: 2,
      projects,
      team: (state.team || []).map((m) => makeMember(m)),
      templates: state.templates || [],
      settings: state.settings || { activeProjectId: projects[0]?.id || null },
    };
  },

  /**
   * v2 → v3: warstwa procesu i Scrum
   *  - `phase.gate` (tekst) → `phase.criteria[]` — bramka staje się checklistą
   *  - projekt dostaje `sprints[]`, zadanie `sprintId` i `points`
   *  - fazy już domknięte (wszystkie zadania zrobione) dostają `completedAt`,
   *    żeby istniejące projekty nie cofnęły się na starcie do fazy pierwszej
   */
  2: (state) => {
    const projects = (state.projects || []).map((p) => {
      const phases = (p.phases || []).map((ph) => {
        const tasks = (p.tasks || []).filter((t) => t.phaseId === ph.id);
        const allDone = tasks.length > 0 && tasks.every((t) => t.status === "done");
        return makePhase({
          ...ph,
          criteria: ph.criteria?.length
            ? ph.criteria
            : ph.gate
              ? [makeCriterion({ text: ph.gate, checked: allDone, checkedAt: allDone ? Date.now() : null })]
              : [],
          completedAt: allDone ? Date.now() : null,
        });
      });

      return makeProject({
        ...p,
        phases,
        sprints: p.sprints || [],
        sprintLengthDays: p.sprintLengthDays ?? 14,
        tasks: (p.tasks || []).map((t) =>
          makeTask({ ...t, sprintId: t.sprintId ?? null, points: t.points ?? null })
        ),
      });
    });

    return { ...state, version: 3, projects };
  },
};

/** Podnosi dowolny zapisany stan do bieżącej wersji schematu. */
export function migrate(raw) {
  if (!raw || typeof raw !== "object") return emptyState();

  // Stan sprzed wprowadzenia wersjonowania nie miał pola `version`.
  let state = { ...raw, version: raw.version ?? 1 };

  while (state.version < SCHEMA_VERSION) {
    const step = MIGRATIONS[state.version];
    if (!step) {
      console.warn(
        `Brak migracji z wersji ${state.version} — stan zostaje bez zmian.`
      );
      break;
    }
    state = step(state);
  }

  return {
    ...emptyState(),
    ...state,
    settings: { ...emptyState().settings, ...(state.settings || {}) },
  };
}
