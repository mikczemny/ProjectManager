import { getClient } from "./client.js";
import { migrate } from "../domain/schema.js";

const TABLE = "app_state";

/* ---------------------------------------------------------------------- */
/*  Sesja                                                                   */
/* ---------------------------------------------------------------------- */

export async function getSession() {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session || null;
}

/** Subskrypcja zmian logowania. Zwraca funkcję odsubskrybowującą. */
export function onAuthChange(callback) {
  const c = getClient();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Logowanie linkiem jednorazowym wysyłanym mailem.
 *
 * Celowo bez hasła: nie ma czego wykraść z aplikacji ani czego zapomnieć,
 * a my nie przechowujemy żadnych danych uwierzytelniających.
 */
export async function sendMagicLink(email) {
  const c = getClient();
  if (!c) throw new Error("Chmura nie jest skonfigurowana.");
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const c = getClient();
  if (!c) return;
  await c.auth.signOut();
}

/* ---------------------------------------------------------------------- */
/*  Stan                                                                    */
/* ---------------------------------------------------------------------- */

/** Pobiera stan użytkownika z chmury. Zwraca null, gdy jeszcze go tam nie ma. */
export async function pullState(userId) {
  const c = getClient();
  if (!c) return null;

  const { data, error } = await c
    .from(TABLE)
    .select("state, revision, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Odczyt z chmury nie powiódł się: ${error.message}`);
  if (!data) return null;

  return {
    // Zapis zdalny mógł powstać w starszej wersji aplikacji — migrujemy tak
    // samo jak dane z localStorage.
    state: migrate(data.state),
    revision: data.revision ?? 0,
    updatedAt: data.updated_at,
  };
}

/**
 * Zapisuje stan do chmury.
 *
 * `expectedRevision` to blokada optymistyczna: zapis przechodzi tylko wtedy,
 * gdy w bazie nadal jest rewizja, którą widzieliśmy ostatnio. Inaczej znaczy
 * to, że inne urządzenie zapisało w międzyczasie — wtedy nie nadpisujemy
 * w ciemno, tylko oddajemy konflikt do rozstrzygnięcia.
 */
export async function pushState(userId, state, expectedRevision) {
  const c = getClient();
  if (!c) return { ok: false, reason: "not-configured" };

  const { data, error } = await c.rpc("save_app_state", {
    p_state: state,
    p_revision: state.meta.revision,
    p_expected_revision: expectedRevision,
  });

  if (error) throw new Error(`Zapis do chmury nie powiódł się: ${error.message}`);
  if (data === false) return { ok: false, reason: "conflict" };

  return { ok: true, revision: state.meta.revision };
}
