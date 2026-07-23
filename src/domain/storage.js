import { SCHEMA_VERSION, migrate, emptyState } from "./schema.js";
import { slugify } from "../lib/format.js";

const STORAGE_KEY = "pm-app-state-v1";
/** Kopia stanu sprzed ostatniej migracji — ratunek, gdy migracja coś zepsuje. */
const BACKUP_KEY = "pm-app-state-backup";

export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyState();
  }
  if (!raw) return emptyState();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Zapisany stan jest uszkodzony — start od pustego.");
    return emptyState();
  }

  const incomingVersion = parsed.version ?? 1;
  if (incomingVersion < SCHEMA_VERSION) {
    // Zanim ruszymy dane, odkładamy oryginał na bok.
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      /* brak miejsca — migrujemy mimo to */
    }
  }

  return migrate(parsed);
}

export function saveState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, version: SCHEMA_VERSION })
    );
    return true;
  } catch (e) {
    console.error("Zapis stanu nie powiódł się", e);
    return false;
  }
}

/* ---------------------------------------------------------------------- */
/*  Eksport / import                                                        */
/* ---------------------------------------------------------------------- */

function download(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Pełna kopia zapasowa — wszystkie projekty, zespół i szablony. */
export function exportAll(state) {
  download(`projekty-backup-${stamp()}.json`, {
    kind: "pm-backup",
    version: SCHEMA_VERSION,
    exportedAt: Date.now(),
    ...state,
  });
}

/** Pojedynczy projekt — do przeniesienia lub wrzucenia do repo produkcji. */
export function exportProject(project) {
  download(`projekt-${slugify(project.name)}-${stamp()}.json`, {
    kind: "pm-project",
    version: SCHEMA_VERSION,
    exportedAt: Date.now(),
    project,
  });
}

/** Sam szablon — do dzielenia się procesem między produkcjami. */
export function exportTemplate(template) {
  download(`szablon-${slugify(template.name)}.json`, {
    kind: "pm-template",
    version: SCHEMA_VERSION,
    exportedAt: Date.now(),
    template: { ...template, builtIn: false },
  });
}

/**
 * Wczytuje plik JSON i rozpoznaje, co to jest.
 * Zwraca { kind, payload } albo rzuca błędem z czytelnym komunikatem.
 */
export function readImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku."));
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch {
        return reject(new Error("To nie jest poprawny plik JSON."));
      }

      if (data.kind === "pm-template" && data.template) {
        return resolve({ kind: "template", payload: data.template });
      }
      if (data.kind === "pm-project" && data.project) {
        return resolve({ kind: "project", payload: data.project });
      }
      if (data.kind === "pm-backup" || Array.isArray(data.projects)) {
        return resolve({ kind: "backup", payload: migrate(data) });
      }
      reject(
        new Error(
          "Nie rozpoznano formatu. Oczekiwano pliku wyeksportowanego z tej aplikacji."
        )
      );
    };
    reader.readAsText(file);
  });
}
