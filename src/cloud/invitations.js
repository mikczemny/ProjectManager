import { getClient } from "./client.js";

/**
 * Zaproszenia do przestrzeni zespołu.
 *
 * Aplikacja nie wysyła maili — wysyłka wymagałaby klucza `service_role`, który
 * nie ma prawa znaleźć się w przeglądarce. Tworzymy więc link, a zapraszający
 * przekazuje go sam, dowolnym kanałem.
 *
 * Konsekwencja jest istotna dla bezpieczeństwa: **link jest sekretem**. Stąd
 * po stronie bazy token losowy, tygodniowy termin ważności i wymóg zgodności
 * adresu e-mail przy przyjmowaniu (migracja `0003_invitations.sql`).
 */

/** Klucz przechowujący token na czas logowania — magic link gubi parametry. */
const PENDING_TOKEN_KEY = "pm-pending-invitation";
/** Nazwa parametru w adresie zaproszenia. */
export const INVITE_PARAM = "zaproszenie";

export async function createInvitation(workspaceId, email, role = "member") {
  const c = getClient();
  const { data, error } = await c.rpc("create_invitation", {
    p_workspace: workspaceId,
    p_email: email,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  return { ...data, link: buildLink(data.token) };
}

export function buildLink(token) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(INVITE_PARAM, token);
  return url.toString();
}

/** Zaproszenia oczekujące — bez przyjętych i cofniętych. */
export async function listInvitations(workspaceId) {
  const c = getClient();
  const { data, error } = await c
    .from("invitations")
    .select("id, email, role, token, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((i) => ({ ...i, link: buildLink(i.token) }));
}

export async function revokeInvitation(id) {
  const c = getClient();
  const { error } = await c.rpc("revoke_invitation", { p_id: id });
  if (error) throw new Error(error.message);
}

/** Co kryje się pod tokenem — bez ujawniania zawartości przestrzeni. */
export async function peekInvitation(token) {
  const c = getClient();
  const { data, error } = await c.rpc("peek_invitation", { p_token: token });
  if (error) throw new Error(error.message);
  return data;
}

export async function acceptInvitation(token) {
  const c = getClient();
  const { data, error } = await c.rpc("accept_invitation", { p_token: token });
  if (error) throw new Error(error.message);
  return data;
}

/* ---------------------------------------------------------------------- */
/*  Skład zespołu                                                           */
/* ---------------------------------------------------------------------- */

export async function listMembers(workspaceId) {
  const c = getClient();
  const { data, error } = await c
    .from("workspace_members")
    .select("user_id, role, email, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function removeMemberFromWorkspace(workspaceId, userId) {
  const c = getClient();
  const { error } = await c.rpc("remove_member", {
    p_workspace: workspaceId,
    p_user: userId,
  });
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------------------- */
/*  Token w adresie                                                         */
/* ---------------------------------------------------------------------- */

/**
 * Wyjmuje token z adresu i chowa go na czas logowania.
 *
 * Magic link wraca pod goły `origin`, gubiąc parametry — bez tego zaproszenie
 * przepadałoby dokładnie tym osobom, które dopiero zakładają konto.
 */
export function captureTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get(INVITE_PARAM);
  if (!token) return null;

  try {
    localStorage.setItem(PENDING_TOKEN_KEY, token);
  } catch {
    /* zadziała w obrębie tej karty */
  }

  // Token znika z paska adresu, żeby nie wyciekł przez historię czy udostępniony
  // zrzut ekranu.
  params.delete(INVITE_PARAM);
  const clean =
    window.location.pathname + (params.toString() ? `?${params}` : "");
  window.history.replaceState({}, "", clean);

  return token;
}

export function readPendingToken() {
  try {
    return localStorage.getItem(PENDING_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearPendingToken() {
  try {
    localStorage.removeItem(PENDING_TOKEN_KEY);
  } catch {
    /* bez znaczenia */
  }
}
