import { C } from "../theme.js";

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function formatDuration(sec) {
  sec = Math.floor(Math.max(0, sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}g ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Godziny (liczba) → czytelny zapis, np. 1.5 → "1g 30m". */
export function formatHours(h) {
  if (h == null) return "—";
  return formatDuration(h * 3600);
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function memberColor(id) {
  const palette = [C.amber, C.teal, C.purple, C.green, C.red, C.blue];
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[h];
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pl-PL");
}

/** Dni do terminu; ujemne = po terminie. Null gdy brak daty. */
export function daysUntil(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

/** Dzisiejsza data w formacie akceptowanym przez <input type="date">. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
