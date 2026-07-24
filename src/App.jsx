import React, { useEffect, useState } from "react";
import {
  Clock, Compass, LayoutTemplate, ListChecks, Users, Flag, FolderPlus, Download, BookMarked,
} from "lucide-react";
import { C } from "./theme.js";
import { LOCAL_USER } from "./domain/schema.js";
import { StoreProvider, useStore } from "./state/store.jsx";
import { useCloudSync } from "./cloud/useCloudSync.js";
import { captureTokenFromUrl, readPendingToken } from "./cloud/invitations.js";
import AcceptInvitation from "./components/AcceptInvitation.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TaskModal from "./components/TaskModal.jsx";
import { NewProjectModal, AddMemberModal, SaveAsTemplateModal } from "./components/modals.jsx";
import NowView from "./views/NowView.jsx";
import ProcessView from "./views/ProcessView.jsx";
import SprintView from "./views/SprintView.jsx";
import BoardView from "./views/BoardView.jsx";
import TeamView from "./views/TeamView.jsx";
import TemplatesView from "./views/TemplatesView.jsx";
import TemplateEditor from "./views/TemplateEditor.jsx";
import { formatDuration } from "./lib/format.js";
import { projectTime, isTimerRunning } from "./domain/selectors.js";
import { processHeadline, nextSteps } from "./domain/guidance.js";
import { exportProject } from "./domain/storage.js";

