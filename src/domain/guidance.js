/**
 * Silnik prowadzenia.
 *
 * Tu mieszka odpowiedź na pytanie „co teraz?". Reszta aplikacji tylko to
 * wyświetla — cała wiedza o tym, kiedy wolno przejść dalej i czego brakuje,
 * jest w tym pliku i nigdzie indziej.
 */
import { phaseStats } from "./selectors.js";
import { activeSprint, sprintSummary, velocity, backlogTasks } from "./scrum.js";
import { daysUntil } from "../lib/format.js";

/* ---------------------------------------------------------------------- */
/*  Bramki faz                                                              */
/* ---------------------------------------------------------------------- */

/**
 * Czy faza może zostać domknięta i co ją blokuje.
 *
 * Dwa niezależne warunki — oba muszą być spełnione:
 *   1. zadania fazy zrobione (albo świadomie usunięte)
 *   2. wszystkie kryteria bramki odhaczone
 *
 * Zadania zrobione bez odhaczonej bramki to typowy sposób na przemycenie
 * niedokończonej fazy dalej, więc program tego nie przepuszcza.
 */
export function gateStatus(project, phase) {
  const { tasks, done, total } = phaseStats(project, phase);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const criteria = phase.criteria || [];
  const checked = criteria.filter((c) => c.checked);
  const unchecked = criteria.filter((c) => !c.checked);

  const blockers = [];
  if (openTasks.length > 0) {
    blockers.push({
      kind: "tasks",
      text: `${openTasks.length} z ${total} zadań fazy jeszcze nie jest zrobionych.`,
      tasks: openTasks,
    });
  }
  if (unchecked.length > 0) {
    blockers.push({
      kind: "criteria",
      text: `${unchecked.length} z ${criteria.length} kryteriów bramki nie jest odhaczonych.`,
      criteria: unchecked,
    });
  }

  return {
    phase,
    tasksDone: done,
    tasksTotal: total,
    criteriaChecked: checked.length,
    criteriaTotal: criteria.length,
    blockers,
    canClose: blockers.length === 0,
    closed: Boolean(phase.completedAt),
  };
}

/**
 * Stan każdej fazy w ujęciu procesowym:
 *   done    — bramka przeszła
 *   active  — pierwsza niedomknięta, tu zespół pracuje teraz
 *   locked  — dalsze fazy; widoczne, ale program nie każe ich robić
 */
export function phaseTimeline(project) {
  const ordered = [...project.phases].sort((a, b) => a.order - b.order);
  let activeFound = false;
  return ordered.map((phase) => {
    const gate = gateStatus(project, phase);
    let state;
    if (gate.closed) {
      state = "done";
    } else if (!activeFound) {
      state = "active";
      activeFound = true;
    } else {
      state = "locked";
    }
    return { phase, gate, state };
  });
}

export function currentPhaseEntry(project) {
  return phaseTimeline(project).find((e) => e.state === "active") || null;
}

/* ---------------------------------------------------------------------- */
/*  „Co teraz?"                                                             */
/* ---------------------------------------------------------------------- */

/**
 * Uporządkowana lista kroków dla zespołu — od najpilniejszego.
 *
 * Każdy krok: { level, title, detail, action }
 *   level  — "block" (bez tego nie ruszysz) | "do" (bieżąca praca) | "hint"
 *   action — { view, ... } dokąd przenieść użytkownika po kliknięciu
 */
