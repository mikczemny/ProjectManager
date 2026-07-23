import React, { useState } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, ShieldCheck,
  ListChecks, Save, X, AlertTriangle,
} from "lucide-react";
import { C, inputStyle, selectStyle, primaryButton, ghostButton, PRIORITIES, TASK_TYPES } from "../theme.js";
import { Panel, Muted, Badge } from "../components/ui.jsx";
import { makeTemplate } from "../domain/schema.js";

/** Pusta faza w kształcie, jakiego oczekuje szablon (kryteria to teksty). */
const emptyPhase = (order) => ({
  order,
  name: "",
  tip: "",
  gate: "",
  criteria: [],
  tasks: [],
});

const emptyTask = () => ({
  title: "",
  priority: "medium",
  type: "feature",
  estimateH: null,
  points: null,
});

export default function TemplateEditor({ template, onSave, onCancel }) {
  // Edytor pracuje na kopii roboczej — anulowanie nie zostawia śladu w stanie.
  const [draft, setDraft] = useState(
    () => structuredClone(template) || makeTemplate({ name: "", description: "", phases: [] })
  );
  const [openPhase, setOpenPhase] = useState(draft.phases[0] ? 0 : null);

  const patch = (p) => setDraft((d) => ({ ...d, ...p }));

  const patchPhase = (index, p) =>
    setDraft((d) => ({
      ...d,
      phases: d.phases.map((ph, i) => (i === index ? { ...ph, ...p } : ph)),
    }));

  const addPhase = () => {
    setDraft((d) => ({ ...d, phases: [...d.phases, emptyPhase(d.phases.length + 1)] }));
    setOpenPhase(draft.phases.length);
  };

  const removePhase = (index) =>
    setDraft((d) => ({
      ...d,
      phases: d.phases.filter((_, i) => i !== index).map((ph, i) => ({ ...ph, order: i + 1 })),
    }));

  const movePhase = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= draft.phases.length) return;
    setDraft((d) => {
      const phases = [...d.phases];
      [phases[index], phases[target]] = [phases[target], phases[index]];
      return { ...d, phases: phases.map((ph, i) => ({ ...ph, order: i + 1 })) };
    });
    setOpenPhase(target);
  };

  /* --- walidacja: blokujemy zapis szablonu, który nie da się użyć --- */
  const problems = [];
  if (!draft.name.trim()) problems.push("Szablon musi mieć nazwę.");
  draft.phases.forEach((ph, i) => {
    if (!ph.name.trim()) problems.push(`Faza ${i + 1} nie ma nazwy.`);
    ph.tasks.forEach((t, j) => {
      if (!t.title.trim()) problems.push(`Faza ${i + 1}, zadanie ${j + 1} nie ma tytułu.`);
    });
    ph.criteria.forEach((c, j) => {
      if (!c.trim()) problems.push(`Faza ${i + 1}, kryterium ${j + 1} jest puste.`);
    });
  });

  const totalTasks = draft.phases.reduce((s, p) => s + p.tasks.length, 0);
  const totalCriteria = draft.phases.reduce((s, p) => s + p.criteria.length, 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
      <div style={{ maxWidth: 860 }}>
        {/* --- nagłówek szablonu --- */}
        <Panel accent={C.amber} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10.5, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Nazwa szablonu
          </div>
          <input
            autoFocus
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="np. Produkcja aplikacji mobilnej"
            style={{ ...inputStyle, fontSize: 15, fontWeight: 600, marginBottom: 12 }}
          />
          <div style={{ fontSize: 10.5, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Opis
          </div>
          <textarea
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            placeholder="Do jakiego typu produkcji ten proces pasuje?"
            style={{ ...inputStyle, fontSize: 13, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <Badge color={C.purple}>{draft.phases.length} faz</Badge>
            <Badge color={C.teal}>{totalTasks} zadań</Badge>
            <Badge color={C.green}>{totalCriteria} kryteriów bramek</Badge>
          </div>
        </Panel>

        {/* --- fazy --- */}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Fazy procesu</div>
        <Muted>
          Kolejność faz to kolejność, w jakiej program poprowadzi zespół. Kryteria bramki są tym, co
          trzeba będzie odhaczyć, żeby przejść dalej — pisz je tak, żeby dało się na nie odpowiedzieć
          „tak" albo „nie".
        </Muted>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "14px 0" }}>
          {draft.phases.length === 0 && (
            <Panel>
              <Muted>Szablon nie ma jeszcze żadnej fazy.</Muted>
            </Panel>
          )}

          {draft.phases.map((phase, i) => (
            <PhaseEditor
              key={i}
              phase={phase}
              index={i}
              isFirst={i === 0}
              isLast={i === draft.phases.length - 1}
              open={openPhase === i}
              onToggle={() => setOpenPhase(openPhase === i ? null : i)}
              onPatch={(p) => patchPhase(i, p)}
              onRemove={() => removePhase(i)}
              onMove={(dir) => movePhase(i, dir)}
            />
          ))}
        </div>

        <button onClick={addPhase} style={{ ...ghostButton, width: "100%", justifyContent: "center" }}>
          <Plus size={14} /> Dodaj fazę
        </button>

        {/* --- walidacja --- */}
        {problems.length > 0 && (
          <Panel accent={C.red} style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <AlertTriangle size={14} color={C.red} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Do poprawy przed zapisem</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
              {problems.slice(0, 6).map((p, i) => <li key={i}>{p}</li>)}
              {problems.length > 6 && <li>…i {problems.length - 6} więcej</li>}
            </ul>
          </Panel>
        )}

        {/* --- akcje --- */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingBottom: 20 }}>
          <button onClick={onCancel} style={ghostButton}>
            <X size={14} /> Anuluj
          </button>
          <button
            onClick={() => onSave(draft)}
            disabled={problems.length > 0}
            style={primaryButton(problems.length === 0)}
          >
            <Save size={14} /> Zapisz szablon
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function PhaseEditor({ phase, index, isFirst, isLast, open, onToggle, onPatch, onRemove, onMove }) {
  const [newCriterion, setNewCriterion] = useState("");
  const [newTask, setNewTask] = useState("");

  const patchTask = (i, p) =>
    onPatch({ tasks: phase.tasks.map((t, j) => (j === i ? { ...t, ...p } : t)) });

  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${open ? C.borderLight : C.border}`,
        borderLeft: `2px solid ${C.amber}`,
        borderRadius: 10,
      }}
    >
      {/* nagłówek fazy */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
        <button
          onClick={onToggle}
          style={{ background: "none", border: "none", color: C.mutedDim, display: "flex", padding: 2 }}
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>

        <span
          className="mono"
          style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: C.elevated, border: `1px solid ${C.border}`,
            color: C.amber, fontSize: 11, fontWeight: 700,
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <input
          value={phase.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Nazwa fazy…"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: C.text, fontSize: 13.5, fontWeight: 600, minWidth: 0,
          }}
        />

        <span className="mono" style={{ fontSize: 10, color: C.mutedDim, whiteSpace: "nowrap" }}>
          {phase.tasks.length} zad · {phase.criteria.length} kryt
        </span>

        <button onClick={() => onMove(-1)} disabled={isFirst} style={iconBtn(isFirst)} title="W górę">
          <ChevronUp size={13} />
        </button>
        <button onClick={() => onMove(1)} disabled={isLast} style={iconBtn(isLast)} title="W dół">
          <ChevronDown size={13} />
        </button>
        <button
          onClick={() => {
            if (confirm(`Usunąć fazę „${phase.name || index + 1}" z szablonu?`)) onRemove();
          }}
          style={{ ...iconBtn(false), color: C.red }}
          title="Usuń fazę"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {open && (
        <div style={{ padding: "0 12px 14px", borderTop: `1px solid ${C.border}` }}>
          {/* rada mentora */}
          <div style={{ marginTop: 12 }}>
            <div style={labelStyle}>Rada mentora — po co ta faza i gdzie ludzie się wykładają</div>
            <textarea
              value={phase.tip}
              onChange={(e) => onPatch({ tip: e.target.value })}
              rows={2}
              placeholder="Ta rada wyświetli się zespołowi, gdy wejdzie w tę fazę…"
              style={{ ...inputStyle, fontSize: 12.5, resize: "vertical" }}
            />
          </div>

          {/* bramka */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <ShieldCheck size={13} color={C.teal} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Bramka wyjścia</span>
            </div>
            <input
              value={phase.gate}
              onChange={(e) => onPatch({ gate: e.target.value })}
              placeholder="Jednozdaniowe podsumowanie warunku przejścia dalej…"
              style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px", marginBottom: 8 }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {phase.criteria.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: C.green, fontSize: 12, flexShrink: 0 }}>☐</span>
                  <input
                    value={c}
                    onChange={(e) =>
                      onPatch({ criteria: phase.criteria.map((x, j) => (j === i ? e.target.value : x)) })
                    }
                    style={{ ...inputStyle, fontSize: 12.5, padding: "6px 9px" }}
                  />
                  <button
                    onClick={() => onPatch({ criteria: phase.criteria.filter((_, j) => j !== i) })}
                    style={{ ...iconBtn(false), color: C.mutedDim }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <input
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCriterion.trim()) {
                  onPatch({ criteria: [...phase.criteria, newCriterion.trim()] });
                  setNewCriterion("");
                }
              }}
              placeholder="+ dodaj kryterium i Enter"
              style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px", marginTop: 8 }}
            />
          </div>

          {/* zadania */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <ListChecks size={13} color={C.purple} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Zadania startowe</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {phase.tasks.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                    background: C.elevated, border: `1px solid ${C.border}`,
                    borderRadius: 7, padding: "7px 9px",
                  }}
                >
                  <input
                    value={t.title}
                    onChange={(e) => patchTask(i, { title: e.target.value })}
                    placeholder="Tytuł zadania…"
                    style={{
                      flex: 1, minWidth: 140, background: "transparent", border: "none",
                      outline: "none", color: C.text, fontSize: 12.5,
                    }}
                  />
                  <select
                    value={t.type}
                    onChange={(e) => patchTask(i, { type: e.target.value })}
                    style={{ ...selectStyle, fontSize: 11.5, padding: "4px 6px" }}
                  >
                    {Object.entries(TASK_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <select
                    value={t.priority}
                    onChange={(e) => patchTask(i, { priority: e.target.value })}
                    style={{ ...selectStyle, fontSize: 11.5, padding: "4px 6px" }}
                  >
                    {Object.entries(PRIORITIES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={t.points ?? ""}
                    onChange={(e) =>
                      patchTask(i, { points: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    placeholder="pkt"
                    title="Story points"
                    style={{ ...selectStyle, fontSize: 11.5, padding: "4px 6px", width: 52 }}
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={t.estimateH ?? ""}
                    onChange={(e) =>
                      patchTask(i, { estimateH: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    placeholder="godz"
                    title="Estymata w godzinach"
                    style={{ ...selectStyle, fontSize: 11.5, padding: "4px 6px", width: 58 }}
                  />
                  <button
                    onClick={() => onPatch({ tasks: phase.tasks.filter((_, j) => j !== i) })}
                    style={{ ...iconBtn(false), color: C.mutedDim }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTask.trim()) {
                  onPatch({ tasks: [...phase.tasks, { ...emptyTask(), title: newTask.trim() }] });
                  setNewTask("");
                }
              }}
              placeholder="+ dodaj zadanie i Enter"
              style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px", marginTop: 8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  fontSize: 10.5,
  color: C.mutedDim,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 4,
};

const iconBtn = (disabled) => ({
  background: "none",
  border: "none",
  color: disabled ? C.border : C.mutedDim,
  padding: 3,
  display: "flex",
  flexShrink: 0,
});
