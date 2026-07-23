/* ---------------------------------------------------------------------- */
/*  Design tokens + wspólne style                                          */
/* ---------------------------------------------------------------------- */
export const C = {
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
  blue: "#7BA3D9",
};

export const STATUSES = [
  { key: "todo", label: "Do zrobienia", color: C.mutedDim },
  { key: "inprogress", label: "W trakcie", color: C.amber },
  { key: "review", label: "Review", color: C.purple },
  { key: "done", label: "Zrobione", color: C.green },
];

export const PRIORITIES = {
  low: { label: "Niski", color: C.mutedDim },
  medium: { label: "Średni", color: C.teal },
  high: { label: "Wysoki", color: C.red },
};

/** Typy zadań w produkcji software'u. */
export const TASK_TYPES = {
  feature: { label: "Feature", color: C.teal, short: "FEAT" },
  bug: { label: "Bug", color: C.red, short: "BUG" },
  chore: { label: "Chore", color: C.mutedDim, short: "CHORE" },
  spike: { label: "Spike", color: C.purple, short: "SPIKE" },
  docs: { label: "Dokumentacja", color: C.blue, short: "DOCS" },
  release: { label: "Release", color: C.amber, short: "REL" },
};

export const inputStyle = {
  width: "100%",
  background: C.elevated,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  fontSize: 13.5,
  padding: "9px 11px",
  outline: "none",
};

export const selectStyle = {
  background: C.elevated,
  border: `1px solid ${C.border}`,
  borderRadius: 7,
  color: C.text,
  fontSize: 12.5,
  padding: "6px 8px",
  outline: "none",
};

export const primaryButton = (enabled = true) => ({
  background: enabled ? C.amber : C.border,
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  color: enabled ? C.bg : C.mutedDim,
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 6,
});

export const ghostButton = {
  background: "none",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "8px 14px",
  color: C.muted,
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

export const sectionLabel = {
  fontSize: 11,
  color: C.mutedDim,
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  fontWeight: 600,
};