export function nextSteps(project) {
  const steps = [];
  const timeline = phaseTimeline(project);
  const current = timeline.find((e) => e.state === "active");
  const sprint = activeSprint(project);

  /* --- projekt bez procesu --- */
  if (project.phases.length === 0) {
    steps.push({
      level: "block",
      title: "Ten projekt nie ma zdefiniowanych faz",
      detail:
        "Bez faz program nie ma czego pilnować. Dodaj fazy ręcznie albo załóż projekt na bazie szablonu.",
      action: { view: "process" },
    });
    return steps;
  }

  /* --- proces domknięty --- */
  if (!current) {
    steps.push({
      level: "hint",
      title: "Wszystkie fazy domknięte — projekt przeszedł pełny proces",
      detail:
        "Zapisz go jako szablon, jeśli ten przebieg się sprawdził. Kolejna produkcja zacznie od gotowego procesu zamiast od pustej kartki.",
      action: { view: "process" },
    });
    return steps;
  }

  /* --- bramka bieżącej fazy --- */
  const { phase, gate } = current;
  if (gate.canClose) {
    steps.push({
      level: "do",
      title: `Faza „${phase.name}" jest gotowa do domknięcia`,
      detail:
        "Zadania zrobione, bramka odhaczona. Zamknij fazę, żeby przejść dalej.",
      action: { view: "process", phaseId: phase.id },
    });
  } else {
    gate.blockers.forEach((b) => {
      if (b.kind === "tasks") {
        steps.push({
          level: "do",
          title: `Dokończ zadania fazy „${phase.name}"`,
          detail: b.text,
          action: { view: "board", phaseId: phase.id },
        });
      } else {
        steps.push({
          level: "block",
          title: `Odhacz kryteria bramki fazy „${phase.name}"`,
          detail: `${b.text} Bramka to warunek wyjścia — bez niej faza się nie domknie, nawet z zadaniami na zielono.`,
          action: { view: "process", phaseId: phase.id },
        });
      }
    });
  }

  /* --- rytm sprintów --- */
  if (!sprint) {
    const backlog = backlogTasks(project).filter((t) => t.status !== "done");
    if (project.sprints.length === 0) {
      steps.push({
        level: "do",
        title: "Załóż pierwszy sprint",
        detail:
          "Fazy mówią CO ma być zrobione, sprint mówi KIEDY. Bez sprintu praca nie ma ram czasowych.",
        action: { view: "sprint" },
      });
    } else {
      steps.push({
        level: "do",
        title: "Żaden sprint nie jest aktywny",
        detail: `W backlogu czeka ${backlog.length} otwartych zadań. Zaplanuj kolejny sprint i ustal jego cel.`,
        action: { view: "sprint" },
      });
    }
  } else {
    const s = sprintSummary(project, sprint);

    if (!sprint.goal.trim()) {
      steps.push({
        level: "block",
        title: `Sprint ${sprint.number} nie ma celu`,
        detail:
          "Cel sprintu to jedno zdanie, które zespół umie powtórzyć z pamięci. Lista zadań to nie cel.",
        action: { view: "sprint" },
      });
    }

    const planning = (sprint.ceremonies || []).find((c) => c.key === "planning");
    if (planning && !planning.done) {
      steps.push({
        level: "do",
        title: "Przeprowadź sprint planning",
        detail: "Sprint jest aktywny, ale planning nie został odhaczony.",
        action: { view: "sprint" },
      });
    }

    if (s.tasks.length === 0) {
      steps.push({
        level: "block",
        title: `Sprint ${sprint.number} jest pusty`,
        detail: "Weź zadania z backlogu, inaczej sprint nie ma zakresu.",
        action: { view: "sprint" },
      });
    }

    if (s.daysLeft != null && s.daysLeft < 0) {
      steps.push({
        level: "block",
        title: `Sprint ${sprint.number} skończył się ${Math.abs(s.daysLeft)} dni temu`,
        detail:
          "Domknij go: zrób review i retrospektywę, a niedowiezione zadania wróć do backlogu.",
        action: { view: "sprint" },
      });
    } else if (s.daysLeft != null && s.daysLeft <= 2 && s.remaining > 0) {
      steps.push({
        level: "block",
        title: `Zostały ${s.daysLeft} dni sprintu, a ${s.remaining} pkt jest niedowiezione`,
        detail:
          "Nie da się dowieźć wszystkiego — zdecyduj świadomie, co wypada, zamiast czekać na koniec.",
        action: { view: "sprint" },
      });
    }

    // Prognoza tempa: liniowa, ale wystarczająca żeby zapalić lampkę wcześnie.
    if (s.elapsedDays != null && s.elapsedDays > 1 && s.totalDays && s.committed > 0) {
      const expected = (s.committed * s.elapsedDays) / s.totalDays;
      if (s.completed < expected * 0.7) {
        steps.push({
          level: "hint",
          title: "Sprint jest za wolny względem tempa",
          detail: `Po ${s.elapsedDays} z ${s.totalDays} dni dowieziono ${s.completed} z ${s.committed} pkt. Przy tym tempie sprint się nie domknie.`,
          action: { view: "sprint" },
        });
      }
    }
  }

  /* --- zadania po terminie --- */
  const overdue = project.tasks.filter(
    (t) => t.status !== "done" && t.dueDate && daysUntil(t.dueDate) < 0
  );
  if (overdue.length > 0) {
    steps.push({
      level: "block",
      title: `${overdue.length} zadań po terminie`,
      detail: "Przesuń termin albo zdejmij zadanie — martwy termin przestaje cokolwiek znaczyć.",
      action: { view: "board", overdueOnly: true },
    });
  }

  /* --- podpowiedzi jakościowe --- */
  const unassigned = project.tasks.filter(
    (t) => t.status !== "done" && t.sprintId && !t.assignee
  );
  if (unassigned.length > 0) {
    steps.push({
      level: "hint",
      title: `${unassigned.length} zadań w sprincie nie ma właściciela`,
      detail: "Zadanie bez właściciela jest zadaniem niczyim.",
      action: { view: "board" },
    });
  }

  const noPoints = project.tasks.filter((t) => t.sprintId && t.points == null);
  if (noPoints.length > 0) {
    steps.push({
      level: "hint",
      title: `${noPoints.length} zadań w sprincie bez estymaty`,
      detail: "Bez punktów nie policzysz velocity, a bez velocity nie zaplanujesz kolejnego sprintu.",
      action: { view: "board" },
    });
  }

  const v = velocity(project);
  if (v.samples >= 2) {
    const last = v.history[v.history.length - 1];
    if (last.committed > 0 && last.completed / last.committed < 0.6) {
      steps.push({
        level: "hint",
        title: "Poprzedni sprint dowiózł mniej niż 60% zobowiązania",
        detail: `Średnia velocity to ${v.avg} pkt. Bierz tyle, a nie tyle, ile chciałbyś zdążyć.`,
        action: { view: "sprint" },
      });
    }
  }

  return steps;
}

/** Jedno zdanie do nagłówka — gdzie jesteśmy w procesie. */
export function processHeadline(project) {
  const current = currentPhaseEntry(project);
  const total = project.phases.length;
  if (total === 0) return "Projekt bez zdefiniowanego procesu";
  if (!current) return "Proces zakończony — wszystkie fazy domknięte";
  return `Faza ${current.phase.order} z ${total}: ${current.phase.name}`;
}
