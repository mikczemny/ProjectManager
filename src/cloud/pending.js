/**
 * Trwały punkt odniesienia dla kolejki offline.
 *
 * Kolejka niewysłanych zmian nie jest tu osobną strukturą danych — jest nią
 * różnica między ostatnim stanem potwierdzonym przez bazę a tym, co użytkownik
 * ma teraz lokalnie. Wystarczy więc utrwalić ten pierwszy.
 *
 * Zaleta wobec listy operacji do odtworzenia: kolejka sama się kompaktuje
 * (dwadzieścia poprawek jednego zadania to nadal jeden zapis), jest odporna na
 * kolejność i idempotentna, bo zapisy identyfikuje klucz wiersza. Nie ma też
 * czego „odtwarzać" po awarii — różnicę liczy się na nowo z danych, które
 * i tak są na dysku.
 */

const BASELINE_KEY = "pm-sync-baseline";

/**
 * Zapisuje punkt odniesienia dla danej przestrzeni.
 *
 * Zwraca false, gdy się nie udało — wtedy kolejka offline nie przetrwa
 * przeładowania strony i trzeba o tym powiedzieć użytkownikowi zamiast
 * milcząco obiecywać trwałość, której nie ma.
 */
export function saveBaseline(workspaceId, flat) {
  try {
    localStorage.setItem(
      BASELINE_KEY,
      JSON.stringify({ workspaceId, savedAt: Date.now(), flat })
    );
    return true;
  } catch (e) {
    // Najczęściej przekroczony limit magazynu. Kasujemy nieaktualny wpis, żeby
    // nie zostawić punktu odniesienia, który kłamie o zawartości bazy.
    console.error("Nie udało się utrwalić punktu odniesienia synchronizacji", e);
    try {
      localStorage.removeItem(BASELINE_KEY);
    } catch {
      /* nic więcej nie zrobimy */
    }
    return false;
  }
}

/**
 * Wczytuje punkt odniesienia, o ile dotyczy tej samej przestrzeni.
 *
 * Punkt z innej przestrzeni jest bezużyteczny i groźny — różnica względem
 * niego wyglądałaby jak masowe usunięcie cudzych danych.
 */
export function loadBaseline(workspaceId) {
  let raw;
  try {
    raw = localStorage.getItem(BASELINE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.workspaceId !== workspaceId || !parsed.flat) return null;
    return parsed.flat;
  } catch {
    console.error("Punkt odniesienia synchronizacji jest uszkodzony — ignoruję.");
    return null;
  }
}

export function clearBaseline() {
  try {
    localStorage.removeItem(BASELINE_KEY);
  } catch {
    /* bez znaczenia */
  }
}

/** Liczba wierszy czekających na wysyłkę — do pokazania użytkownikowi. */
export function countPending(ops) {
  return ops.reduce((sum, o) => sum + o.upserts.length + o.deletes.length, 0);
}
