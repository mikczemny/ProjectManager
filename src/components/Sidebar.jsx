import React, { useRef, useState } from "react";
import { Plus, Folder, Trash2, Download, Upload, LayoutTemplate } from "lucide-react";
import { C } from "../theme.js";
import { Avatar, ProgressBar } from "./ui.jsx";
import { projectProgress } from "../domain/selectors.js";
import { currentPhaseEntry } from "../domain/guidance.js";
import { exportAll, readImportFile } from "../domain/storage.js";

export default function Sidebar({
  state, activeProjectId, dispatch, onSelect, onNewProject, onOpenTemplates,
}) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState("");

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { kind, payload } = await readImportFile(file);
      if (kind === "backup") {
        if (
          !confirm(
            "Wczytanie kopii zapasowej zastąpi WSZYSTKIE bieżące dane. Kontynuować?"
          )
        )
          return;
        dispatch({ type: "replaceState", state: payload });
        setMsg("Kopia wczytana.");
      } else if (kind === "project") {
        dispatch({ type: "importProject", project: payload });
        setMsg("Projekt zaimportowany.");
      } else {
        dispatch({ type: "importTemplate", template: payload });
        setMsg("Szablon zaimportowany.");
      }
      setTimeout(() => setMsg(""), 3000);
    } catch (err) {
      setMsg(err.message);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  return (
    <aside
      className="sidebar"
      style={{
        width: 250,
        background: C.panel,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24, height: 24, borderRadius: 6, background: C.amber,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: C.bg }}>&gt;_</span>
          </div>
          <span className="mono" style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>
            projekty.dev
          </span>
        </div>
      </div>

      <div style={{ padding: "0 12px", flex: 1, overflowY: "auto" }}>
        <div
          style={{
            fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8,
            color: C.mutedDim, padding: "8px 8px 6px", fontWeight: 600,
          }}
        >
          Projekty
        </div>

        {state.projects.length === 0 && (
          <div style={{ fontSize: 13, color: C.mutedDim, padding: "4px 8px 12px" }}>
            Brak projektów.
          </div>
        )}

        {state.projects.map((p) => {
          const progress = projectProgress(p);
          const current = currentPhaseEntry(p);
          const active = p.id === activeProjectId;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="hoverbox"
              style={{
                padding: "9px 10px", borderRadius: 8, marginBottom: 3, cursor: "pointer",
                background: active ? C.elevated : "transparent",
                border: active ? `1px solid ${C.borderLight}` : "1px solid transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <Folder size={13} color={active ? C.amber : C.mutedDim} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 13.5, fontWeight: 500,
                      color: active ? C.text : C.muted,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Usunąć projekt "${p.name}"?`)) {
                      dispatch({ type: "deleteProject", projectId: p.id });
                    }
                  }}
                  style={{ background: "none", border: "none", color: C.mutedDim, padding: 2, display: "flex", flexShrink: 0 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {current && (
                <div className="mono" style={{ fontSize: 9.5, color: C.mutedDim, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {String(current.phase.order).padStart(2, "0")} · {current.phase.name.toUpperCase()}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                <ProgressBar pct={progress.pct} height={3} />
                <span className="mono" style={{ fontSize: 10, color: C.mutedDim }}>{progress.pct}%</span>
              </div>
            </div>
          );
        })}

        <button
          onClick={onNewProject}
          className="hoverbox"
          style={{
            width: "100%", marginTop: 6, display: "flex", alignItems: "center", gap: 7,
            padding: "9px 10px", borderRadius: 8, background: "transparent",
            border: `1px dashed ${C.borderLight}`, color: C.muted, fontSize: 13,
          }}
        >
          <Plus size={14} /> Nowy projekt
        </button>

        <button
          onClick={onOpenTemplates}
          className="hoverbox"
          style={{
            width: "100%", marginTop: 6, display: "flex", alignItems: "center", gap: 7,
            padding: "9px 10px", borderRadius: 8, background: "transparent",
            border: "1px solid transparent", color: C.muted, fontSize: 13,
          }}
        >
          <LayoutTemplate size={14} /> Szablony procesów
        </button>
      </div>

      {/* --- zespół --- */}
      <div style={{ padding: "12px 12px 8px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, color: C.mutedDim, padding: "0 8px 6px", fontWeight: 600 }}>
          Zespół
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 8px" }}>
          {state.team.length === 0 && <span style={{ fontSize: 12, color: C.mutedDim }}>Brak członków</span>}
          {state.team.map((m) => <Avatar key={m.id} member={m} />)}
        </div>
      </div>

      {/* --- dane --- */}
      <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => exportAll(state)}
            title="Eksportuj wszystko do JSON"
            style={dataButton}
          >
            <Download size={12} /> Kopia
          </button>
          <button onClick={() => fileRef.current?.click()} title="Wczytaj JSON" style={dataButton}>
            <Upload size={12} /> Wczytaj
          </button>
          <input ref={fileRef} type="file" accept="application/json" onChange={handleImport} style={{ display: "none" }} />
        </div>
        {msg && <div style={{ fontSize: 11, color: C.teal, marginTop: 6 }}>{msg}</div>}
      </div>
    </aside>
  );
}

const dataButton = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  padding: "6px 8px",
  borderRadius: 7,
  background: "transparent",
  border: `1px solid ${C.border}`,
  color: C.muted,
  fontSize: 11.5,
};
