# Wymiana danych online — propozycja

Dokument projektowy, nie implementacja. Opisuje, jak przenieść aplikację z `localStorage`
na wspólne dane zespołu, i rekomenduje jedną drogę.

## Stan dzisiejszy

Cały stan siedzi w `localStorage` pod jednym kluczem, jako jeden obiekt JSON. Konsekwencje:

- dane żyją w jednej przeglądarce na jednym komputerze,
- zespół nie widzi tego samego — wymiana idzie przez ręczny eksport i import pliku,
- wyczyszczenie danych przeglądarki kasuje wszystkie produkcje,
- bramka fazy odhaczona przez jedną osobę nie istnieje dla reszty.

Ostatni punkt jest najgroźniejszy, bo uderza w sedno narzędzia. Program ma pilnować procesu
**zespołu**, a dziś pilnuje procesu pojedynczej przeglądarki.

## Czego potrzebujemy

| Wymaganie | Dlaczego |
| --- | --- |
| Wspólny stan projektu | bramka i sprint muszą znaczyć to samo dla wszystkich |
| Podgląd na żywo | odhaczenie kryterium ma być widoczne bez odświeżania |
| Logowanie i role | wiadomo, kto odhaczył bramkę i kto może to cofnąć |
| Praca offline | brak sieci nie może blokować odhaczania zadań |
| Historia zmian | „kto zamknął fazę 3 i kiedy" to pytanie, które padnie |
| Brak własnego serwera | nie chcemy utrzymywać infrastruktury dla narzędzia wewnętrznego |

## Rozważane warianty

### A. Supabase (hostowany Postgres + Auth + Realtime) — **rekomendacja**

Postgres z gotowym logowaniem, subskrypcjami realtime i zabezpieczeniem dostępu na poziomie
wiersza (RLS). Frontend zostaje statyczny — build Vite ląduje na dowolnym hostingu.

**Za:** relacyjne zapytania (velocity, burndown, raporty czasu to naturalny SQL), realtime
w standardzie, RLS zdejmuje z nas pisanie warstwy uprawnień, darmowy próg wystarcza małemu
zespołowi, brak serwera do utrzymania.
**Przeciw:** uzależnienie od dostawcy; przy skomplikowanej logice serwerowej trzeba sięgnąć po
funkcje brzegowe.

### B. Firebase / Firestore

**Za:** najlepszy offline z pudełka, dojrzały realtime.
**Przeciw:** baza dokumentowa — agregaty w rodzaju velocity czy sumy czasu w podziale na osoby
wymagają albo utrzymywania liczników, albo ściągania wszystkiego do klienta. Przy narzędziu,
którego sensem są metryki procesu, to jest praca pod górkę.

### C. Własny backend (Node + Postgres)

**Za:** pełna kontrola, dowolna logika po stronie serwera.
**Przeciw:** to jest osobna produkcja — auth, migracje, deploy, kopie zapasowe, monitoring.
Sensowne dopiero, gdy narzędzie wyjdzie poza zespół.

### D. Local-first / CRDT (Yjs, Automerge)

**Za:** świetna praca offline, scalanie bez konfliktów, edycja współbieżna.
**Przeciw:** raportowanie i zapytania są najsłabszą stroną CRDT, a to jest połowa wartości tego
narzędzia. Duża złożoność jak na kilka osób w jednym zespole.

## Rekomendacja: Supabase, synchronizacja na poziomie encji

**Nie synchronizujemy całego blobu stanu.** Gdyby dwie osoby zapisały cały obiekt, druga wymazałaby
zmiany pierwszej. Zamiast tego tabele odwzorowują model domenowy, a synchronizacji podlega
pojedynczy wiersz.

**Nie idziemy też w pełne event sourcing.** Log akcji kusi, bo reducer w
[store.jsx](../src/state/store.jsx) już produkuje serializowalne akcje — ale odtwarzanie, kolejność
i kompaktowanie logu to koszt nieproporcjonalny do kilkuosobowego zespołu.

### Model danych

```sql
organizations      (id, name)
users              (id, email, name)                    -- z Supabase Auth
memberships        (org_id, user_id, role)              -- owner | manager | member | viewer

templates          (id, org_id, name, description, phases jsonb, created_by, updated_at)
projects           (id, org_id, name, description, template_id, template_name,
                    repo_url, sprint_length_days, created_at, archived_at)

phases             (id, project_id, "order", name, tip, gate, completed_at, completed_by)
phase_criteria     (id, phase_id, text, checked, checked_at, checked_by)

sprints            (id, project_id, number, goal, start_date, end_date,
                    status, ceremonies jsonb, retro_notes, closed_at)

tasks              (id, project_id, phase_id, sprint_id, title, description,
                    status, priority, type, assignee, points, estimate_h,
                    due_date, blocked_by uuid[], created_at, updated_at, done_at)

task_links         (id, task_id, label, url)
comments           (id, task_id, author_id, text, created_at)
time_entries       (id, task_id, user_id, started_at, ended_at)

audit_log          (id, org_id, project_id, actor_id, action, payload jsonb, created_at)
```

