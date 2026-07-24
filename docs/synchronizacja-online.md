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

**Etap 1 — logowanie i chmura dla jednej osoby. ✅ ZAIMPLEMENTOWANY.**
Auth + jedna tabela ze stanem w `jsonb` na użytkownika. Znika ryzyko utraty danych, pojawia się
praca na wielu urządzeniach. Model domenowy bez zmian. Szczegóły uruchomienia niżej.

**Etap 2 — tabele encji i realtime. ✅ ZAIMPLEMENTOWANY.**
Rozbicie stanu na tabele, subskrypcja zmian przestrzeni, `time_entries` zamiast pól na zadaniu.
Od tego momentu zespół pracuje na wspólnych danych.

**Etap 3 — role i procedury serwerowe. ✅ ZAIMPLEMENTOWANY** (poza `audit_log`).
RLS na wszystkich tabelach, `close_phase` i `close_sprint` jako funkcje w bazie.

**Etap 4 — trwała kolejka offline. ✅ ZAIMPLEMENTOWANY.**
Zmiany zrobione bez sieci przeżywają przeładowanie strony i zamknięcie przeglądarki. Szczegóły
niżej.

## Uruchomienie Etapu 1

Bez konfiguracji aplikacja działa lokalnie i nie pokazuje niczego związanego z chmurą — włączenie
synchronizacji jest w pełni opcjonalne.

