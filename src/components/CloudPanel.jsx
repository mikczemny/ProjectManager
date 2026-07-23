import React, { useState } from "react";
import { Cloud, CloudOff, RefreshCw, Check, LogOut, AlertTriangle, Mail } from "lucide-react";
import { C, inputStyle, primaryButton, ghostButton } from "../theme.js";
import { ModalShell, ModalHeader, Muted } from "./ui.jsx";
import { sendMagicLink } from "../cloud/sync.js";

const STATUS = {
  idle: { icon: CloudOff, color: C.mutedDim, label: "Praca lokalna" },
  loading: { icon: RefreshCw, color: C.mutedDim, label: "Sprawdzanie…" },
  syncing: { icon: RefreshCw, color: C.amber, label: "Synchronizacja…" },
  synced: { icon: Check, color: C.green, label: "Zsynchronizowane" },
  offline: { icon: CloudOff, color: C.amber, label: "Offline — zapiszę później" },
  conflict: { icon: AlertTriangle, color: C.red, label: "Konflikt zmian" },
  error: { icon: AlertTriangle, color: C.red, label: "Błąd synchronizacji" },
};

export default function CloudPanel({ cloud }) {
  const [showLogin, setShowLogin] = useState(false);

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
                onClick={cloud.logout}
                title="Wyloguj"
                style={{ background: "none", border: "none", color: C.mutedDim, display: "flex", padding: 2 }}
              >
                <LogOut size={12} />
              </button>
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10, color: C.mutedDim,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}
            >
              {cloud.session.user.email}
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
      {cloud.hasConflict && (
        <ConflictModal conflict={cloud.conflict} onResolve={cloud.resolveConflict} />
      )}
    </>
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

function ConflictModal({ conflict, onResolve }) {
  const remoteProjects = conflict?.state?.projects?.length ?? 0;

  return (
    <ModalShell onClose={() => {}} width={480}>
      <ModalHeader title="Konflikt zmian" />
      <Muted size={12.5}>
        Inne urządzenie zapisało zmiany, zanim zdążyły dolecieć Twoje. Nie nadpisuję niczego
        automatycznie — wybierz, która wersja jest właściwa. Druga zostanie utracona, więc jeśli
        nie masz pewności, zrób najpierw kopię przyciskiem „Kopia" w pasku bocznym.
      </Muted>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => onResolve("local")}
          style={{
            textAlign: "left", background: C.elevated, border: `1px solid ${C.amber}`,
            borderRadius: 9, padding: "12px 14px", color: C.text,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
            Zachowaj wersję z tego urządzenia
          </div>
          <div style={{ fontSize: 12, color: C.mutedDim }}>
            To, co widzisz teraz na ekranie, nadpisze zapis w chmurze.
          </div>
        </button>

        <button
          onClick={() => onResolve("remote")}
          style={{
            textAlign: "left", background: C.elevated, border: `1px solid ${C.border}`,
            borderRadius: 9, padding: "12px 14px", color: C.text,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
            Pobierz wersję z chmury
          </div>
          <div style={{ fontSize: 12, color: C.mutedDim }}>
            Zapis z drugiego urządzenia ({remoteProjects} projektów) zastąpi to, co masz tutaj.
          </div>
        </button>
      </div>
    </ModalShell>
  );
}
