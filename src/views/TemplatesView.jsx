import React, { useRef, useState } from "react";
import { Download, Upload, Trash2, Lock, BookMarked, FolderPlus } from "lucide-react";
import { C, primaryButton, ghostButton } from "../theme.js";
import { Panel, Muted, SectionTitle, Badge } from "../components/ui.jsx";
import { exportTemplate, readImportFile } from "../domain/storage.js";

export default function TemplatesView({ templates, activeProject, dispatch, onUseTemplate, onSaveAsTemplate }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const { kind, payload } = await readImportFile(file);
      if (kind !== "template") {
        setError("Ten plik nie zawiera szablonu. Import projektów i kopii zapasowych jest w pasku bocznym.");
        return;
      }
      dispatch({ type: "importTemplate", template: payload });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 820 }}>
        <SectionTitle
          right={
            <div style={{ display: "flex", gap: 8 }}>
              {activeProject && (
                <button onClick={onSaveAsTemplate} style={ghostButton}>
                  <BookMarked size={13} /> Zapisz bieżący projekt jako szablon
                </button>
              )}
              <button onClick={() => fileRef.current?.click()} style={ghostButton}>
                <Upload size={13} /> Wczytaj
              </button>
              <input ref={fileRef} type="file" accept="application/json" onChange={handleImport} style={{ display: "none" }} />
            </div>
          }
        >
          Szablony procesów
        </SectionTitle>
        <Muted>
          Szablon to zapis tego, jak POWINNO się prowadzić dany typ produkcji: fazy, bramki i
          startowe zadania. Każda produkcja, która się sprawdziła, może stać się szablonem kolejnej —
          to jest cała idea tego narzędzia.
        </Muted>

        {error && (
          <Panel accent={C.red} style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, color: C.red }}>{error}</div>
          </Panel>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
          {templates.map((t) => (
            <Panel key={t.id}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</span>
                    {t.builtIn ? (
                      <Badge color={C.mutedDim}>
                        <Lock size={9} style={{ verticalAlign: -1 }} /> wbudowany
                      </Badge>
                    ) : (
                      <Badge color={C.teal}>własny</Badge>
                    )}
                    <Badge color={C.purple}>{t.phases.length} faz</Badge>
                    <Badge color={C.mutedDim}>
                      {t.phases.reduce((s, p) => s + (p.tasks?.length || 0), 0)} zadań
                    </Badge>
                  </div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                    {t.description}
                  </div>
                  {t.phases.length > 0 && (
                    <div className="mono" style={{ fontSize: 10.5, color: C.teal, marginTop: 8, lineHeight: 1.6 }}>
                      {t.phases.map((p) => p.name).join(" → ")}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => onUseTemplate(t)} style={primaryButton(true)}>
                    <FolderPlus size={13} /> Użyj
                  </button>
                  <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => exportTemplate(t)}
                      title="Eksportuj do JSON"
                      style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: 5, color: C.muted }}
                    >
                      <Download size={12} />
                    </button>
                    {!t.builtIn && (
                      <button
                        onClick={() => {
                          if (confirm(`Usunąć szablon „${t.name}"? Projekty z niego utworzone zostają nienaruszone.`)) {
                            dispatch({ type: "deleteTemplate", templateId: t.id });
                          }
                        }}
                        title="Usuń szablon"
                        style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: 5, color: C.red }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
