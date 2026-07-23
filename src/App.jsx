import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Clock, Play, Pause, MessageSquare, User, X, ChevronDown,
  Check, Trash2, Folder, Users, LayoutTemplate, GripVertical,
  AlertCircle, Circle, Sparkles, ArrowLeft, Send, FolderPlus
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/*  Tokens                                                                 */
/* ---------------------------------------------------------------------- */
const C = {
  bg: "#14161C",
  panel: "#1B1E27",
  elevated: "#232734",
  border: "#2C3140",
  borderLight: "#383E4F",
  text: "#E7E5DE",
  muted: "#8A8FA0",
  mutedDim: "#5D6274",
  amber: "#E0A458",
  teal: "#5FA8A0",
  purple: "#8E7FC7",
  green: "#6FA98A",
  red: "#C46A5D",
};

const STATUSES = [
  { key: "todo", label: "Do zrobienia", color: C.mutedDim },
  { key: "inprogress", label: "W trakcie", color: C.amber },
  { key: "review", label: "Review", color: C.purple },
  { key: "done", label: "Zrobione", color: C.green },
];

const PRIORITIES = {
  low: { label: "Niski", color: C.mutedDim },
  medium: { label: "Średni", color: C.teal },
  high: { label: "Wysoki", color: C.red },
};

/* ---------------------------------------------------------------------- */
/*  Template: Rozwój oprogramowania                                        */
/* ---------------------------------------------------------------------- */
const SOFTWARE_TEMPLATE = {
  id: "software-dev",
  name: "Rozwój oprogramowania",
  description: "Pełny cykl produkcji software'u — od zakresu MVP po wdrożenie.",
  phases: [
    {
      order: 1,
      name: "Planowanie",
      tip: "Zanim napiszesz pierwszą linijkę kodu, spisz czego NIE robisz w wersji 1.0. Najczęstsza przyczyna poślizgów to rozmyty zakres, nie brak umiejętności.",
      tasks: [
        { title: "Zdefiniuj zakres MVP", priority: "high" },
        { title: "Spisz wymagania funkcjonalne", priority: "medium" },
        { title: "Wybierz stack technologiczny", priority: "medium" },
        { title: "Oszacuj harmonogram i kamienie milowe", priority: "medium" },
      ],
    },
    {
      order: 2,
      name: "Projektowanie",
      tip: "Zaprojektuj model danych i API zanim zaczniesz UI — zmiana schematu bazy po napisaniu frontendu kosztuje 5x więcej.",
      tasks: [
        { title: "Zaprojektuj model danych / schemat bazy", priority: "high" },
        { title: "Zaprojektuj kontrakty API", priority: "high" },
        { title: "Makiety kluczowych ekranów", priority: "medium" },
      ],
    },
    {
      order: 3,
      name: "Development",
      tip: "Buduj w pionowych plastrach (vertical slices) — jedna działająca funkcja end-to-end jest warta więcej niż dziesięć na wpół gotowych.",
      tasks: [
        { title: "Skonfiguruj repozytorium i CI", priority: "medium" },
        { title: "Zaimplementuj backend / API", priority: "high" },
        { title: "Zaimplementuj frontend", priority: "high" },
        { title: "Integracja backend-frontend", priority: "medium" },
      ],
    },
    {
      order: 4,
      name: "Testowanie",
      tip: "Testy pisane po fakcie łapią błędy, testy pisane przed implementacją zapobiegają im. Zacznij od ścieżek krytycznych, nie od 100% pokrycia.",
      tasks: [
        { title: "Testy jednostkowe kluczowej logiki", priority: "medium" },
        { title: "Testy end-to-end głównych ścieżek", priority: "medium" },
        { title: "Testy z realnymi użytkownikami", priority: "high" },
      ],
    },
    {
      order: 5,
      name: "Wdrożenie",
      tip: "Miej plan rollbacku zanim wdrożysz, nie po tym jak coś się posypie. Deploy w piątek po południu to żart, nie strategia.",
      tasks: [
        { title: "Przygotuj środowisko produkcyjne", priority: "high" },
        { title: "Skonfiguruj monitoring i logi", priority: "medium" },
        { title: "Wdrożenie produkcyjne", priority: "high" },
        { title: "Zbierz pierwszy feedback po wdrożeniu", priority: "low" },
      ],
    },
  ],
};

