import { useCallback, useEffect, useRef, useState } from "react";
import { isCloudConfigured } from "./client.js";
import { getSession, onAuthChange, pullState, pushState, signOut } from "./sync.js";

const PUSH_DEBOUNCE_MS = 1500;

/**
 * Spina store z chmurą.
 *
 * Zasady:
 *  - localStorage pozostaje magazynem podstawowym; chmura jest kopią i mostem
 *    między urządzeniami, a nie warunkiem działania aplikacji,
 *  - przy logowaniu wygrywa stan o wyższej rewizji — bez cichego kasowania
 *    pracy zrobionej offline,
 *  - konflikt (inne urządzenie zapisało w międzyczasie) nie jest rozstrzygany
 *    automatycznie, tylko oddany użytkownikowi.
 *
 * Zwraca stan połączenia i akcje dla interfejsu.
 */
export function useCloudSync(state, dispatch) {
  const [session, setSession] = useState(null);
  /** idle | loading | syncing | synced | offline | conflict | error */
  const [status, setStatus] = useState(isCloudConfigured ? "loading" : "idle");
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  /** Rewizja, którą ostatnio potwierdziła chmura. */
  const remoteRevision = useRef(0);
  /** Rewizja, którą ostatnio udało się wysłać — chroni przed pętlą zapisów. */
  const pushedRevision = useRef(null);
  const timer = useRef(null);
  const conflictRef = useRef(null);

  /* --- sesja --- */
  useEffect(() => {
    if (!isCloudConfigured) return;
    let alive = true;

    getSession()
      .then((s) => {
        if (!alive) return;
        setSession(s);
        if (!s) setStatus("idle");
      })
      .catch((e) => alive && setError(e.message));

    return onAuthChange((s) => {
      setSession(s);
      if (!s) {
        setStatus("idle");
        pushedRevision.current = null;
        remoteRevision.current = 0;
      }
    });
  }, []);

  /* --- pierwsze pobranie po zalogowaniu --- */
  useEffect(() => {
    if (!session?.user) return;
    let alive = true;
    setStatus("syncing");

    pullState(session.user.id)
      .then((remote) => {
        if (!alive) return;

        const localRevision = state.meta?.revision ?? 0;

        if (!remote) {
          // Pierwsze logowanie na tym koncie — chmura dostaje to, co mamy lokalnie.
          remoteRevision.current = 0;
          pushedRevision.current = null;
          setStatus("synced");
          return;
        }

        remoteRevision.current = remote.revision;

        if (remote.revision > localRevision) {
          dispatch({ type: "replaceState", state: remote.state });
          pushedRevision.current = remote.revision;
          setLastSyncedAt(Date.now());
          setStatus("synced");
        } else if (remote.revision < localRevision) {
          // Lokalnie jest nowsza praca — zostaje i zaraz poleci w górę.
          pushedRevision.current = remote.revision;
          setStatus("synced");
        } else {
          pushedRevision.current = localRevision;
          setLastSyncedAt(Date.now());
          setStatus("synced");
        }
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
    // Celowo tylko po sesji: pobranie ma nastąpić raz, przy wejściu na konto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  /* --- wysyłka zmian --- */
  useEffect(() => {
    if (!session?.user || status === "loading" || status === "conflict") return;

    const revision = state.meta?.revision ?? 0;
    if (pushedRevision.current === null) return; // pobranie jeszcze nie ustaliło punktu odniesienia
    if (revision === pushedRevision.current) return;

    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("syncing");
      try {
        const result = await pushState(session.user.id, state, remoteRevision.current);

        if (result.ok) {
          remoteRevision.current = result.revision;
          pushedRevision.current = result.revision;
          setLastSyncedAt(Date.now());
          setStatus("synced");
          setError("");
        } else if (result.reason === "conflict") {
          // Inne urządzenie zapisało w międzyczasie. Nie zgadujemy, co jest
          // ważniejsze — pokazujemy wybór.
          const remote = await pullState(session.user.id);
          conflictRef.current = remote;
          setStatus("conflict");
        }
      } catch (e) {
        setError(e.message);
        setStatus(navigator.onLine ? "error" : "offline");
      }
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(timer.current);
  }, [state, session, status]);

  /* --- ponowna próba po odzyskaniu sieci --- */
  useEffect(() => {
    const back = () => {
      if (status === "offline" || status === "error") setStatus("synced");
    };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [status]);

  const resolveConflict = useCallback(
    (choice) => {
      const remote = conflictRef.current;
      if (choice === "remote" && remote) {
        dispatch({ type: "replaceState", state: remote.state });
        remoteRevision.current = remote.revision;
        pushedRevision.current = remote.revision;
      } else if (choice === "local" && remote) {
        // Wymuszamy nadpisanie: przyjmujemy zdalną rewizję jako punkt odniesienia,
        // więc kolejny zapis przejdzie blokadę optymistyczną.
        remoteRevision.current = remote.revision;
        pushedRevision.current = remote.revision;
      }
      conflictRef.current = null;
      setStatus("synced");
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    clearTimeout(timer.current);
    await signOut();
  }, []);

  return {
    configured: isCloudConfigured,
    session,
    status,
    error,
    lastSyncedAt,
    hasConflict: status === "conflict",
    conflict: conflictRef.current,
    resolveConflict,
    logout,
  };
}
