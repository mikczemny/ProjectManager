import React, { useState } from "react";
import {
  Cloud, CloudOff, RefreshCw, Check, LogOut, AlertTriangle, Mail, Users, Plus, Upload,
} from "lucide-react";
import { C, inputStyle, primaryButton, ghostButton } from "../theme.js";
import { ModalShell, ModalHeader, Muted } from "./ui.jsx";
import { sendMagicLink } from "../cloud/sync.js";

const STATUS = {
  idle: { icon: CloudOff, color: C.mutedDim, label: "Praca lokalna" },
  loading: { icon: RefreshCw, color: C.mutedDim, label: "Sprawdzanie…" },
  "no-workspace": { icon: Users, color: C.amber, label: "Brak przestrzeni" },
  syncing: { icon: RefreshCw, color: C.amber, label: "Synchronizacja…" },
  synced: { icon: Check, color: C.green, label: "Zsynchronizowane" },
  offline: { icon: CloudOff, color: C.amber, label: "Offline — zapiszę później" },
  error: { icon: AlertTriangle, color: C.red, label: "Błąd synchronizacji" },
};

/** Odmiana przez liczbę — „1 zmiana", „2 zmiany", „5 zmian". */
function zmianaSlowo(n) {
  if (n === 1) return "zmiana";
  const dziesiatki = n % 100;
  const jednosci = n % 10;
  if (dziesiatki >= 12 && dziesiatki <= 14) return "zmian";
  return jednosci >= 2 && jednosci <= 4 ? "zmiany" : "zmian";
}

const ROLE_LABEL = {
  owner: "właściciel",
  manager: "manager",
  member: "zespół",
  viewer: "podgląd",
};

export default function CloudPanel({ cloud }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);

  // Bez konfiguracji nie zaśmiecamy interfejsu — aplikacja po prostu działa lokalnie.
  if (!cloud.configured) return null;

  const meta = STATUS[cloud.status] || STATUS.idle;
  const Icon = meta.icon;

  return (
    <>
      <div style={{ padding: "10px 12px", borderTop: `1px solid ${C.border}` }}>
        {cloud.session ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <Icon size={12} color={meta.color} />
              <span style={{ fontSize: 11, color: meta.color, flex: 1 }}>{meta.label}</span>
              <button
                onClick={cloud.refresh}
                title="Synchronizuj teraz"
                style={{ background: "none", border: "none", color: C.mutedDim, display: "flex", padding: 2 }}
              >
                <RefreshCw size={12} />
              </button>
              <button
                onClick={cloud.logout}
                title="Wyloguj"
                style={{ background: "none", border: "none", color: C.mutedDim, display: "flex", padding: 2 }}
              >
                <LogOut size={12} />
              </button>
            </div>

            {/* Kolejka niewysłanych zmian. Milczenie w tym miejscu kazałoby
                użytkownikowi zgadywać, czy jego praca gdzieś dotarła. */}
            {cloud.pendingCount > 0 && (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                  padding: "5px 7px", borderRadius: 6,
                  background: `${C.amber}14`, border: `1px solid ${C.amber}44`,
                }}
              >
                <Upload size={11} color={C.amber} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: C.amber, flex: 1 }}>
                  {cloud.pendingCount} {zmianaSlowo(cloud.pendingCount)} czeka na wysłanie
                </span>
              </div>
            )}

            {/* Kolejka trzyma się localStorage. Gdy zapis się nie powiódł,
                obietnica trwałości przestaje obowiązywać i trzeba to powiedzieć. */}
            {!cloud.queueDurable && (
              <div
                style={{
                  display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 6,
                  padding: "5px 7px", borderRadius: 6,
                  background: `${C.red}14`, border: `1px solid ${C.red}44`,
                }}
              >
                <AlertTriangle size={11} color={C.red} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 10.5, color: C.red, lineHeight: 1.4 }}>
                  Brak miejsca w przeglądarce — niewysłane zmiany nie przetrwają
                  przeładowania strony.
                </span>
              </div>
            )}
            {cloud.workspaces.length > 0 && (
              <select
                value={cloud.workspaceId || ""}
                onChange={(e) => cloud.selectWorkspace(e.target.value)}
                style={{
                  width: "100%", background: C.elevated, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.text, fontSize: 11.5, padding: "4px 6px",
                  outline: "none", marginBottom: 6,
                }}
              >
                {cloud.workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowWorkspace(true)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 5, padding: "5px 8px", borderRadius: 6, background: "transparent",
                border: `1px dashed ${C.border}`, color: C.mutedDim, fontSize: 11,
                marginBottom: 6,
              }}
            >
              <Plus size={11} /> Nowa przestrzeń zespołu
            </button>

            <div
              className="mono"
              style={{
                fontSize: 10, color: C.mutedDim,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {cloud.session.user.email}
              {cloud.role && ` · ${ROLE_LABEL[cloud.role] || cloud.role}`}
            </div>
            {cloud.error && (
              <div style={{ fontSize: 10.5, color: C.red, marginTop: 4 }}>{cloud.error}</div>
            )}
          </>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, padding: "7px 8px", borderRadius: 7, background: "transparent",
              border: `1px solid ${C.border}`, color: C.muted, fontSize: 11.5,
            }}
          >
            <Cloud size={12} /> Zaloguj i synchronizuj
          </button>
        )}
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showWorkspace && (
        <WorkspaceModal
          onClose={() => setShowWorkspace(false)}
          onCreate={async (name) => {
            await cloud.newWorkspace(name);
            setShowWorkspace(false);
          }}
        />
      )}
    </>
  );
}

function WorkspaceModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onCreate(name.trim());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} width={420}>
      <ModalHeader title="Nowa przestrzeń zespołu" onClose={onClose} />
      <Muted size={12.5}>
        Przestrzeń to wspólne dane zespołu — projekty, szablony i czas pracy. Zakładając ją,
        stajesz się właścicielem i możesz zapraszać kolejne osoby.
      </Muted>
      <Muted size={12}>
        Jeśli masz już projekty lokalnie, pierwsza pusta przestrzeń przejmie je automatycznie.
      </Muted>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="np. Zespół produktowy"
        style={{ ...inputStyle, marginTop: 14 }}
      />
      {error && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button onClick={onClose} style={ghostButton}>Anuluj</button>
        <button onClick={submit} disabled={busy || !name.trim()} style={primaryButton(!busy && !!name.trim())}>
          {busy ? "Tworzenie…" : "Utwórz"}
        </button>
      </div>
    </ModalShell>
  );
}

function LoginModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} width={420}>
      <ModalHeader title="Synchronizacja z chmurą" onClose={onClose} />
      {sent ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
          <Mail size={28} color={C.green} />
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sprawdź skrzynkę</div>
          <Muted size={12.5}>
            Wysłaliśmy link na <strong style={{ color: C.text }}>{email}</strong>. Kliknięcie go
            zaloguje Cię i uruchomi synchronizację. Link jest jednorazowy.
          </Muted>
        </div>
      ) : (
        <>
          <Muted size={12.5}>
            Logowanie odbywa się linkiem wysyłanym mailem — aplikacja nie zna i nie przechowuje
            żadnego hasła. Twoje projekty trafią do chmury i będą dostępne z każdego urządzenia.
          </Muted>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="twoj@email.pl"
            style={{ ...inputStyle, marginTop: 14 }}
          />
          {error && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={ghostButton}>Anuluj</button>
            <button onClick={submit} disabled={busy || !email.trim()} style={primaryButton(!busy && !!email.trim())}>
              {busy ? "Wysyłanie…" : "Wyślij link"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