const BLANK_TEMPLATE = {
  id: "blank",
  name: "Pusty projekt",
  description: "Zacznij od zera, bez predefiniowanych zadań.",
  phases: [],
};

const TEMPLATES = [SOFTWARE_TEMPLATE, BLANK_TEMPLATE];

/* ---------------------------------------------------------------------- */
/*  Helpers                                                                 */
/* ---------------------------------------------------------------------- */
const uid = () => Math.random().toString(36).slice(2, 10);

function formatDuration(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}g ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function memberColor(id) {
  const palette = [C.amber, C.teal, C.purple, C.green, C.red, "#7BA3D9"];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}

function buildProjectFromTemplate(name, template) {
  const tasks = [];
  template.phases.forEach((phase) => {
    phase.tasks.forEach((t) => {
      tasks.push({
        id: uid(),
        title: t.title,
        description: "",
        status: "todo",
        priority: t.priority,
        phase: { order: phase.order, name: phase.name },
        assignee: null,
        timeSpent: 0,
        timerStartedAt: null,
        comments: [],
        createdAt: Date.now(),
      });
    });
  });
  return {
    id: uid(),
    name,
    description: template.description,
    templateId: template.id,
    createdAt: Date.now(),
    tasks,
  };
}

const STORAGE_KEY = "pm-app-state-v1";

