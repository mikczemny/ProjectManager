import { getClient } from "./client.js";
import { COLLECTIONS, buildStateFromRows } from "./entities.js";

const TABLES = COLLECTIONS.map((c) => c.table);

/* ---------------------------------------------------------------------- */
/*  Przestrzeń robocza                                                      */
/* ---------------------------------------------------------------------- */

/** Przestrzenie, do których należy zalogowany użytkownik. */
export async function listWorkspaces() {
  const c = getClient();
  const { data, error } = await c
    .from("memberships")
    .select("role, workspaces (id, name, created_at)")
    .order("created_at", { referencedTable: "workspaces", ascending: true });

  if (error) throw new Error(`Nie udało się pobrać przestrzeni: ${error.message}`);
  return (data || [])
    .filter((m) => m.workspaces)
    .map((m) => ({ ...m.workspaces, role: m.role }));
}

export async function createWorkspace(name) {
  const c = getClient();
  const { data, error } = await c.rpc("create_workspace", { p_name: name });
  if (error) throw new Error(`Nie udało się utworzyć przestrzeni: ${error.message}`);
  return data;
}

/* ---------------------------------------------------------------------- */
/*  Odczyt                                                                  */
/* ---------------------------------------------------------------------- */

/** Pobiera całą zawartość przestrzeni i składa z niej stan aplikacji. */
export async function hydrate(workspaceId, base) {
  const c = getClient();

  const results = await Promise.all(
    TABLES.map((t) => c.from(t).select("*").eq("workspace_id", workspaceId))
  );

  const rows = {};
  results.forEach((res, i) => {
    if (res.error) {
      throw new Error(`Odczyt tabeli ${TABLES[i]} nie powiódł się: ${res.error.message}`);
    }
    rows[TABLES[i]] = res.data || [];
  });

  return buildStateFromRows(rows, base);
}

/* ---------------------------------------------------------------------- */
/*  Zapis                                                                   */
/* ---------------------------------------------------------------------- */

/**
 * Wysyła operacje wyliczone przez `diffStates`.
 *
 * Zapisy idą w kolejności zadeklarowanej w COLLECTIONS (rodzic przed
 * dzieckiem), a kasowanie od końca — inaczej klucze obce odrzuciłyby operację.
 */
export async function applyOps(workspaceId, ops) {
  const c = getClient();

  for (const op of ops) {
    if (op.upserts.length) {
      const rows = op.upserts.map((r) => ({ ...r, workspace_id: workspaceId }));
      const { error } = await c.from(op.table).upsert(rows, { onConflict: "id" });
      if (error) {
        throw new Error(`Zapis do ${op.table} nie powiódł się: ${error.message}`);
      }
    }
  }

  for (const op of [...ops].reverse()) {
    if (op.deletes.length) {
      const { error } = await c
        .from(op.table)
        .delete()
        .eq("workspace_id", workspaceId)
        .in("id", op.deletes);
      if (error) {
        throw new Error(`Usuwanie z ${op.table} nie powiodło się: ${error.message}`);
      }
    }
  }
}

/* ---------------------------------------------------------------------- */
/*  Bramki po stronie serwera                                              */
/* ---------------------------------------------------------------------- */

/**
 * Domknięcie fazy sprawdzane w bazie na aktualnych danych.
 * Zwraca { ok } albo { ok: false, openTasks, openCriteria }.
 */
export async function closePhaseRemote(phaseId) {
  const c = getClient();
  const { data, error } = await c.rpc("close_phase", { p_phase: phaseId });
  if (error) throw new Error(error.message);
  return {
    ok: data.ok,
    openTasks: data.open_tasks ?? 0,
    openCriteria: data.open_criteria ?? 0,
  };
}

export async function closeSprintRemote(sprintId) {
  const c = getClient();
  const { data, error } = await c.rpc("close_sprint", { p_sprint: sprintId });
  if (error) throw new Error(error.message);
  return { ok: data.ok, movedToBacklog: data.moved_to_backlog ?? 0 };
}

/* ---------------------------------------------------------------------- */
/*  Realtime                                                                */
/* ---------------------------------------------------------------------- */

/**
 * Nasłuch zmian w przestrzeni.
 *
 * Nie próbujemy łatać stanu pojedynczym wierszem: zdarzenie mówi tylko, że coś
 * się ruszyło, a aplikacja pobiera świeży obraz. Przy skali zespołowej to jest
 * tanie, a odpada cała klasa błędów wynikających z częściowych aktualizacji.
 */
export function subscribe(workspaceId, onChange) {
  const c = getClient();
  if (!c) return () => {};

  const channel = c.channel(`workspace:${workspaceId}`);

  for (const table of TABLES) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` },
      (payload) => onChange(payload)
    );
  }

  channel.subscribe();
  return () => c.removeChannel(channel);
}
