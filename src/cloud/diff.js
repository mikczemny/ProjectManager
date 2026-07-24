import { COLLECTIONS } from "./entities.js";

/**
 * Rozkłada stan na wiersze tabel — postać, w której działa różnicowanie.
 *
 * Wydzielone, bo to jest też forma, w jakiej utrwalamy punkt odniesienia dla
 * kolejki offline: mniejsza od pełnego stanu i gotowa do porównania bez
 * ponownego przeliczania.
 */
export function flattenState(state) {
  const out = {};
  for (const col of COLLECTIONS) out[col.table] = col.flatten(state);
  return out;
}

/**
 * Wylicza, co zmieniło się między dwoma stanami, w postaci operacji na wierszach.
 *
 * Dlaczego różnicowanie, a nie mapowanie akcji na zapisy: reducer ma kilkadziesiąt
 * typów akcji i każda kolejna wymagałaby pamiętania o dopisaniu przekładu.
 * Porównanie stanów jest z definicji kompletne — nowa akcja synchronizuje się
 * sama, bo widać ją w danych.
 *
 * Zwraca [{ table, upserts: [...], deletes: [id] }] w kolejności zapisu.
 */
export function diffStates(prev, next) {
  return diffFlat(flattenState(prev), flattenState(next));
}

/** Jak `diffStates`, ale na gotowych wierszach — używane przez kolejkę offline. */
export function diffFlat(prevFlat, nextFlat) {
  const ops = [];

  for (const col of COLLECTIONS) {
    const before = index(prevFlat[col.table] || []);
    const after = index(nextFlat[col.table] || []);

    const upserts = [];
    for (const [id, row] of after) {
      const old = before.get(id);
      // Porównanie po serializacji: wiersze są płaskie i małe, a to zdejmuje
      // z nas pisanie porównania pole po polu dla każdej encji.
      if (!old || JSON.stringify(old) !== JSON.stringify(row)) upserts.push(row);
    }

    const deletes = [];
    for (const id of before.keys()) {
      if (!after.has(id)) deletes.push(id);
    }

    if (upserts.length || deletes.length) {
      ops.push({ table: col.table, upserts, deletes });
    }
  }

  return ops;
}

export const isEmptyDiff = (ops) => ops.length === 0;

/** Liczba wierszy w operacjach — do wskaźnika postępu i logów. */
export const countRows = (ops) =>
  ops.reduce((sum, o) => sum + o.upserts.length + o.deletes.length, 0);

function index(rows) {
  return new Map(rows.map((r) => [r.id, r]));
}
