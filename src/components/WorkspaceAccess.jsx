import React, { useCallback, useEffect, useState } from "react";
import {
  UserPlus, Copy, Check, Trash2, Clock, ShieldCheck, AlertTriangle, RefreshCw,
} from "lucide-react";
import { C, inputStyle, selectStyle, primaryButton, ghostButton } from "../theme.js";
import { Panel, Muted, SectionTitle, Badge } from "./ui.jsx";
import { formatDate } from "../lib/format.js";
import {
  createInvitation, listInvitations, revokeInvitation,
  listMembers, removeMemberFromWorkspace,
} from "../cloud/invitations.js";

const ROLE_LABEL = {
  owner: "właściciel",
  manager: "manager",
  member: "zespół",
  viewer: "podgląd",
};

const ROLE_COLOR = {
  owner: C.amber,
  manager: C.purple,
  member: C.teal,
  viewer: C.mutedDim,
};

const ROLE_HELP = {
  manager: "domyka fazy i sprinty, zarządza szablonami i zaprasza",
  member: "pracuje na zadaniach, odhacza kryteria, mierzy swój czas",
  viewer: "wyłącznie odczyt",
};

/**
 * Zarządzanie dostępem do przestrzeni.
 *
 * Świadomie oddzielone od listy zespołu wyżej: tam są osoby, którym przypisuje
 * się zadania — również takie, które nie mają konta. Tutaj są konta widzące
 * dane przestrzeni. To dwie różne rzeczy i mylenie ich kończy się albo
 * niepotrzebnymi kontami, albo zadaniami przypisanymi w próżnię.
 */
export default function WorkspaceAccess({ cloud }) {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);

  const canInvite = cloud.role === "owner" || cloud.role === "manager";
  const isOwner = cloud.role === "owner";

  const refresh = useCallback(async () => {
    if (!cloud.workspaceId) return;
    setLoading(true);
    setError("");
    try {
      const [m, i] = await Promise.all([
        listMembers(cloud.workspaceId),
        canInvite ? listInvitations(cloud.workspaceId) : Promise.resolve([]),
      ]);
      setMembers(m);
      setInvitations(i);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cloud.workspaceId, canInvite]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const invite = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await createInvitation(cloud.workspaceId, email.trim(), role);
      setEmail("");
      await refresh();
      // Link od razu w schowku — to jedyna droga, żeby dotarł do zapraszanego,
      // bo aplikacja nie wysyła maili.
      await copy(created.link, created.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setError("Nie udało się skopiować. Zaznacz link i skopiuj ręcznie.");
    }
  };

  if (cloud.mode !== "cloud") return null;

  return (
    <div style={{ marginTop: 32 }}>
      <SectionTitle
        right={
          <button onClick={refresh} style={{ ...ghostButton, padding: "5px 10px" }}>
            <RefreshCw size={12} /> Odśwież
          </button>
        }
      >
        Dostęp do przestrzeni
      </SectionTitle>
      <Muted>
        To nie to samo co lista zespołu wyżej. Tam są osoby, którym przypisujesz zadania — również
        takie, które nie mają konta. Tutaj są konta, które widzą dane tej przestrzeni.
      </Muted>

      {error && (
        <Panel accent={C.red} style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: C.red }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        </Panel>
      )}

      {/* --- osoby z dostępem --- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        {loading && <Muted size={12.5}>Wczytywanie…</Muted>}
        {!loading && members.map((m) => {
          const self = m.user_id === cloud.session?.user?.id;
          return (
            <Panel key={m.user_id} style={{ padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ShieldCheck size={14} color={ROLE_COLOR[m.role]} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, wordBreak: "break-all" }}>
                    {m.email}
                    {self && <span style={{ color: C.mutedDim }}> — to Ty</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: C.mutedDim, marginTop: 2 }}>
                    dołączył {formatDate(m.created_at)}
                  </div>
                </div>
                <Badge color={ROLE_COLOR[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                {isOwner && !self && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Odebrać dostęp dla ${m.email}?`)) return;
                      try {
                        await removeMemberFromWorkspace(cloud.workspaceId, m.user_id);
                        await refresh();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                    title="Odbierz dostęp"
                    style={{ background: "none", border: "none", color: C.mutedDim, display: "flex" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* --- zaproszenia oczekujące --- */}
      {canInvite && invitations.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: C.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Zaproszenia oczekujące
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {invitations.map((i) => (
              <Panel key={i.id} style={{ padding: "10px 12px" }} accent={C.amber}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Clock size={13} color={C.amber} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: 12.5, wordBreak: "break-all" }}>{i.email}</div>
                    <div className="mono" style={{ fontSize: 10, color: C.mutedDim, marginTop: 2 }}>
                      ważne do {formatDate(i.expires_at)}
                    </div>
                  </div>
                  <Badge color={ROLE_COLOR[i.role]}>{ROLE_LABEL[i.role]}</Badge>
                  <button
                    onClick={() => copy(i.link, i.id)}
                    title="Kopiuj link zaproszenia"
                    style={{ ...ghostButton, padding: "4px 9px", fontSize: 11.5 }}
                  >
                    {copiedId === i.id ? <Check size={12} color={C.green} /> : <Copy size={12} />}
                    {copiedId === i.id ? "skopiowano" : "kopiuj link"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Cofnąć zaproszenie dla ${i.email}?`)) return;
                      try {
                        await revokeInvitation(i.id);
                        await refresh();
                      } catch (e) {
                        setError(e.message);
                      }
                    }}
                    title="Cofnij zaproszenie"
                    style={{ background: "none", border: "none", color: C.mutedDim, display: "flex" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

      {/* --- nowe zaproszenie --- */}
      {canInvite && (
        <Panel style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
            <UserPlus size={14} color={C.teal} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Zaproś do przestrzeni</span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
              placeholder="adres@email.pl"
              style={{ ...inputStyle, flex: 1, minWidth: 180, fontSize: 12.5, padding: "7px 10px" }}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={selectStyle}>
              {isOwner && <option value="manager">Manager</option>}
              <option value="member">Zespół</option>
              <option value="viewer">Podgląd</option>
            </select>
            <button onClick={invite} disabled={busy || !email.trim()} style={primaryButton(!busy && !!email.trim())}>
              <UserPlus size={13} /> {busy ? "Tworzenie…" : "Utwórz link"}
            </button>
          </div>

          <div style={{ fontSize: 11.5, color: C.mutedDim, marginTop: 8, lineHeight: 1.5 }}>
            {ROLE_HELP[role]}
          </div>

          <div
            style={{
              fontSize: 11.5, color: C.muted, marginTop: 12, lineHeight: 1.55,
              background: C.elevated, borderRadius: 6, padding: "9px 11px",
              borderLeft: `2px solid ${C.teal}`,
            }}
          >
            Aplikacja nie wysyła maili — link trafia do schowka i przekazujesz go sam. Traktuj go
            jak hasło: kto go ma, ten może wejść, o ile loguje się na wskazany adres. Link traci
            ważność po tygodniu, a nowe zaproszenie dla tego samego adresu unieważnia poprzednie.
          </div>
        </Panel>
      )}

      {!canInvite && (
        <Muted size={12.5}>
          Zapraszanie wymaga roli manager lub właściciel.
        </Muted>
      )}
    </div>
  );
}