/* ---------------------------------------------------------------------- */
/*  Main App                                                                */
/* ---------------------------------------------------------------------- */
export default function App() {
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [view, setView] = useState("board"); // board | team | mentor
  const [loaded, setLoaded] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [, forceTick] = useState(0);

  /* --- load / save persistence (localStorage) --- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setProjects(data.projects || []);
        setTeam(data.team || []);
        setActiveProjectId((data.projects && data.projects[0]?.id) || null);
      }
    } catch (e) {
      // no saved data yet
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, team }));
    } catch (e) {
      console.error("Storage save failed", e);
    }
  }, [projects, team, loaded]);

  /* --- ticking for running timers --- */
  useEffect(() => {
    const anyRunning = projects.some((p) =>
      p.tasks.some((t) => t.timerStartedAt)
    );
    if (!anyRunning) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [projects]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  /* --- project ops --- */
  const createProject = (name, template) => {
    const p = buildProjectFromTemplate(name, template);
    setProjects((prev) => [...prev, p]);
    setActiveProjectId(p.id);
    setShowNewProject(false);
    setView("board");
  };

  const deleteProject = (id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
  };

  /* --- task ops (scoped to active project) --- */
  const updateTasks = useCallback(
    (updater) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProjectId ? { ...p, tasks: updater(p.tasks) } : p
        )
      );
    },
    [activeProjectId]
  );

  const addTask = (title) => {
    if (!title.trim()) return;
    updateTasks((tasks) => [
      ...tasks,
      {
        id: uid(),
        title: title.trim(),
        description: "",
        status: "todo",
        priority: "medium",
        phase: null,
        assignee: null,
        timeSpent: 0,
        timerStartedAt: null,
        comments: [],
        createdAt: Date.now(),
      },
    ]);
  };

  const moveTask = (taskId, status) => {
    updateTasks((tasks) =>
      tasks.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  };

  const deleteTask = (taskId) => {
    updateTasks((tasks) => tasks.filter((t) => t.id !== taskId));
    if (activeTaskId === taskId) setActiveTaskId(null);
  };

  const patchTask = (taskId, patch) => {
    updateTasks((tasks) =>
      tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
    );
  };

  const toggleTimer = (task) => {
    if (task.timerStartedAt) {
      const elapsed = (Date.now() - task.timerStartedAt) / 1000;
      patchTask(task.id, {
        timeSpent: task.timeSpent + elapsed,
        timerStartedAt: null,
      });
    } else {
      patchTask(task.id, { timerStartedAt: Date.now() });
    }
  };

  const addComment = (taskId, text) => {
    if (!text.trim()) return;
    updateTasks((tasks) =>
      tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              comments: [
                ...t.comments,
                { id: uid(), text: text.trim(), createdAt: Date.now() },
              ],
            }
          : t
      )
    );
  };

  /* --- team ops --- */
  const addMember = (name) => {
    if (!name.trim()) return;
    setTeam((prev) => [...prev, { id: uid(), name: name.trim() }]);
    setShowAddMember(false);
  };

  const removeMember = (id) => {
    setTeam((prev) => prev.filter((m) => m.id !== id));
  };

  const activeTask =
    activeProject && activeProject.tasks.find((t) => t.id === activeTaskId);

  /* ---------------------------------------------------------------------- */
  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        background: C.bg,
        color: C.text,
        height: "100vh",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.borderLight}; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        button { font-family: inherit; cursor: pointer; }
        input, textarea { font-family: inherit; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .hoverbox:hover { background: ${C.elevated} !important; }
        @media (max-width: 720px) {
          .sidebar { display: none !important; }
        }
      `}</style>

      <Sidebar
        projects={projects}
        team={team}
        activeProjectId={activeProjectId}
        onSelect={(id) => {
          setActiveProjectId(id);
          setView("board");
        }}
        onNewProject={() => setShowNewProject(true)}
        onDeleteProject={deleteProject}
      />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {activeProject ? (
          <>
            <TopBar
              project={activeProject}
              view={view}
              setView={setView}
            />
            {view === "board" && (
              <Board
                project={activeProject}
                team={team}
                onMove={moveTask}
                onAddTask={addTask}
                onOpenTask={setActiveTaskId}
                onToggleTimer={toggleTimer}
                dragOverStatus={dragOverStatus}
                setDragOverStatus={setDragOverStatus}
              />
            )}
            {view === "team" && (
              <TeamView
                team={team}
                project={activeProject}
                onAdd={() => setShowAddMember(true)}
                onRemove={removeMember}
              />
            )}
            {view === "mentor" && <MentorView project={activeProject} />}
          </>
        ) : (
          <EmptyState onNewProject={() => setShowNewProject(true)} />
        )}
      </main>

      {activeTask && (
        <TaskModal
          task={activeTask}
          team={team}
          onClose={() => setActiveTaskId(null)}
          onPatch={(patch) => patchTask(activeTask.id, patch)}
          onDelete={() => deleteTask(activeTask.id)}
          onToggleTimer={() => toggleTimer(activeTask)}
          onAddComment={(text) => addComment(activeTask.id, text)}
        />
      )}

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={createProject}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          onClose={() => setShowAddMember(false)}
          onAdd={addMember}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Sidebar                                                                 */
/* ---------------------------------------------------------------------- */
function Sidebar({ projects, team, activeProjectId, onSelect, onNewProject, onDeleteProject }) {
  return (
    <aside
      className="sidebar"
      style={{
        width: 240,
        background: C.panel,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: C.amber,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: C.bg }}>
              &gt;_
            </span>
          </div>
          <span className="mono" style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>
            projekty.dev
          </span>
        </div>
      </div>

      <div style={{ padding: "0 12px", flex: 1, overflowY: "auto" }}>
        <div
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0.8,
            color: C.mutedDim,
            padding: "8px 8px 6px",
            fontWeight: 600,
          }}
        >
          Projekty
        </div>
        {projects.length === 0 && (
          <div style={{ fontSize: 13, color: C.mutedDim, padding: "4px 8px 12px" }}>
            Brak projektów.
          </div>
        )}
        {projects.map((p) => {
          const done = p.tasks.filter((t) => t.status === "done").length;
          const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
          const active = p.id === activeProjectId;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="hoverbox"
              style={{
                padding: "9px 10px",
                borderRadius: 8,
                marginBottom: 3,
                cursor: "pointer",
                background: active ? C.elevated : "transparent",
                border: active ? `1px solid ${C.borderLight}` : "1px solid transparent",
                group: "project-row",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <Folder size={13} color={active ? C.amber : C.mutedDim} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: active ? C.text : C.muted,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Usunąć projekt "${p.name}"?`)) onDeleteProject(p.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: C.mutedDim,
                    padding: 2,
                    display: "flex",
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: C.border, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: C.amber }} />
                </div>
                <span className="mono" style={{ fontSize: 10, color: C.mutedDim }}>{pct}%</span>
              </div>
            </div>
          );
        })}

        <button
          onClick={onNewProject}
          className="hoverbox"
          style={{
            width: "100%",
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 10px",
            borderRadius: 8,
            background: "transparent",
            border: `1px dashed ${C.borderLight}`,
            color: C.muted,
            fontSize: 13,
          }}
        >
          <Plus size={14} /> Nowy projekt
        </button>
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: C.mutedDim, padding: "0 8px 6px", fontWeight: 600 }}>
          Zespół
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 8px" }}>
          {team.length === 0 && <span style={{ fontSize: 12, color: C.mutedDim }}>Brak członków</span>}
          {team.map((m) => (
            <div
              key={m.id}
              title={m.name}
              className="mono"
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: memberColor(m.id),
                color: "#14161C",
                fontSize: 10.5,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {initials(m.name)}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------------- */
/*  Top bar                                                                 */
/* ---------------------------------------------------------------------- */
function TopBar({ project, view, setView }) {
  const totalTime = project.tasks.reduce((sum, t) => {
    const running = t.timerStartedAt ? (Date.now() - t.timerStartedAt) / 1000 : 0;
    return sum + t.timeSpent + running;
  }, 0);

  const tabs = [
    { key: "board", label: "Tablica", icon: LayoutTemplate },
    { key: "team", label: "Zespół", icon: Users },
    { key: "mentor", label: "Mentor", icon: Sparkles },
  ];

  return (
    <div
      style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{project.name}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={12} />
          <span className="mono">{formatDuration(totalTime)}</span>
          <span style={{ color: C.mutedDim }}>łącznie zarejestrowane</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, background: C.panel, padding: 4, borderRadius: 9, border: `1px solid ${C.border}` }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = view === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: active ? C.elevated : "transparent",
                color: active ? C.text : C.muted,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Board (kanban)                                                          */
/* ---------------------------------------------------------------------- */
function Board({ project, team, onMove, onAddTask, onOpenTask, onToggleTimer, dragOverStatus, setDragOverStatus }) {
  const [newTaskText, setNewTaskText] = useState({});

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
      <div style={{ display: "flex", gap: 14, minWidth: 900, height: "100%" }}>
        {STATUSES.map((col) => {
          const tasks = project.tasks.filter((t) => t.status === col.key);
          const isOver = dragOverStatus === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(col.key);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/task");
                if (taskId) onMove(taskId, col.key);
                setDragOverStatus(null);
              }}
              style={{
                flex: 1,
                minWidth: 240,
                background: isOver ? C.elevated : C.panel,
                border: `1px solid ${isOver ? col.color : C.border}`,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                transition: "background 0.12s, border-color 0.12s",
              }}
            >
              <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{col.label}</span>
                <span className="mono" style={{ fontSize: 11.5, color: C.mutedDim }}>{tasks.length}</span>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "4px 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    team={team}
                    onOpen={() => onOpenTask(task.id)}
                    onToggleTimer={() => onToggleTimer(task)}
                  />
                ))}
              </div>

              <div style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>
                <input
                  value={newTaskText[col.key] || ""}
                  onChange={(e) => setNewTaskText((s) => ({ ...s, [col.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && col.key === "todo") {
                      onAddTask(newTaskText[col.key] || "");
                      setNewTaskText((s) => ({ ...s, [col.key]: "" }));
                    }
                  }}
                  placeholder={col.key === "todo" ? "+ dodaj zadanie i Enter" : "—"}
                  disabled={col.key !== "todo"}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    fontSize: 12.5,
                    color: C.muted,
                    padding: "4px 4px",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, team, onOpen, onToggleTimer }) {
  const member = team.find((m) => m.id === task.assignee);
  const running = !!task.timerStartedAt;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const liveElapsed = running ? (Date.now() - task.timerStartedAt) / 1000 : 0;
  const total = task.timeSpent + liveElapsed;
  const prio = PRIORITIES[task.priority];

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/task", task.id)}
      onClick={onOpen}
      className="hoverbox"
      style={{
        background: C.elevated,
        border: `1px solid ${C.border}`,
        borderRadius: 9,
        padding: "10px 11px",
        cursor: "pointer",
      }}
    >
      {task.phase && (
        <div className="mono" style={{ fontSize: 10, color: C.mutedDim, marginBottom: 4, letterSpacing: 0.3 }}>
          {String(task.phase.order).padStart(2, "0")} · {task.phase.name.toUpperCase()}
        </div>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, marginBottom: 8 }}>{task.title}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              background: `${prio.color}22`,
              color: prio.color,
              fontWeight: 600,
            }}
          >
            {prio.label}
          </span>
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: running ? `${C.amber}22` : "transparent",
              border: `1px solid ${running ? C.amber : C.border}`,
              borderRadius: 5,
              padding: "3px 6px",
              color: running ? C.amber : C.mutedDim,
            }}
          >
            {running ? <Pause size={10} /> : <Play size={10} />}
            <span className="mono" style={{ fontSize: 10 }}>{formatDuration(total)}</span>
          </button>
          {member && (
            <div
              className="mono"
              title={member.name}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: memberColor(member.id),
                color: "#14161C",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {initials(member.name)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Task modal                                                              */
/* ---------------------------------------------------------------------- */
function TaskModal({ task, team, onClose, onPatch, onDelete, onToggleTimer, onAddComment }) {
  const [commentText, setCommentText] = useState("");
  const [, tick] = useState(0);
  const running = !!task.timerStartedAt;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const liveElapsed = running ? (Date.now() - task.timerStartedAt) / 1000 : 0;
  const total = task.timeSpent + liveElapsed;

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
          width: 560, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <input
            value={task.title}
            onChange={(e) => onPatch({ title: e.target.value })}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 16, fontWeight: 600 }}
          />
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          {task.phase && (
            <div className="mono" style={{ fontSize: 11, color: C.mutedDim }}>
              FAZA {String(task.phase.order).padStart(2, "0")} · {task.phase.name}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Status">
              <select
                value={task.status}
                onChange={(e) => onPatch({ status: e.target.value })}
                style={selectStyle}
              >
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Priorytet">
              <select
                value={task.priority}
                onChange={(e) => onPatch({ priority: e.target.value })}
                style={selectStyle}
              >
                {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Przypisany">
              <select
                value={task.assignee || ""}
                onChange={(e) => onPatch({ assignee: e.target.value || null })}
                style={selectStyle}
              >
                <option value="">— brak —</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <div>
            <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Opis</div>
            <textarea
              value={task.description}
              onChange={(e) => onPatch({ description: e.target.value })}
              placeholder="Dodaj opis zadania..."
              rows={3}
              style={{
                width: "100%", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8,
                color: C.text, fontSize: 13, padding: 10, resize: "vertical", outline: "none",
              }}
            />
          </div>

          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 9, padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={14} color={C.muted} />
              <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{formatDuration(total)}</span>
            </div>
            <button
              onClick={onToggleTimer}
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

          <div>
            <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Komentarze · dziennik zmian
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {task.comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 8, fontSize: 12.5 }}>
                  <span className="mono" style={{ color: C.teal, flexShrink: 0 }}>#{c.id.slice(0, 5)}</span>
                  <div>
                    <div style={{ color: C.text }}>{c.text}</div>
                    <div className="mono" style={{ color: C.mutedDim, fontSize: 10.5, marginTop: 1 }}>
                      {new Date(c.createdAt).toLocaleString("pl-PL")}
                    </div>
                  </div>
                </div>
              ))}
              {task.comments.length === 0 && (
                <div style={{ fontSize: 12.5, color: C.mutedDim }}>Brak komentarzy.</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onAddComment(commentText);
                    setCommentText("");
                  }
                }}
                placeholder="Dodaj komentarz..."
                style={{
                  flex: 1, background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 7,
                  color: C.text, fontSize: 12.5, padding: "8px 10px", outline: "none",
                }}
              />
              <button
                onClick={() => { onAddComment(commentText); setCommentText(""); }}
                style={{ background: C.amber, border: "none", borderRadius: 7, padding: "0 12px", color: C.bg }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => { if (confirm("Usunąć zadanie?")) onDelete(); }}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 12px", color: C.red, fontSize: 12.5,
            }}
          >
            <Trash2 size={13} /> Usuń zadanie
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: C.mutedDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      {children}
    </div>
  );
}

