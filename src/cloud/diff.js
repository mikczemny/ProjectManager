import { COLLECTIONS } from "./entities.js";

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
  const ops = [];

  for (const col of COLLECTIONS) {
    const before = index(col.flatten(prev));
    const after = index(col.flatten(next));

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