1. Załóż projekt na [supabase.com](https://supabase.com).
2. W SQL Editorze uruchom [`supabase/migrations/0001_app_state.sql`](../supabase/migrations/0001_app_state.sql).
3. Skopiuj `.env.example` jako `.env.local` i uzupełnij `VITE_SUPABASE_URL` oraz
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. Zrestartuj serwer deweloperski. W pasku bocznym pojawi się „Zaloguj i synchronizuj".

Logowanie odbywa się **linkiem wysyłanym mailem** — aplikacja nigdy nie widzi ani nie przechowuje
hasła. Klucz `anon` jest publiczny z założenia; ochroną jest RLS w bazie, dlatego nigdy nie
umieszczaj w konfiguracji klucza `service_role`.

### Jak zachowuje się synchronizacja

- `localStorage` pozostaje magazynem podstawowym — chmura jest kopią i mostem między urządzeniami,
  a nie warunkiem działania.
- Każda akcja użytkownika podbija `meta.revision`; wysyłka jest opóźniona o 1,5 s, żeby seria zmian
  poszła jednym zapisem.
- Przy logowaniu wygrywa stan o wyższej rewizji — praca zrobiona offline nie ginie po cichu.
- Gdy inne urządzenie zapisało w międzyczasie, funkcja `save_app_state` odrzuca zapis, a aplikacja
  pokazuje wybór wersji zamiast nadpisywać cokolwiek automatycznie.
- Brak sieci przełącza wskaźnik w tryb „offline"; zapis rusza po powrocie połączenia.

## Uruchomienie Etapu 2

Po migracji `0001` uruchom [`0002_entities.sql`](../supabase/migrations/0002_entities.sql).
Po zalogowaniu w pasku bocznym pojawi się wybór **przestrzeni zespołu**. Załóż pierwszą — jeśli
masz projekty lokalnie, pusta przestrzeń przejmie je automatycznie przy pierwszym wejściu.

Zapraszanie ludzi odbywa się dziś przez dopisanie wiersza do `memberships` w panelu Supabase
(`workspace_id`, `user_id` osoby, `role`). Zaproszenia z poziomu aplikacji to osobna rzecz do
zrobienia.

### Jak działa synchronizacja zespołowa

- **Jednostką zapisu jest wiersz.** Dwie osoby pracujące na tym samym projekcie nie nadpisują się,
  dopóki nie ruszają tego samego pola tej samej encji.
- **Wysyłka powstaje z porównania stanów**, nie z tłumaczenia akcji na zapisy. Reducer ma
  kilkadziesiąt typów akcji i każdy kolejny wymagałby pamiętania o dopisaniu przekładu; różnica
  między stanami jest kompletna z definicji, więc nowa akcja synchronizuje się sama.
- **Realtime nie łata stanu pojedynczym wierszem.** Zdarzenie mówi tylko, że coś się ruszyło,
  a aplikacja pobiera świeży obraz przestrzeni. Przy skali zespołu to jest tanie, a odpada cała
  klasa błędów z częściowych aktualizacji.
- **Czas pracy jest per osoba** (`time_entries`). Zatrzymujesz wyłącznie swój pomiar; cudzy widać
  w sumie, ale przycisk nie udaje, że jest twój. Unikalny indeks pilnuje, żeby jedna osoba nie
  miała dwóch otwartych pomiarów na jednym zadaniu.
- **Bramki sprawdza baza.** `close_phase` liczy otwarte zadania i nieodhaczone kryteria
  w transakcji, więc nieodświeżona karta przeglądarki nie przepchnie fazy, której warunek właśnie
  przestał być spełniony.

### Role

Egzekwowane przez RLS, nie przez ukrywanie przycisków. `viewer` nie zapisze niczego nawet
z konsoli, a domykanie faz i sprintów wymaga roli `manager` lub `owner`.

## Kolejka offline

### Kolejka to różnica, nie lista operacji

Niewysłane zmiany nie są osobną strukturą danych. Kolejką jest **różnica między ostatnim stanem
potwierdzonym przez bazę a tym, co użytkownik ma teraz lokalnie** — wystarczyło więc utrwalić ten
pierwszy (`pm-sync-baseline` w `localStorage`, obsługa w [`pending.js`](../src/cloud/pending.js)).

Wobec listy operacji do odtworzenia daje to trzy rzeczy za darmo:

- **kompaktowanie** — dwadzieścia poprawek jednego zadania to nadal jeden zapis,
- **odporność na kolejność** — nie ma czego układać ani odtwarzać, różnicę liczy się na nowo,
- **idempotencję** — zapisy identyfikuje klucz wiersza, więc powtórzenie niczego nie psuje.

### Reguła, która chroni przed utratą pracy

> Stan lokalny **nigdy** nie jest zastępowany danymi z bazy, dopóki istnieją niewysłane zmiany.

Każdy cykl synchronizacji ma stałą kolejność: **najpierw wysyłka zaległości, potem pobranie.**
Odwrotna kolejność wymazywałaby pracę zrobioną offline — i dokładnie to robiła aplikacja przed
tą zmianą, gdy punkt odniesienia żył wyłącznie w pamięci karty.

Jest jeszcze strażnik na wyścig: jeśli użytkownik zmienił coś w trakcie oczekiwania na odpowiedź
z bazy, podmiana stanu zostaje pominięta, a te zmiany wychodzą w kolejnym cyklu.

### Zachowanie

- Punkt odniesienia jest związany z przestrzenią roboczą. Zapis z innej przestrzeni jest
  odrzucany — różnica względem niego wyglądałaby jak masowe usunięcie cudzych danych.
- Nieudana wysyłka jest ponawiana z narastającym odstępem (2 s → 30 s), a powrót sieci uruchamia
  ją natychmiast.
- Liczba oczekujących wierszy jest widoczna w pasku bocznym; przycisk odświeżania wymusza próbę.
- Zamknięcie karty z niewysłaną pracą wywołuje ostrzeżenie przeglądarki.
- Gdy zabraknie miejsca w `localStorage`, aplikacja **mówi o tym wprost** zamiast milcząco
  obiecywać trwałość, której nie ma.

### Czego kolejka nie rozwiązuje

Scalania równoległych zmian **w tym samym polu**. Jeśli obie osoby edytowały opis tego samego
zadania, wygrywa zapis późniejszy — i tak działa cały model wierszowy. Rozwiązaniem byłby CRDT,
ale to osobna decyzja architektoniczna, świadomie odłożona.

### Czego Etap 2 jeszcze nie ma

- **Zaproszeń do zespołu z poziomu aplikacji** — na razie przez panel Supabase.
- **Wiązania członka zespołu z kontem** w interfejsie. Kolumna `members.user_id` istnieje i jest
  odczytywana, ale ustawia się ją dziś ręcznie. Bez tego rozbicie czasu na osoby pokazuje „Ty"
  i kreski zamiast imion.
- **`audit_log`** — historia zmian poza `checked_by` i `completed_by`.

## Koszt

Darmowy próg Supabase (500 MB bazy, 50 tys. aktywnych użytkowników miesięcznie) mieści zespół
z zapasem. Pierwszy płatny próg to około 25 USD miesięcznie i będzie potrzebny dopiero przy
wyjściu poza jedną firmę. Hosting frontendu pozostaje darmowy — to nadal statyczne pliki.

## Czego ta propozycja świadomie nie obejmuje

- Edycji współbieżnej w jednym polu tekstowym (dwie osoby w tym samym opisie zadania). Rozwiązanie
  to CRDT, a to osobna decyzja architektoniczna — na razie wystarczy blokada optymistyczna.
- Integracji z GitHubem (automatyczne domykanie zadań przy zmergowaniu PR). Sensowne, ale to
  osobna produkcja i warto ją zrobić po ustabilizowaniu modelu danych.
