import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isCloudConfigured } from "./client.js";
import { getSession, onAuthChange, signOut } from "./sync.js";
import {
  listWorkspaces, createWorkspace, hydrate, applyOps, subscribe,
  closePhaseRemote, closeSprintRemote,
} from "./remote.js";
import { diffFlat, flattenState } from "./diff.js";
import { saveBaseline, loadBaseline, clearBaseline, countPending } from "./pending.js";
import { emptyState } from "../domain/schema.js";

const PUSH_DEBOUNCE_MS = 1200;
const PULL_DEBOUNCE_MS = 700;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;
const WORKSPACE_KEY = "pm-workspace-id";

/**
 * Synchronizacja zespołowa z trwałą kolejką offline.
 *
 * Jednostką zapisu jest wiersz, nie cały stan — dwie osoby pracujące na tym
 * samym projekcie nie nadpisują się, dopóki nie ruszają tego samego pola.
 *
 * Kolejka niewysłanych zmian to różnica między utrwalonym punktem odniesienia
 * a bieżącym stanem, więc przeżywa przeładowanie strony i zamknięcie
 * przeglądarki. Szczegóły w `pending.js`.
 *
 * Reguła nadrzędna: **nigdy nie zastępujemy stanu lokalnego danymi z bazy,
 * dopóki istnieją niewysłane zmiany.** To jedyna droga, którą praca zrobiona
 * offline mogłaby zniknąć bez śladu.
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
  /** Fałsz, gdy kolejka nie przetrwa przeładowania (np. brak miejsca). */
  const [queueDurable, setQueueDurable] = useState(true);
  const [retryAttempt, setRetryAttempt] = useState(0);

  /** Wiersze, które wedle naszej wiedzy są już w bazie. */
  const baselineRef = useRef(null);
  /** Licznik zmian punktu odniesienia — wymusza przeliczenie kolejki. */
  const [baselineVersion, setBaselineVersion] = useState(0);

  /** Zawsze aktualny stan dla domknięć asynchronicznych. */
  const stateRef = useRef(state);
  stateRef.current = state;

  const pushTimer = useRef(null);
  const pullTimer = useRef(null);
  /** Zdarzenia realtime wywołane naszym własnym zapisem ignorujemy. */
  const selfWriteUntil = useRef(0);
  /** Blokada przed równoległymi cyklami synchronizacji. */
  const busy = useRef(false);

  const role = workspaces.find((w) => w.id === workspaceId)?.role || null;
  const mode = isCloudConfigured && session && workspaceId ? "cloud" : "local";

  const setBaseline = useCallback((flat, wsId) => {
    baselineRef.current = flat;
    setBaselineVersion((v) => v + 1);
    if (flat && wsId) setQueueDurable(saveBaseline(wsId, flat));
  }, []);

  /* --- kolejka --- */
  const pendingOps = useMemo(() => {
    if (mode !== "cloud" || !baselineRef.current) return [];
    return diffFlat(baselineRef.current, flattenState(state));
    // baselineVersion wymusza przeliczenie po zmianie punktu odniesienia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, baselineVersion, mode]);

  const pendingCount = countPending(pendingOps);

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
        baselineRef.current = null;
        clearBaseline();
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

  /**
   * Wysyła zaległości. Nie pobiera niczego — służy do opróżnienia kolejki.
   * Zwraca liczbę wysłanych wierszy.
   */
  const flush = useCallback(
    async (wsId) => {
      if (!baselineRef.current) return 0;
      const snapshot = flattenState(stateRef.current);
      const ops = diffFlat(baselineRef.current, snapshot);
      if (ops.length === 0) return 0;

      selfWriteUntil.current = Date.now() + 2500;
      await applyOps(wsId, ops);
      setBaseline(snapshot, wsId);
      return countPending(ops);
    },
    [setBaseline]
  );

  /**
   * Pełny cykl: najpierw opróżnij kolejkę, potem pobierz obraz z bazy.
   *
   * Kolejność jest istotna. Pobranie przed wysyłką nadpisałoby niewysłaną
   * pracę, a to dokładnie ten błąd, który ta funkcja ma wykluczyć.
   */
  const syncNow = useCallback(
    async (wsId) => {
      if (busy.current) return;
      busy.current = true;
      try {
        await flush(wsId);

        const remote = await hydrate(wsId, emptyState());

        // Użytkownik mógł coś zmienić, gdy czekaliśmy na odpowiedź. Wtedy
        // podmiana stanu skasowałaby te zmiany — zostawiamy je i wypchniemy
        // w kolejnym cyklu.
        const late = baselineRef.current
          ? diffFlat(baselineRef.current, flattenState(stateRef.current))
          : [];

        if (late.length === 0) {
          dispatch({ type: "replaceState", state: remote });
          setBaseline(flattenState(remote), wsId);
        }

        setLastSyncedAt(Date.now());
        setStatus("synced");
        setError("");
        setRetryAttempt(0);
      } finally {
        busy.current = false;
      }
    },
    [dispatch, flush, setBaseline]
  );

  /* --- wejście do przestrzeni --- */
  useEffect(() => {
    if (!session?.user || !workspaceId) return;
    let alive = true;
    localStorage.setItem(WORKSPACE_KEY, workspaceId);
    setStatus("syncing");

    const enter = async () => {
      const persisted = loadBaseline(workspaceId);

      if (persisted) {
        // Znana przestrzeń — mogła zostać kolejka po pracy bez sieci.
        baselineRef.current = persisted;
        setBaselineVersion((v) => v + 1);
        await syncNow(workspaceId);
        return;
      }

      // Pierwsze wejście na tym urządzeniu.
      const remote = await hydrate(workspaceId, emptyState());
      const remoteEmpty = remote.projects.length === 0 && remote.team.length === 0;
      const local = stateRef.current;
      const localHasData = local.projects.length > 0 || local.team.length > 0;

      if (remoteEmpty && localHasData) {
        // Pusta przestrzeń przejmuje to, co użytkownik ma lokalnie.
        setBaseline(flattenState(remote), workspaceId);
        await flush(workspaceId);
        setLastSyncedAt(Date.now());
        setStatus("synced");
        return;
      }

      dispatch({ type: "replaceState", state: remote });
      setBaseline(flattenState(remote), workspaceId);
      setLastSyncedAt(Date.now());
      setStatus("synced");
    };

    enter().catch((e) => {
      if (!alive) return;
      setError(e.message);
      setStatus(navigator.onLine ? "error" : "offline");
    });

    return () => {
      alive = false;
    };
    // Wejście ma nastąpić przy zmianie przestrzeni, nie przy każdej zmianie stanu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, workspaceId]);

  /* --- wysyłka bieżących zmian --- */
  useEffect(() => {
    if (mode !== "cloud" || !baselineRef.current) return;
    if (status === "loading" || status === "syncing") return;
    if (pendingCount === 0) return;

    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      setStatus("syncing");
      try {
        await flush(workspaceId);
        setLastSyncedAt(Date.now());
        setStatus("synced");
        setError("");
        setRetryAttempt(0);
      } catch (e) {
        setError(e.message);
        setStatus(navigator.onLine ? "error" : "offline");
      } finally {
        busy.current = false;
      }
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(pushTimer.current);
  }, [pendingCount, mode, workspaceId, status, flush]);

  /* --- ponawianie z narastającym odstępem --- */
  useEffect(() => {
    if (status !== "offline" && status !== "error") return;
    if (mode !== "cloud" || pendingCount === 0) return;

    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** retryAttempt);
    const t = setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        await flush(workspaceId);
        setLastSyncedAt(Date.now());
        setStatus("synced");
        setError("");
        setRetryAttempt(0);
      } catch {
        // Cisza jest tu zamierzona: komunikat już wisi, a każda nieudana
        // próba tylko wydłuża odstęp do następnej.
        setRetryAttempt((n) => n + 1);
      } finally {
        busy.current = false;
      }
    }, delay);

    return () => clearTimeout(t);
  }, [status, pendingCount, retryAttempt, mode, workspaceId, flush]);

  /* --- nasłuch zmian od innych --- */
  useEffect(() => {
    if (mode !== "cloud") return;

    return subscribe(workspaceId, () => {
      if (Date.now() < selfWriteUntil.current) return; // echo własnego zapisu
      clearTimeout(pullTimer.current);
      pullTimer.current = setTimeout(() => {
        syncNow(workspaceId).catch((e) => {
          setError(e.message);
          setStatus(navigator.onLine ? "error" : "offline");
        });
      }, PULL_DEBOUNCE_MS);
    });
  }, [mode, workspaceId, syncNow]);

  /* --- powrót sieci --- */
  useEffect(() => {
    if (mode !== "cloud") return;
    const back = () => {
      setRetryAttempt(0);
      syncNow(workspaceId).catch(() => {
        setStatus("offline");
      });
    };
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [mode, workspaceId, syncNow]);

  /* --- ostrzeżenie przed zamknięciem z niewysłaną pracą --- */
  useEffect(() => {
    if (pendingCount === 0) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pendingCount]);

  /* --- akcje --- */

  const newWorkspace = useCallback(async (name) => {
    setStatus("syncing");
    try {
      const id = await createWorkspace(name);
      const list = await listWorkspaces();
      setWorkspaces(list);
      // Nowa przestrzeń nie ma nic wspólnego z poprzednim punktem odniesienia.
      clearBaseline();
      baselineRef.current = null;
      setWorkspaceId(id);
      return id;
    } catch (e) {
      setError(e.message);
      setStatus("error");
      throw e;
    }
  }, []);

  const syncManually = useCallback(async () => {
    if (mode !== "cloud") return;
    setStatus("syncing");
    try {
      await syncNow(workspaceId);
    } catch (e) {
      setError(e.message);
      setStatus(navigator.onLine ? "error" : "offline");
    }
  }, [mode, workspaceId, syncNow]);

  /**
   * Domknięcie fazy. W trybie zespołowym decyduje baza — klient mógłby
   * pracować na nieaktualnym obrazie bramki.
   */
  const closePhase = useCallback(
    async (phaseId) => {
      if (mode !== "cloud") return null;
      // Bramka liczona jest z danych w bazie, więc zaległości muszą tam być,
      // zanim o nią zapytamy.
      await flush(workspaceId);
      const result = await closePhaseRemote(phaseId);
      await syncNow(workspaceId);
      return result;
    },
    [mode, workspaceId, flush, syncNow]
  );

  const closeSprint = useCallback(
    async (sprintId) => {
      if (mode !== "cloud") return null;
      await flush(workspaceId);
      const result = await closeSprintRemote(sprintId);
      await syncNow(workspaceId);
      return result;
    },
    [mode, workspaceId, flush, syncNow]
  );

  const logout = useCallback(async () => {
    clearTimeout(pushTimer.current);
    clearTimeout(pullTimer.current);
    localStorage.removeItem(WORKSPACE_KEY);
    clearBaseline();
    baselineRef.current = null;
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
    pendingCount,
    queueDurable,
    selectWorkspace: setWorkspaceId,
    newWorkspace,
    closePhase,
    closeSprint,
    refresh: syncManually,
    logout,
  };
}