const selectStyle = {
  background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 7,
  color: C.text, fontSize: 12.5, padding: "6px 8px", outline: "none",
};

/* ---------------------------------------------------------------------- */
/*  Team view                                                               */
/* ---------------------------------------------------------------------- */
function TeamView({ team, project, onAdd, onRemove }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, maxWidth: 720 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Członkowie zespołu</div>
        <button
          onClick={onAdd}
          style={{
            display: "flex", alignItems: "center", gap: 6, background: C.amber, border: "none",
            borderRadius: 7, padding: "7px 12px", color: C.bg, fontSize: 12.5, fontWeight: 600,
          }}
        >
          <Plus size={14} /> Dodaj osobę
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 720 }}>
        {team.length === 0 && (
          <div style={{ color: C.mutedDim, fontSize: 13 }}>Brak osób w zespole. Dodaj pierwszą, żeby zacząć przypisywać zadania.</div>
        )}
        {team.map((m) => {
          const assigned = project.tasks.filter((t) => t.assignee === m.id);
          const done = assigned.filter((t) => t.status === "done").length;
          return (
            <div
              key={m.id}
              style={{
                display: "flex", alignItems: "center", gap: 12, background: C.panel,
                border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px",
              }}
            >
              <div
                className="mono"
                style={{
                  width: 34, height: 34, borderRadius: "50%", background: memberColor(m.id),
                  color: C.bg, fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {initials(m.name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.name}</div>
                <div style={{ fontSize: 11.5, color: C.mutedDim }}>
                  {assigned.length} zadań przypisanych · {done} ukończone
                </div>
              </div>
              <button
                onClick={() => onRemove(m.id)}
                style={{ background: "none", border: "none", color: C.mutedDim }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Mentor view                                                             */
/* ---------------------------------------------------------------------- */
function MentorView({ project }) {
  const template = TEMPLATES.find((t) => t.id === project.templateId);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Sparkles size={16} color={C.amber} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>Notatki mentora</div>
        </div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>
          Praktyczne zasady produkcji software'u, dopasowane do fazy, w której obecnie jest projekt.
        </p>

        {(!template || template.phases.length === 0) && (
          <div style={{ color: C.mutedDim, fontSize: 13 }}>
            Ten projekt nie korzysta z fazowego szablonu, więc nie ma tu dedykowanych porad — ale generalna zasada zawsze obowiązuje: rób mniej, kończ częściej.
          </div>
        )}

        {template && template.phases.map((phase) => {
          const phaseTasks = project.tasks.filter((t) => t.phase && t.phase.order === phase.order);
          const done = phaseTasks.filter((t) => t.status === "done").length;
          const complete = phaseTasks.length > 0 && done === phaseTasks.length;
          return (
            <div
              key={phase.order}
              style={{
                display: "flex", gap: 14, padding: "16px 0",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ flexShrink: 0, width: 34 }}>
                <div
                  className="mono"
                  style={{
                    width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                    background: complete ? `${C.green}22` : C.elevated,
                    border: `1px solid ${complete ? C.green : C.border}`,
                    color: complete ? C.green : C.muted, fontSize: 12, fontWeight: 700,
                  }}
                >
                  {complete ? <Check size={14} /> : String(phase.order).padStart(2, "0")}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{phase.name}</span>
                  {phaseTasks.length > 0 && (
                    <span className="mono" style={{ fontSize: 11, color: C.mutedDim }}>{done}/{phaseTasks.length}</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13, color: C.muted, lineHeight: 1.55, background: C.panel,
                    border: `1px solid ${C.border}`, borderLeft: `2px solid ${C.amber}`,
                    borderRadius: 6, padding: "10px 12px",
                  }}
                >
                  {phase.tip}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Empty state                                                             */
/* ---------------------------------------------------------------------- */
function EmptyState({ onNewProject }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
      <div
        className="mono"
        style={{
          width: 52, height: 52, borderRadius: 12, background: C.panel, border: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center", color: C.amber, fontSize: 20,
        }}
      >
        &gt;_
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Brak wybranego projektu</div>
      <div style={{ fontSize: 13, color: C.mutedDim, maxWidth: 300, textAlign: "center" }}>
        Utwórz pierwszy projekt, żeby zacząć planować, śledzić zadania i czas pracy.
      </div>
      <button
        onClick={onNewProject}
        style={{
          display: "flex", alignItems: "center", gap: 7, background: C.amber, border: "none",
          borderRadius: 8, padding: "9px 16px", color: C.bg, fontSize: 13, fontWeight: 600, marginTop: 4,
        }}
      >
        <FolderPlus size={15} /> Nowy projekt
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Modals: new project / add member                                       */
/* ---------------------------------------------------------------------- */
function ModalShell({ onClose, children, width = 420 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(10,11,15,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14,
          width, maxWidth: "100%", padding: 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(SOFTWARE_TEMPLATE.id);

  const submit = () => {
    if (!name.trim()) return;
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    onCreate(name.trim(), tpl);
  };

  return (
    <ModalShell onClose={onClose} width={460}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Nowy projekt</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Nazwa</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="np. Mirage v2.0"
          style={{
            width: "100%", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text, fontSize: 13.5, padding: "9px 11px", outline: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Szablon</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TEMPLATES.map((t) => (
            <div
              key={t.id}
              onClick={() => setTemplateId(t.id)}
              style={{
                border: `1px solid ${templateId === t.id ? C.amber : C.border}`,
                background: templateId === t.id ? `${C.amber}14` : C.elevated,
                borderRadius: 9, padding: "10px 12px", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
                {templateId === t.id && <Check size={14} color={C.amber} />}
              </div>
              <div style={{ fontSize: 12, color: C.mutedDim, marginTop: 2 }}>{t.description}</div>
              {t.phases.length > 0 && (
                <div className="mono" style={{ fontSize: 10.5, color: C.teal, marginTop: 6 }}>
                  {t.phases.map((p) => p.name).join(" → ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          onClick={onClose}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", color: C.muted, fontSize: 13 }}
        >
          Anuluj
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          style={{
            background: name.trim() ? C.amber : C.border, border: "none", borderRadius: 8, padding: "8px 14px",
            color: name.trim() ? C.bg : C.mutedDim, fontSize: 13, fontWeight: 600,
          }}
        >
          Utwórz projekt
        </button>
      </div>
    </ModalShell>
  );
}

function AddMemberModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  return (
    <ModalShell onClose={onClose} width={360}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Dodaj osobę</div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onAdd(name)}
        placeholder="Imię i nazwisko"
        style={{
          width: "100%", background: C.elevated, border: `1px solid ${C.border}`, borderRadius: 8,
          color: C.text, fontSize: 13.5, padding: "9px 11px", outline: "none", marginBottom: 16,
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          onClick={onClose}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", color: C.muted, fontSize: 13 }}
        >
          Anuluj
        </button>
        <button
          onClick={() => onAdd(name)}
          disabled={!name.trim()}
          style={{
            background: name.trim() ? C.amber : C.border, border: "none", borderRadius: 8, padding: "8px 14px",
            color: name.trim() ? C.bg : C.mutedDim, fontSize: 13, fontWeight: 600,
          }}
        >
          Dodaj
        </button>
      </div>
    </ModalShell>
  );
}
