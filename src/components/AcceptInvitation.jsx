import React, { useEffect, useState } from "react";
import { Mail, Check, AlertTriangle, LogIn } from "lucide-react";
import { C, primaryButton, ghostButton, inputStyle } from "../theme.js";
import { ModalShell, ModalHeader, Muted, Badge } from "./ui.jsx";
import { peekInvitation, acceptInvitation, clearPendingToken } from "../cloud/invitations.js";
import { sendMagicLink } from "../cloud/sync.js";
import { formatDate } from "../lib/format.js";

const ROLE_LABEL = {
  manager: "manager",
  member: "zespół",
  viewer: "podgląd",
};

/** Powody, dla których zaproszenie nie działa — po ludzku, nie kodem błędu. */
const PROBLEM = {
  not_found: {
    title: "Nie znamy tego zaproszenia",
    text: "Link jest niepełny albo zaproszenie zostało usunięte. Poproś o nowy.",
  },
  revoked: {
    title: "Zaproszenie zostało cofnięte",
    text: "Osoba, która je wystawiła, unieważniła ten link. Poproś o nowy.",
  },
  already_accepted: {
    title: "To zaproszenie zostało już wykorzystane",
    text: "Każdy link działa raz. Jeśli to nie Ty go użyłeś, powiedz o tym właścicielowi przestrzeni.",
  },
  expired: {
    title: "Zaproszenie straciło ważność",
    text: "Linki są ważne przez tydzień. Poproś o nowy.",
  },
};

/**
 * Ekran przyjęcia zaproszenia.
 *
 * Pojawia się, gdy w adresie był token. Prowadzi przez logowanie, jeśli trzeba —
 * bez konta nie da się przyjąć zaproszenia, bo członkostwo wiąże się z kontem.
 */
export default function AcceptInvitation({ token, cloud, onDone }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);

  const loggedIn = Boolean(cloud.session?.user);
  const myEmail = cloud.session?.user?.email;

  useEffect(() => {
    let alive = true;
    peekInvitation(token)
      .then((d) => alive && setInfo(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [token]);

  const close = () => {
    clearPendingToken();
    onDone();
  };

  const accept = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await acceptInvitation(token);
      setResult(r);
      if (r.status === "accepted" || r.status === "already_member") {
        clearPendingToken();
        // Świeże członkostwo musi trafić na listę przestrzeni, inaczej
        // użytkownik zobaczy pustkę mimo udanego przyjęcia.
        await cloud.reloadWorkspaces?.(r.workspace_id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const login = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await sendMagicLink(email.trim());
      setLinkSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  /* --- po przyjęciu --- */
  if (result?.status === "accepted" || result?.status === "already_member") {
    return (
      <ModalShell onClose={close} width={440}>
        <ModalHeader title="Witaj w zespole" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 0" }}>
          <Check size={30} color={C.green} />
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>
            {result.status === "already_member"
              ? "Należysz już do tej przestrzeni"
              : "Zaproszenie przyjęte"}
          </div>
          <Muted size={12.5}>
            {result.status === "already_member"
              ? "Twoja dotychczasowa rola została zachowana."
              : "Masz teraz dostęp do wspólnych projektów zespołu."}
          </Muted>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={close} style={primaryButton(true)}>Zaczynamy</button>
        </div>
      </ModalShell>
    );
  }

  /* --- adres się nie zgadza --- */
  if (result?.status === "email_mismatch") {
    return (
      <ModalShell onClose={close} width={460}>
        <ModalHeader title="Zaproszenie na inny adres" onClose={close} />
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={C.amber} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <Muted size={12.5}>
              To zaproszenie wystawiono na adres <strong style={{ color: C.text }}>{result.expected}</strong>,
              a Ty jesteś zalogowany jako <strong style={{ color: C.text }}>{myEmail}</strong>.
            </Muted>
            <Muted size={12.5}>
              Zgodność adresu jest wymagana celowo — bez niej przechwycony link wpuszczałby
              dowolną osobę. Zaloguj się na właściwy adres albo poproś o zaproszenie na ten,
              którego używasz.
            </Muted>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button onClick={close} style={ghostButton}>Zamknij</button>
          <button onClick={cloud.logout} style={primaryButton(true)}>Wyloguj i zmień konto</button>
        </div>
      </ModalShell>
    );
  }

  /* --- zaproszenie nieważne --- */
  const problem = info && info.status !== "valid" ? PROBLEM[info.status] : null;
  if (problem) {
    return (
      <ModalShell onClose={close} width={440}>
        <ModalHeader title={problem.title} onClose={close} />
        <Muted size={12.5}>{problem.text}</Muted>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={close} style={primaryButton(true)}>Rozumiem</button>
        </div>
      </ModalShell>
    );
  }

  /* --- wczytywanie --- */
  if (!info) {
    return (
      <ModalShell onClose={close} width={420}>
        <ModalHeader title="Zaproszenie do zespołu" onClose={close} />
        <Muted size={12.5}>{error || "Sprawdzam zaproszenie…"}</Muted>
      </ModalShell>
    );
  }

  /* --- zaproszenie ważne --- */
  return (
    <ModalShell onClose={close} width={460}>
      <ModalHeader title="Zaproszenie do zespołu" onClose={close} />

      <div
        style={{
          background: C.elevated, border: `1px solid ${C.border}`,
          borderLeft: `2px solid ${C.teal}`, borderRadius: 8, padding: "12px 14px",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{info.workspace}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge color={C.teal}>rola: {ROLE_LABEL[info.role] || info.role}</Badge>
          <span className="mono" style={{ fontSize: 10.5, color: C.mutedDim }}>
            dla {info.email} · ważne do {formatDate(info.expires_at)}
          </span>
        </div>
      </div>

      {loggedIn ? (
        <>
          <div style={{ marginTop: 14 }}>
            <Muted size={12.5}>
              Jesteś zalogowany jako <strong style={{ color: C.text }}>{myEmail}</strong>.
            </Muted>
          </div>
          {error && <div style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button onClick={close} style={ghostButton}>Nie teraz</button>
            <button onClick={accept} disabled={busy} style={primaryButton(!busy)}>
              <Check size={14} /> {busy ? "Przyjmowanie…" : "Przyjmij zaproszenie"}
            </button>
          </div>
        </>
      ) : linkSent ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "18px 0 6px" }}>
          <Mail size={26} color={C.green} />
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sprawdź skrzynkę</div>
          <Muted size={12.5}>
            Po kliknięciu linka wrócisz tutaj, a zaproszenie będzie czekać — nie musisz otwierać go
            ponownie.
          </Muted>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 14 }}>
            <Muted size={12.5}>
              Żeby przyjąć zaproszenie, zaloguj się na adres <strong style={{ color: C.text }}>{info.email}</strong>.
              Wyślemy link — hasło nie jest potrzebne.
            </Muted>
          </div>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder={info.email}
            style={{ ...inputStyle, marginTop: 10 }}
          />
          {error && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <button onClick={close} style={ghostButton}>Nie teraz</button>
            <button onClick={login} disabled={busy || !email.trim()} style={primaryButton(!busy && !!email.trim())}>
              <LogIn size={14} /> {busy ? "Wysyłanie…" : "Wyślij link"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