Szablony zostają jako `jsonb` — są edytowane w całości w edytorze i nikt nie pracuje na nich
współbieżnie. Reszta idzie na wiersze, bo to na nich zderzają się edycje.

### Trzy decyzje warte uwagi

**1. Czas pracy przestaje być polem zadania.** Dziś `timeSpent` i `timerStartedAt` siedzą na
zadaniu. Przy dwóch osobach to się rozjeżdża natychmiast: jedna zatrzymuje timer, który druga
uruchomiła, i czas przepada. Dlatego `time_entries` z `user_id` — suma liczona przy odczycie,
każdy mierzy swój czas niezależnie.

**2. Odhaczenie kryterium zapisuje autora.** `checked_by` i `checked_at` już są w schemacie
lokalnym ([schema.js](../src/domain/schema.js)) — dziś puste, bo nie ma pojęcia użytkownika. Po
wprowadzeniu logowania wypełniają się same i pytanie „kto przepuścił tę fazę" ma odpowiedź.

**3. Domknięcie fazy przez procedurę na serwerze.** Bramka jest dziś sprawdzana w reducerze.
Po przejściu na chmurę klient przestaje być jedynym strażnikiem — warunek trafia do funkcji
`close_phase(phase_id)`, która sprawdza go w transakcji. Inaczej wystarczy jedno przestarzałe
okno przeglądarki, żeby domknąć fazę, której bramka właśnie przestała być spełniona.

### Konflikty

Każdy wiersz ma `updated_at`. Zapis wysyła wartość odczytaną przy wejściu w edycję; jeśli
w bazie jest nowsza, serwer odrzuca zapis i klient pokazuje, co się zmieniło. Dla większości pól
wystarczy wygrana ostatniego zapisu — poza:

- **statusem zadania** — przeniesienie tego samego zadania w dwie kolumny naraz wymaga decyzji
  człowieka, nie milczącego nadpisania,
- **domknięciem fazy i sprintu** — tu obowiązuje procedura serwerowa opisana wyżej.

### Offline

`localStorage` zostaje, ale zmienia rolę: z jedynego magazynu staje się pamięcią podręczną.
Aplikacja czyta z niej przy starcie (natychmiastowy render), a mutacje trafiają do kolejki, którą
warstwa synchronizacji opróżnia po odzyskaniu sieci. Reducer nie wie o niczym — to jest zaleta
architektury, którą już mamy: `dispatch` zostaje jedynym wejściem, a obok niego dokłada się
middleware wysyłający zmianę do bazy.

### Role

| Rola | Uprawnienia |
| --- | --- |
| `owner` | wszystko, w tym usuwanie projektów i zarządzanie zespołem |
| `manager` | domykanie faz i sprintów, edycja szablonów |
| `member` | zadania, komentarze, własny czas, odhaczanie kryteriów |
| `viewer` | tylko odczyt |

Egzekwowane przez RLS w Postgresie, nie w interfejsie — ukryty przycisk to nie jest zabezpieczenie.

## Wdrożenie etapami

Każdy etap jest samodzielnie użyteczny; można się zatrzymać po dowolnym.

**Etap 1 — logowanie i chmura dla jednej osoby (1–2 dni).**
Auth + jedna tabela ze stanem w `jsonb` na użytkownika. Znika ryzyko utraty danych, pojawia się
praca na wielu urządzeniach. Model domenowy bez zmian.

**Etap 2 — tabele encji i realtime (około tydzień).**
Rozbicie stanu na tabele, subskrypcja zmian projektu, `time_entries` zamiast pól na zadaniu.
Od tego momentu zespół pracuje na wspólnych danych.

**Etap 3 — role i procedury serwerowe (2–3 dni).**
RLS, `close_phase` i `close_sprint` jako funkcje w bazie, `audit_log`.

**Etap 4 — kolejka offline (2–3 dni).**
Bufor mutacji, wskaźnik stanu synchronizacji, obsługa odrzuconych zapisów.

## Koszt

Darmowy próg Supabase (500 MB bazy, 50 tys. aktywnych użytkowników miesięcznie) mieści zespół
z zapasem. Pierwszy płatny próg to około 25 USD miesięcznie i będzie potrzebny dopiero przy
wyjściu poza jedną firmę. Hosting frontendu pozostaje darmowy — to nadal statyczne pliki.

## Czego ta propozycja świadomie nie obejmuje

- Edycji współbieżnej w jednym polu tekstowym (dwie osoby w tym samym opisie zadania). Rozwiązanie
  to CRDT, a to osobna decyzja architektoniczna — na razie wystarczy blokada optymistyczna.
- Integracji z GitHubem (automatyczne domykanie zadań przy zmergowaniu PR). Sensowne, ale to
  osobna produkcja i warto ją zrobić po ustabilizowaniu modelu danych.
