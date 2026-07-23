import React, { useState } from "react";
import { Check } from "lucide-react";
import { C, inputStyle } from "../theme.js";
import { ModalShell, ModalHeader, ModalActions, Muted } from "./ui.jsx";

export function NewProjectModal({ templates, preselectedId, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(preselectedId || templates[0]?.id);

  const submit = () => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!name.trim() || !tpl) return;
    onCreate(name.trim(), tpl);
  };

  return (
    <ModalShell onClose={onClose} width={520}>
      <ModalHeader title="Nowy projekt" onClose={onClose} />

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Nazwa
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="np. Mirage v2.0"
          style={inputStyle}
        />
      </div>

      <div style={{ fontSize: 11, color: C.mutedDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Proces
      </div>
      <Muted size={12}>
        Szablon wgrywa fazy i bramki, przez które program was przeprowadzi.
      </Muted>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0 4px" }}>
        {templates.map((t) => (
          <div
            key={t.id}
            onClick={() => setTemplateId(t.id)}
            style={{
              border: `1px solid ${templateId === t.id ? C.amber : C.border}`,
              background: templateId === t.id ? `${C.amber}14` : C.elevated,
              borderRadius: 9,
              padding: "10px 12px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
              {templateId === t.id && <Check size={14} color={C.amber} />}
            </div>
            <div style={{ fontSize: 12, color: C.mutedDim, marginTop: 2, lineHeight: 1.45 }}>
              {t.description}
            </div>
            {t.phases.length > 0 && (
              <div className="mono" style={{ fontSize: 10.5, color: C.teal, marginTop: 6, lineHeight: 1.5 }}>
                {t.phases.map((p) => p.name).join(" → ")}
              </div>
            )}
          </div>
        ))}
      </div>

      <ModalActions
        onCancel={onClose}
        onConfirm={submit}
        confirmLabel="Utwórz projekt"
        disabled={!name.trim()}
      />
    </ModalShell>
  );
}

export function AddMemberModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  return (
    <ModalShell onClose={onClose} width={380}>
      <ModalHeader title="Dodaj osobę" onClose={onClose} />
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && onAdd(name.trim(), role.trim())}
        placeholder="Imię i nazwisko"
        style={{ ...inputStyle, marginBottom: 10 }}
      />
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && onAdd(name.trim(), role.trim())}
        placeholder="Rola (np. backend, PO, QA)"
        style={inputStyle}
      />
      <ModalActions
        onCancel={onClose}
        onConfirm={() => onAdd(name.trim(), role.trim())}
        confirmLabel="Dodaj"
        disabled={!name.trim()}
      />
    </ModalShell>
  );
}

export function SaveAsTemplateModal({ project, onClose, onSave }) {
  const [name, setName] = useState(`${project.name} (szablon)`);
  const [description, setDescription] = useState(project.description || "");

  return (
    <ModalShell onClose={onClose} width={480}>
      <ModalHeader title="Zapisz projekt jako szablon" onClose={onClose} />
      <Muted size={12.5}>
        Zapisane zostaną fazy, bramki i zadania — bez czasu pracy, przypisań i komentarzy. Od teraz
        każda kolejna produkcja może wystartować z tego procesu.
      </Muted>
      <div style={{ marginTop: 14 }}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nazwa szablonu"
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Do jakiego typu produkcji ten proces pasuje?"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>
      <ModalActions
        onCancel={onClose}
        onConfirm={() => onSave(name.trim(), description.trim())}
        confirmLabel="Zapisz szablon"
        disabled={!name.trim()}
      />
    </ModalShell>
  );
}
