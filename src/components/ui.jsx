import React from "react";
import { X, Check as CheckIcon } from "lucide-react";
import { C, ghostButton, primaryButton } from "../theme.js";
import { initials, memberColor } from "../lib/format.js";

export function ModalShell({ onClose, children, width = 460 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,11,15,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          width,
          maxWidth: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
      {onClose && (
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted }}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function ModalActions({ onCancel, onConfirm, confirmLabel = "Zapisz", disabled }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
      <button onClick={onCancel} style={ghostButton}>
        Anuluj
      </button>
      <button onClick={onConfirm} disabled={disabled} style={primaryButton(!disabled)}>
        {confirmLabel}
      </button>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          color: C.mutedDim,
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.mutedDim, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Avatar({ member, size = 26 }) {
  if (!member) return null;
  return (
    <div
      className="mono"
      title={member.name}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: memberColor(member.id),
        color: C.bg,
        fontSize: size * 0.4,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials(member.name)}
    </div>
  );
}

export function ProgressBar({ pct, color = C.amber, height = 4 }) {
  return (
    <div
      style={{
        flex: 1,
        height,
        borderRadius: height / 2,
        background: C.border,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: "100%",
          background: color,
          transition: "width 0.2s",
        }}
      />
    </div>
  );
}

export function Badge({ children, color = C.mutedDim, solid = false }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 6px",
        borderRadius: 4,
        background: solid ? color : `${color}22`,
        color: solid ? C.bg : color,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Panel({ children, style = {}, accent }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderLeft: accent ? `2px solid ${accent}` : `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{children}</div>
      {right}
    </div>
  );
}

export function Muted({ children, size = 13 }) {
  return <div style={{ fontSize: size, color: C.mutedDim, lineHeight: 1.55 }}>{children}</div>;
}

/** Checkbox w stylu aplikacji — używany w bramkach i ceremoniach. */
export function Check({ checked, onChange, label, sub, disabled }) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onChange}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange();
        }
      }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          marginTop: 1,
          flexShrink: 0,
          border: `1px solid ${checked ? C.green : C.borderLight}`,
          background: checked ? C.green : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <CheckIcon size={11} color={C.bg} strokeWidth={3} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            color: checked ? C.muted : C.text,
            textDecoration: checked ? "line-through" : "none",
            lineHeight: 1.45,
          }}
        >
          {label}
        </span>
        {sub && (
          <span className="mono" style={{ display: "block", fontSize: 10.5, color: C.mutedDim, marginTop: 2 }}>
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}
