# projekty.dev

Wirtualny project manager do produkcji oprogramowania. Program zna proces, zespół go wykonuje,
a aplikacja pilnuje, żeby nikt nie przeskoczył etapu.

To nie jest kolejna tablica kanban, na której sam wymyślasz sobie zadania. Szablony zawierają
zapis tego, **jak powinno się prowadzić dany typ produkcji** — fazy, bramki wyjścia i startowe
zadania. Zespół odhacza kolejne kroki, a program prowadzi go dalej.

## Jak to działa

**Fazy mówią CO ma być zrobione. Sprinty mówią KIEDY.** Obie warstwy żyją równolegle: zadanie
należy do jednej fazy i opcjonalnie do jednego sprintu.

### Fazy i bramki

Każda faza ma **bramkę wyjścia** — listę kryteriów do odhaczenia. Faza domyka się dopiero, gdy
spełnione są dwa niezależne warunki:

1. wszystkie zadania fazy są zrobione,
2. wszystkie kryteria bramki są odhaczone.

Zrobione zadania bez spełnionej bramki to najczęstszy sposób na przepchnięcie niedokończonej fazy
dalej, więc program tego nie przepuszcza. Blokada jest egzekwowana także w reducerze, nie tylko
w interfejsie.

### Scrum

- backlog produktu oddzielony od zakresu sprintu,
- story pointy, velocity liczone ze zamkniętych sprintów, burndown,
- ceremonie (planning / review / retro) jako checklista sprintu,
- niedowiezione zadania przy domknięciu sprintu wracają do backlogu, żeby nie fałszować velocity.

### Widok „Co teraz?"

Serce aplikacji. Liczy stan projektu i daje konkretną instrukcję zamiast surowych danych: w której
fazie jesteście, co blokuje bramkę, ile dni zostało do końca sprintu i ile punktów jest
niedowiezionych. Każdy krok jest klikalny i przenosi tam, gdzie się go wykonuje.

## Wbudowane szablony

| Szablon | Zastosowanie |
| --- | --- |
| Rozwój oprogramowania | pełny cykl od zakresu MVP po wdrożenie (5 faz) |
| Produkt w Scrumie | ciągły rozwój w rytmie sprintów (4 fazy) |
| MVP / prototyp | dwutygodniowa pętla weryfikacji pomysłu (3 fazy) |
| Wydanie wersji | code freeze → QA → wydanie → retro (4 fazy) |
| Hotfix produkcyjny | opanuj → napraw → post-mortem (3 fazy) |
| Pusty projekt | własny proces od zera |

Szablony to **dane, nie kod** — ten sam kształt mają szablony wbudowane, tworzone w aplikacji
i importowane z pliku JSON.

## Szkielet do kolejnych produkcji

- **Edytor szablonów** — fazy, bramki, kryteria i zadania startowe edytowane w aplikacji.
  Szablony wbudowane są zablokowane, ale można je skopiować i przerobić kopię.
- **Zapisz projekt jako szablon** — udana produkcja staje się punktem startowym następnej.
- **Eksport / import** — cała kopia zapasowa, pojedynczy projekt albo sam szablon procesu.
  Wyeksportowany proces można trzymać w repozytorium produkcji obok kodu.
- **Fazy kopiowane do projektu** przy zakładaniu — późniejsza edycja lub usunięcie szablonu nie
  zmienia i nie psuje projektów, które już z niego powstały.

## Uruchomienie

```bash
npm install
```

```bash
npm run dev
```

Aplikacja wystartuje pod adresem podanym przez Vite (domyślnie http://localhost:5173).

## Build produkcyjny

```bash
npm run build
```

```bash
npm run preview
```

## Stos technologiczny

- React 19 + Vite
- lucide-react — ikony
- brak backendu — dane w `localStorage` przeglądarki

## Struktura

```
src/
  App.jsx              # kompozycja, routing widoków, górny pasek
  theme.js             # tokeny wizualne, statusy, priorytety, typy zadań
  lib/format.js        # formatowanie czasu, dat, inicjałów
  domain/
    schema.js          # kształt encji, wersja schematu, MIGRACJE
    templates.js       # wbudowane szablony procesów (dane)
    storage.js         # localStorage, eksport / import JSON
    selectors.js       # postęp, czas, obciążenie, filtry, ryzyka
    scrum.js           # sprinty, velocity, burndown
    guidance.js        # bramki faz i silnik „co teraz?"
  state/store.jsx      # reducer + kontekst — jedno źródło prawdy
  components/          # elementy współdzielone, karta i modal zadania
  views/               # Co teraz / Proces / Sprint / Tablica / Zespół / Szablony
```

## Wersjonowanie danych

Stan w `localStorage` ma numer wersji (`SCHEMA_VERSION` w [schema.js](src/domain/schema.js)).
Przy każdej zmianie kształtu danych podbij wersję i dopisz krok w `MIGRATIONS` — istniejące
produkcje przechodzą migrację zamiast się kasować. Przed pierwszą migracją oryginał jest
odkładany do klucza `pm-app-state-backup`.

## Plany rozwoju

- **Praca wielu osób na wspólnych danych** — dziś jedna przeglądarka, wymiana przez eksport JSON.
  Propozycja architektury: [docs/synchronizacja-online.md](docs/synchronizacja-online.md)
- Widok kalendarza i kamieni milowych
- Wykres przepływu skumulowanego (CFD)
- Integracja z GitHubem (domykanie zadań przy zmergowaniu PR)
