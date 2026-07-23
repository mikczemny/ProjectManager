import { useCallback, useEffect, useRef, useState } from "react";
import { isCloudConfigured } from "./client.js";
import { getSession, onAuthChange, signOut } from "./sync.js";
import {
  listWorkspaces, createWorkspace, hydrate, applyOps, subscribe,
  closePhaseRemote, closeSprintRemote,
} from "./remote.js";
import { diffStates, isEmptyDiff } from "./diff.js";
import { emptyState } from "../domain/schema.js";

const PUSH_DEBOUNCE_MS = 1200;
const PULL_DEBOUNCE_MS = 700;
const WORKSPACE_KEY = "pm-workspace-id";

/**
 * Synchronizacja zespołowa (Etap 2).
 *
 * Jednostką zapisu jest wiersz, nie cały stan — dwie osoby pracujące na tym
 * samym projekcie nie nadpisują się nawzajem, dopóki nie ruszają tego samego
 * pola. Wysyłka powstaje z porównania stanów, więc każda nowa akcja reducera
 * synchronizuje się bez dopisywania czegokolwiek tutaj.
 *
 * Bez konfiguracji chmury hook nie robi nic i aplikacja pracuje lokalnie.
 */
export function useCloudSync(state, dispatch) {
  const [session, setSession] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceId, setWorkspaceId] = useState(
    () => localStorage.getItem(WORKSPACE_KEY) || null
  );
  /** idle | loading | no-workspace | syncing | synced | offline | error */
  const [status, setStatus] = useState(isCloudConfigured ? "loading" : "idle");
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  /** Stan, który na pewno jest już w bazie — punkt odniesienia dla różnicy. */
  const baseline = useRef(null);
  const pushTimer = useRef(null);
  const pullTimer = useRef(null);
  /** Zdarzenia realtime wywołane naszym własnym zapisem ignorujemy. */
  const selfWriteUntil = useRef(0);

  const role = workspaces.find((w) => w.id === workspaceId)?.role || null;
  const mode = isCloudConfigured && session && workspaceId ? "cloud" : "local";

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
        baseline.current = null;
        setWorkspaces([]);
      }
    });
  }, []);

  /* --- przestrzenie robocze --- */
  useEffect(() => {
    if (!session?.user) return;
    let alive = true;

    listWorkspaces()
      .then((list) => {
        if (!alive) return;
        setWorkspaces(list);
        const stored = localStorage.getItem(WORKSPACE_KEY);
        const pick = list.find((w) => w.id === stored)?.id || list[0]?.id || null;
        setWorkspaceId(pick);
        if (!pick) setStatus("no-workspace");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setStatus("error");
      });

    return () => {
      alive = false;
    };
    // Lista przestrzeni zależy od tożsamości, nie od reszty obiektu sesji.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  /* --- pobranie zawartości przestrzeni --- */
  const pull = useCallback(async () => {
    if (!workspaceId) return;
    const remote = await hydrate(workspaceId, emptyState());
    baseline.current = remote;
    dispatch({ type: "replaceState", state: remote });
    setLastSyncedAt(Date.now());
    setStatus("synced");
  }, [workspaceId, dispatch]);

  useEffect(() => {
    if (!session?.user || !workspaceId) return;
    let alive = true;
    localStorage.setItem(WORKSPACE_KEY, workspaceId);
    setStatus("syncing");

    // Pierwsze wejście do pustej przestrzeni wnosi to, co użytkownik ma lokalnie.
    hydrate(workspaceId, emptyState())
      .then(async (remote) => {
        if (!alive) return;
        const remoteEmpty = remote.projects.length === 0 && remote.team.length === 0;
        const localHasData = state.projects.length > 0 || state.team.length > 0;

        if (remoteEmpty && localHasData) {
          baseline.current = remote;
          const ops = diffStates(remote, state);
          selfWriteUntil.current = Date.now() + 2500;
          await applyOps(workspaceId, ops);
          baseline.current = state;
          setLastSyncedAt(Date.now());
          setStatus("synced");
          return;
        }

        baseline.current = remote;
        dispatch({ type: "replaceState", state: remote });
        setLastSyncedAt(Date.now());
        setStatus("synced");
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setStatus(navigator.onLine ? "error" : "offline");
      });

    return () => {
      alive = false;
    };
    // Pobranie ma nastąpić przy wejściu do przestrzeni, nie przy każdej zmianie stanu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, workspaceId]);

  /* --- wysyłka zmian --- */
  useEffect(() => {
    if (mode !== "cloud" || !baseline.current) return;
    if (status === "loading" || status === "syncing") return;

    const ops = diffStates(baseline.current, state);
    if (isEmptyDiff(ops)) return;

    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      const snapshot = state;
      setStatus("syncing");
      try {
        selfWriteUntil.current = Date.now() + 2500;
        await applyOps(workspaceId, diffStates(baseline.current, snapshot));
        baseline.current = snapshot;
        setLastSyncedAt(Date.now());
        setStatus("synced");
        setError("");
      } catch (e) {
        setError(e.message);
        setStatus(navigator.onLine ? "error" : "offline");
      }
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(pushTimer.current);
  }, [state, mode, workspaceId, status]);

  /* --- nasłuch zmian od innych --- */
  useEffect(() => {
    if (mode !== "cloud") return;

    return subscribe(workspaceId, () => {
      if (Date.now() < selfWriteUntil.current) return; // echo własnego zapisu
      clearTimeout(pullTimer.current);
      pullTimer.current = setTimeout(() => {
        pull().catch((e) => {
          setError(e.message);
          setStatus(navigator.onLine ? "error" : "offline");
        });
      }, PULL_DEBOUNCE_MS);
    });
  }, [mode, workspaceId, pull]);

  /* --- powrót sieci --- */
  useEffect(() => {
    const back = () => {
      if (status === "offline" || status === "error") {
        pull().catch(() => {});
      }
    };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [status, pull]);

  /* --- akcje --- */

  const newWorkspace = useCallback(async (name) => {
    setStatus("syncing");
    try {
      const id = await createWorkspace(name);
      const list = await listWorkspaces();
      setWorkspaces(list);
      setWorkspaceId(id);
      return id;
    } catch (e) {
      setError(e.message);
      setStatus("error");
      throw e;
    }
  }, []);

  /**
   * Domknięcie fazy. W trybie zespołowym decyduje baza — klient mógłby
   * pracować na nieaktualnym obrazie bramki.
   */
  const closePhase = useCallback(
    async (phaseId) => {
      if (mode !== "cloud") return null;
      const result = await closePhaseRemote(phaseId);
      await pull();
      return result;
    },
    [mode, pull]
  );

  const closeSprint = useCallback(
    async (sprintId) => {
      if (mode !== "cloud") return null;
      const result = await closeSprintRemote(sprintId);
      await pull();
      return result;
    },
    [mode, pull]
  );

  const logout = useCallback(async () => {
    clearTimeout(pushTimer.current);
    clearTimeout(pullTimer.current);
    localStorage.removeItem(WORKSPACE_KEY);
    setWorkspaceId(null);
    await signOut();
  }, []);

  return {
    configured: isCloudConfigured,
    mode,
    session,
    workspaces,
    workspaceId,
    role,
    status,
    error,
    lastSyncedAt,
    selectWorkspace: setWorkspaceId,
    newWorkspace,
    closePhase,
    closeSprint,
    refresh: pull,
    logout,
  };
}