const TABS = [
  { key: "now", label: "Co teraz", icon: Compass },
  { key: "process", label: "Proces", icon: ListChecks },
  { key: "sprint", label: "Sprint", icon: Flag },
  { key: "board", label: "Tablica", icon: LayoutTemplate },
  { key: "team", label: "Zespół", icon: Users },
];

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { state, dispatch, activeProject, allTemplates } = useStore();
  const cloud = useCloudSync(state, dispatch);
  /**
   * Tożsamość, na którą zapisywany jest czas pracy. Bez zalogowania jest to
   * stała lokalna — dzięki temu tryb offline działa bez żadnego konta.
   */
  const currentUserId = cloud.session?.user?.id || LOCAL_USER;

  /**
   * Domknięcie fazy. Lokalnie decyduje reducer, w trybie zespołowym baza —
   * bo tylko ona widzi, czy bramka jest spełniona w tej sekundzie, a nie
   * w chwili ostatniego odświeżenia ekranu.
   */
  const closePhase = async (phaseId) => {
    if (cloud.mode !== "cloud") {
      dispatch({ type: "closePhase", projectId: activeProject.id, phaseId });
      return;
    }
    try {
      const r = await cloud.closePhase(phaseId);
      if (r && !r.ok) {
        alert(
          `Bramka nie jest spełniona: ${r.openTasks} niezrobionych zadań, ` +
            `${r.openCriteria} nieodhaczonych kryteriów. ` +
            `Ktoś mógł zmienić stan zanim kliknąłeś.`
        );
      }
    } catch (e) {
      alert(`Nie udało się domknąć fazy: ${e.message}`);
    }
  };

  const closeSprint = async (sprintId) => {
    if (cloud.mode !== "cloud") {
      dispatch({ type: "closeSprint", projectId: activeProject.id, sprintId });
      return;
    }
    try {
      await cloud.closeSprint(sprintId);
    } catch (e) {
      alert(`Nie udało się domknąć sprintu: ${e.message}`);
    }
  };

  const [view, setView] = useState("now");
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [focusPhaseId, setFocusPhaseId] = useState(null);
  const [filter, setFilter] = useState({});
  const [modal, setModal] = useState(null); // null | "newProject" | "addMember" | "saveTemplate"
  const [presetTemplateId, setPresetTemplateId] = useState(null);
  /** null = tworzymy nowy szablon; obiekt = edytujemy istniejący. */
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [, forceTick] = useState(0);

  /**
   * Token zaproszenia z adresu. Wyjmujemy go raz, przy pierwszym renderze —
   * dalej żyje w localStorage, żeby przetrwał logowanie magic linkiem, które
   * wraca pod goły adres i gubi parametry.
   */
  const [inviteToken, setInviteToken] = useState(
    () => captureTokenFromUrl() || readPendingToken()
  );

  /* Odświeżanie zegarów tylko wtedy, gdy cokolwiek tyka. */
  useEffect(() => {
    const anyRunning = state.projects.some((p) => p.tasks.some((t) => isTimerRunning(t)));
    if (!anyRunning) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state.projects]);

  /** Przejście z widoku „Co teraz?" — krok wie, gdzie się go wykonuje. */
  const navigate = (action) => {
    if (!action) return;
    if (action.phaseId) setFocusPhaseId(action.phaseId);
    if (action.view === "board") {
      setFilter({
        ...(action.phaseId ? { phaseId: action.phaseId } : {}),
        ...(action.overdueOnly ? { overdueOnly: true } : {}),
      });
    }
    setView(action.view);
  };

  const activeTask =
    activeProject?.tasks.find((t) => t.id === activeTaskId) || null;

  const createProject = (name, template) => {
    dispatch({ type: "createProject", name, template });
    setModal(null);
    setPresetTemplateId(null);
    setView("now");
  };

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
        input, textarea, select { font-family: inherit; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .hoverbox:hover { background: ${C.elevated} !important; }
        a { text-decoration: none; }
        @media (max-width: 720px) { .sidebar { display: none !important; } }
      `}</style>

      <Sidebar
        state={state}
        cloud={cloud}
        activeProjectId={state.settings.activeProjectId}
        dispatch={dispatch}
        onSelect={(id) => {
          dispatch({ type: "setActiveProject", id });
          setView("now");
          setFilter({});
        }}
        onNewProject={() => setModal("newProject")}
        onOpenTemplates={() => setView("templates")}
      />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {view === "templateEditor" ? (
          <>
            <SimpleBar
              title={editingTemplate ? `Edycja: ${editingTemplate.name || "nowy szablon"}` : "Nowy szablon"}
            />
            <TemplateEditor
              template={editingTemplate}
              onCancel={() => {
                setEditingTemplate(null);
                setView("templates");
              }}
              onSave={(template) => {
                dispatch({ type: "upsertTemplate", template });
                setEditingTemplate(null);
                setView("templates");
              }}
            />
          </>
        ) : view === "templates" ? (
          <>
            <SimpleBar title="Szablony procesów" onBack={activeProject ? () => setView("now") : null} />
            <TemplatesView
              templates={allTemplates}
              activeProject={activeProject}
              dispatch={dispatch}
              onUseTemplate={(t) => {
                setPresetTemplateId(t.id);
                setModal("newProject");
              }}
              onSaveAsTemplate={() => setModal("saveTemplate")}
              onCreate={() => {
                setEditingTemplate(null);
                setView("templateEditor");
              }}
              onEdit={(t) => {
                setEditingTemplate(t);
                setView("templateEditor");
              }}
            />
          </>
        ) : activeProject ? (
          <>
            <TopBar
              project={activeProject}
              view={view}
              setView={setView}
              onSaveTemplate={() => setModal("saveTemplate")}
            />
            {view === "now" && <NowView project={activeProject} onNavigate={navigate} />}
            {view === "process" && (
              <ProcessView
                project={activeProject}
                dispatch={dispatch}
                focusPhaseId={focusPhaseId}
                onOpenTask={setActiveTaskId}
                onClosePhase={closePhase}
              />
            )}
            {view === "sprint" && (
              <SprintView
                project={activeProject}
                dispatch={dispatch}
                onOpenTask={setActiveTaskId}
                onCloseSprint={closeSprint}
              />
            )}
            {view === "board" && (
              <BoardView
                project={activeProject}
                team={state.team}
                dispatch={dispatch}
                currentUserId={currentUserId}
                filter={filter}
                setFilter={setFilter}
                onOpenTask={setActiveTaskId}
              />
            )}
            {view === "team" && (
              <TeamView
                project={activeProject}
                team={state.team}
                dispatch={dispatch}
                cloud={cloud}
                onAdd={() => setModal("addMember")}
              />
            )}
          </>
        ) : (
          <EmptyState onNewProject={() => setModal("newProject")} onTemplates={() => setView("templates")} />
        )}
      </main>

      {activeTask && (
        <TaskModal
          task={activeTask}
          project={activeProject}
          team={state.team}
          dispatch={dispatch}
          currentUserId={currentUserId}
          onClose={() => setActiveTaskId(null)}
        />
      )}

      {/* Zaproszenie ma pierwszeństwo przed resztą — użytkownik trafił tu
          właśnie po to, a bez konta i tak nie zobaczy wspólnych danych. */}
      {inviteToken && cloud.configured && (
        <AcceptInvitation
          token={inviteToken}
          cloud={cloud}
          onDone={() => setInviteToken(null)}
        />
      )}

      {modal === "newProject" && (
        <NewProjectModal
          templates={allTemplates}
          preselectedId={presetTemplateId}
          onClose={() => {
            setModal(null);
            setPresetTemplateId(null);
          }}
          onCreate={createProject}
        />
      )}

      {modal === "addMember" && (
        <AddMemberModal
          onClose={() => setModal(null)}
          onAdd={(name, role) => {
            dispatch({ type: "addMember", name, role });
            setModal(null);
          }}
        />
      )}

      {modal === "saveTemplate" && activeProject && (
        <SaveAsTemplateModal
          project={activeProject}
          onClose={() => setModal(null)}
          onSave={(name, description) => {
            dispatch({
              type: "saveProjectAsTemplate",
              projectId: activeProject.id,
              name,
              description,
            });
            setModal(null);
            setView("templates");
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function TopBar({ project, view, setView, onSaveTemplate }) {
  const steps = nextSteps(project);
  const blocking = steps.filter((s) => s.level === "block").length;

  return (
    <div
      style={{
        padding: "14px 24px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{project.name}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ color: C.amber }}>{processHeadline(project)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={12} />
            <span className="mono">{formatDuration(projectTime(project))}</span>
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 4, background: C.panel, padding: 4, borderRadius: 9, border: `1px solid ${C.border}` }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = view === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 11px",
                  borderRadius: 6, border: "none",
                  background: active ? C.elevated : "transparent",
                  color: active ? C.text : C.muted,
                  fontSize: 12.5, fontWeight: 500, position: "relative",
                }}
              >
                <Icon size={13} /> {t.label}
                {t.key === "now" && blocking > 0 && (
                  <span
                    className="mono"
                    style={{
                      background: C.red, color: C.bg, borderRadius: 8,
                      fontSize: 9, fontWeight: 700, padding: "1px 5px",
                    }}
                  >
                    {blocking}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button onClick={onSaveTemplate} title="Zapisz jako szablon" style={iconButton}>
          <BookMarked size={14} />
        </button>
        <button onClick={() => exportProject(project)} title="Eksportuj projekt" style={iconButton}>
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function SimpleBar({ title, onBack }) {
  return (
    <div
      style={{
        padding: "16px 24px",
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{title}</div>
      {onBack && (
        <button onClick={onBack} style={{ ...iconButton, width: "auto", padding: "6px 12px", fontSize: 12.5 }}>
          Wróć do projektu
        </button>
      )}
    </div>
  );
}

function EmptyState({ onNewProject, onTemplates }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 24 }}>
      <div
        className="mono"
        style={{
          width: 52, height: 52, borderRadius: 12, background: C.panel,
          border: `1px solid ${C.border}`, display: "flex", alignItems: "center",
          justifyContent: "center", color: C.amber, fontSize: 20,
        }}
      >
        &gt;_
      </div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Brak wybranego projektu</div>
      <div style={{ fontSize: 13, color: C.mutedDim, maxWidth: 380, textAlign: "center", lineHeight: 1.6 }}>
        Załóż projekt na bazie szablonu procesu. Program poprowadzi zespół przez kolejne fazy i nie
        wpuści was dalej, dopóki bramka poprzedniej nie zostanie spełniona.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={onNewProject}
          style={{
            display: "flex", alignItems: "center", gap: 7, background: C.amber, border: "none",
            borderRadius: 8, padding: "9px 16px", color: C.bg, fontSize: 13, fontWeight: 600,
          }}
        >
          <FolderPlus size={15} /> Nowy projekt
        </button>
        <button
          onClick={onTemplates}
          style={{
            display: "flex", alignItems: "center", gap: 7, background: "none",
            border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 16px",
            color: C.muted, fontSize: 13,
          }}
        >
          <LayoutTemplate size={15} /> Zobacz szablony
        </button>
      </div>
    </div>
  );
}

const iconButton = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: 32,
  height: 32,
  borderRadius: 8,
  background: C.panel,
  border: `1px solid ${C.border}`,
  color: C.muted,
};
