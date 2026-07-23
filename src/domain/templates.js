/**
 * Wbudowane szablony produkcji — „jak POWINNO się to robić".
 *
 * To są DANE, nie kod. Mają dokładnie ten sam kształt co szablony tworzone
 * przez użytkownika i eksportowane do JSON, więc dodanie nowego typu produkcji
 * nie wymaga dotykania kodu aplikacji.
 *
 * Kształt fazy:
 *   {
 *     order, name,
 *     tip,       — rada mentora: po co ta faza i gdzie ludzie się wykładają
 *     gate,      — jednozdaniowe podsumowanie warunku przejścia dalej
 *     criteria,  — [tekst] kryteria wyjścia; wszystkie muszą być odhaczone,
 *                  żeby program wpuścił zespół do kolejnej fazy
 *     tasks: [{ title, priority, type, estimateH, points }]
 *   }
 */

export const BLANK_TEMPLATE = {
  id: "blank",
  name: "Pusty projekt",
  description: "Zacznij od zera — sam definiujesz fazy i bramki.",
  builtIn: true,
  phases: [],
};

export const SOFTWARE_TEMPLATE = {
  id: "software-dev",
  name: "Rozwój oprogramowania",
  description: "Pełny cykl produkcji software'u — od zakresu MVP po wdrożenie.",
  builtIn: true,
  phases: [
    {
      order: 1,
      name: "Planowanie",
      tip: "Zanim napiszesz pierwszą linijkę kodu, spisz czego NIE robisz w wersji 1.0. Najczęstsza przyczyna poślizgów to rozmyty zakres, nie brak umiejętności.",
      gate: "Zakres MVP jest zamknięty i wiadomo, co jest poza nim.",
      criteria: [
        "Zakres MVP spisany — lista funkcji, które MUSZĄ być w 1.0",
        "Spisana lista „poza zakresem\" — co świadomie odpuszczamy",
        "Stack technologiczny wybrany i uzasadniony",
        "Kamienie milowe z datami wpisane do projektu",
        "Zespół zna cel projektu i potrafi go powtórzyć jednym zdaniem",
      ],
      tasks: [
        { title: "Zdefiniuj zakres MVP", priority: "high", type: "chore", estimateH: 4, points: 3 },
        { title: "Spisz wymagania funkcjonalne", priority: "medium", type: "docs", estimateH: 6, points: 5 },
        { title: "Wybierz stack technologiczny", priority: "medium", type: "spike", estimateH: 4, points: 3 },
        { title: "Oszacuj harmonogram i kamienie milowe", priority: "medium", type: "chore", estimateH: 3, points: 2 },
        { title: "Zbuduj wstępny backlog produktu", priority: "high", type: "chore", estimateH: 4, points: 3 },
      ],
    },
    {
      order: 2,
      name: "Projektowanie",
      tip: "Zaprojektuj model danych i API zanim zaczniesz UI — zmiana schematu bazy po napisaniu frontendu kosztuje 5x więcej.",
      gate: "Architektura zatwierdzona: dane, API i kluczowe ekrany.",
      criteria: [
        "Schemat bazy danych zatwierdzony przez zespół",
        "Kontrakty API opisane i uzgodnione między frontem a backendem",
        "Makiety kluczowych ekranów zaakceptowane",
        "Strategia migracji danych ustalona",
        "Zidentyfikowane ryzyka techniczne mają właściciela",
      ],
      tasks: [
        { title: "Zaprojektuj model danych / schemat bazy", priority: "high", type: "chore", estimateH: 8, points: 5 },
        { title: "Zaprojektuj kontrakty API", priority: "high", type: "docs", estimateH: 6, points: 5 },
        { title: "Makiety kluczowych ekranów", priority: "medium", type: "chore", estimateH: 10, points: 8 },
        { title: "Zdefiniuj strategię migracji danych", priority: "low", type: "spike", estimateH: 3, points: 2 },
      ],
    },
    {
      order: 3,
      name: "Development",
      tip: "Buduj w pionowych plastrach (vertical slices) — jedna działająca funkcja end-to-end jest warta więcej niż dziesięć na wpół gotowych.",
      gate: "Wszystkie funkcje MVP działają end-to-end, CI jest zielone.",
      criteria: [
        "Repozytorium i CI działają — każdy commit jest budowany",
        "Wszystkie funkcje z zakresu MVP działają end-to-end na dev",
        "Code review przeszło każde zadanie wchodzące do main",
        "Brak zadań w statusie „W trakcie\" starszych niż jeden sprint",
        "Obsłużone stany błędów i przypadki brzegowe głównych ścieżek",
      ],
      tasks: [
        { title: "Skonfiguruj repozytorium i CI", priority: "medium", type: "chore", estimateH: 4, points: 3 },
        { title: "Zaimplementuj backend / API", priority: "high", type: "feature", estimateH: 40, points: 21 },
        { title: "Zaimplementuj frontend", priority: "high", type: "feature", estimateH: 40, points: 21 },
        { title: "Integracja backend-frontend", priority: "medium", type: "feature", estimateH: 12, points: 8 },
        { title: "Obsługa błędów i stanów brzegowych", priority: "medium", type: "feature", estimateH: 8, points: 5 },
      ],
    },
    {
      order: 4,
      name: "Testowanie",
      tip: "Testy pisane po fakcie łapią błędy, testy pisane przed implementacją zapobiegają im. Zacznij od ścieżek krytycznych, nie od 100% pokrycia.",
      gate: "Ścieżki krytyczne pokryte testami, zero błędów blokujących.",
      criteria: [
        "Ścieżki krytyczne pokryte testami end-to-end",
        "Zero otwartych błędów o priorytecie wysokim",
        "Aplikacja przetestowana przez osoby spoza zespołu",
        "Przegląd bezpieczeństwa i uprawnień zakończony",
        "Wydajność sprawdzona na danych zbliżonych do produkcyjnych",
      ],
      tasks: [
        { title: "Testy jednostkowe kluczowej logiki", priority: "medium", type: "chore", estimateH: 12, points: 8 },
        { title: "Testy end-to-end głównych ścieżek", priority: "medium", type: "chore", estimateH: 10, points: 8 },
        { title: "Testy z realnymi użytkownikami", priority: "high", type: "chore", estimateH: 8, points: 5 },
        { title: "Przegląd bezpieczeństwa i uprawnień", priority: "high", type: "chore", estimateH: 6, points: 5 },
      ],
    },
    {
      order: 5,
      name: "Wdrożenie",
      tip: "Miej plan rollbacku zanim wdrożysz, nie po tym jak coś się posypie. Deploy w piątek po południu to żart, nie strategia.",
      gate: "Aplikacja na produkcji, monitoring działa, rollback przetestowany.",
      criteria: [
        "Środowisko produkcyjne gotowe i skonfigurowane",
        "Monitoring i logi zbierają dane, alerty mają odbiorcę",
        "Procedura rollbacku przetestowana, nie tylko opisana",
        "Kopia zapasowa danych wykonana przed wdrożeniem",
        "Wdrożenie zakończone, metryki stabilne przez pierwszą dobę",
      ],
      tasks: [
        { title: "Przygotuj środowisko produkcyjne", priority: "high", type: "chore", estimateH: 8, points: 5 },
        { title: "Skonfiguruj monitoring i logi", priority: "medium", type: "chore", estimateH: 6, points: 5 },
        { title: "Przetestuj procedurę rollbacku", priority: "high", type: "chore", estimateH: 3, points: 3 },
        { title: "Wdrożenie produkcyjne", priority: "high", type: "release", estimateH: 4, points: 3 },
        { title: "Zbierz pierwszy feedback po wdrożeniu", priority: "low", type: "chore", estimateH: 4, points: 2 },
      ],
    },
  ],
};

export const SCRUM_TEMPLATE = {
  id: "scrum-product",
  name: "Produkt w Scrumie",
  description:
    "Ciągły rozwój produktu w rytmie sprintów — od setupu zespołu po powtarzalną pętlę dostarczania.",
  builtIn: true,
  phases: [
    {
      order: 1,
      name: "Setup zespołu",
      tip: "Scrum bez Definition of Done to tylko spotkania. Ustalcie ją ZANIM ruszy pierwszy sprint, bo później każdy będzie miał własną.",
      gate: "Role, rytm i Definition of Done ustalone na piśmie.",
      criteria: [
        "Product Owner i Scrum Master wyznaczeni imiennie",
        "Definition of Done spisana i zaakceptowana przez cały zespół",
        "Długość sprintu ustalona i wpisana w projekt",
        "Terminy ceremonii ustalone i w kalendarzach",
        "Skala estymacji uzgodniona (np. Fibonacci w story pointach)",
      ],
      tasks: [
        { title: "Wyznacz Product Ownera i Scrum Mastera", priority: "high", type: "chore", estimateH: 1, points: 1 },
        { title: "Spisz Definition of Done", priority: "high", type: "docs", estimateH: 3, points: 3 },
        { title: "Ustal długość sprintu i terminy ceremonii", priority: "high", type: "chore", estimateH: 2, points: 1 },
        { title: "Uzgodnij skalę estymacji", priority: "medium", type: "chore", estimateH: 1, points: 1 },
      ],
    },
    {
      order: 2,
      name: "Backlog produktu",
      tip: "Historyjka bez kryteriów akceptacji to życzenie, nie zadanie. „Jako X chcę Y, żeby Z\" — jeśli nie umiesz uzupełnić Z, nie wiesz po co to robisz.",
      gate: "Backlog uporządkowany, góra listy gotowa do wzięcia na sprint.",
      criteria: [
        "Backlog zawiera historyjki w formacie „Jako… chcę… żeby…\"",
        "Historyjki na górze backlogu mają kryteria akceptacji",
        "Backlog jest uporządkowany według wartości biznesowej",
        "Górne historyjki wyestymowane w story pointach",
        "Product Owner potwierdził priorytety",
      ],
      tasks: [
        { title: "Zbierz i spisz historyjki użytkownika", priority: "high", type: "docs", estimateH: 8, points: 5 },
        { title: "Dopisz kryteria akceptacji do górnych historyjek", priority: "high", type: "docs", estimateH: 6, points: 5 },
        { title: "Uporządkuj backlog według wartości", priority: "high", type: "chore", estimateH: 3, points: 3 },
        { title: "Estymacja zespołowa (planning poker)", priority: "medium", type: "chore", estimateH: 4, points: 3 },
      ],
    },
    {
      order: 3,
      name: "Pętla sprintów",
      tip: "Cel sprintu to jedno zdanie, nie lista zadań. Jeśli zespół nie umie go powiedzieć bez zaglądania do narzędzia, sprint nie ma celu.",
      gate: "Zespół ma powtarzalną, przewidywalną pętlę dostarczania.",
      criteria: [
        "Min. 3 sprinty domknięte z kompletem ceremonii",
        "Velocity ustabilizowane — odchylenie poniżej 25% między sprintami",
        "Każdy sprint miał spisany cel przed startem",
        "Wnioski z retrospektyw zamienione na konkretne zadania",
        "Przyrost z każdego sprintu był potencjalnie gotowy do wydania",
      ],
      tasks: [
        { title: "Sprint planning — ustal cel i weź zadania", priority: "high", type: "chore", estimateH: 4, points: 2 },
        { title: "Codzienne daily — 15 minut, bez raportowania szefowi", priority: "medium", type: "chore", estimateH: 3, points: 1 },
        { title: "Sprint review — pokaż działający przyrost", priority: "high", type: "chore", estimateH: 2, points: 2 },
        { title: "Retrospektywa — wnioski zamień w zadania", priority: "high", type: "chore", estimateH: 2, points: 2 },
        { title: "Pielęgnacja backlogu w trakcie sprintu", priority: "medium", type: "chore", estimateH: 3, points: 2 },
      ],
    },
    {
      order: 4,
      name: "Dostarczenie",
      tip: "„Potencjalnie gotowe do wydania\" i „wydane\" to dwie różne rzeczy. Jeśli przyrost nigdy nie trafia do użytkowników, mierzysz aktywność, nie wartość.",
      gate: "Przyrost trafił do użytkowników i wiadomo, czy zadziałał.",
      criteria: [
        "Przyrost wdrożony na produkcję",
        "Metryki sukcesu zdefiniowane przed wdrożeniem i zmierzone po",
        "Feedback od użytkowników zebrany i wrzucony do backlogu",
        "Dług techniczny z tego cyklu spisany, nie przemilczany",
      ],
      tasks: [
        { title: "Wdróż przyrost na produkcję", priority: "high", type: "release", estimateH: 3, points: 3 },
        { title: "Zmierz metryki sukcesu", priority: "high", type: "chore", estimateH: 3, points: 2 },
        { title: "Zbierz feedback i uzupełnij backlog", priority: "medium", type: "chore", estimateH: 4, points: 3 },
        { title: "Spisz dług techniczny", priority: "medium", type: "docs", estimateH: 2, points: 2 },
      ],
    },
  ],
};

export const MVP_SPRINT_TEMPLATE = {
  id: "mvp-sprint",
  name: "MVP / prototyp (2 tygodnie)",
  description:
    "Krótka pętla: zbuduj najmniejszą rzecz, która weryfikuje pomysł, i pokaż ją ludziom.",
  builtIn: true,
  phases: [
    {
      order: 1,
      name: "Hipoteza",
      tip: "Zapisz jedno zdanie: „wierzę, że X zrobi Y, i poznam to po Z\". Jeśli nie umiesz wskazać Z, budujesz na wyczucie, nie na dowód.",
      gate: "Hipoteza i miara sukcesu spisane jednym zdaniem.",
      criteria: [
        "Hipoteza spisana w formie „wierzę, że… poznam to po…\"",
        "Miara sukcesu jest liczbą, nie odczuciem",
        "Zakres wycięty do jednej ścieżki użytkownika",
      ],
      tasks: [
        { title: "Spisz hipotezę i miarę sukcesu", priority: "high", type: "docs", estimateH: 2, points: 2 },
        { title: "Wytnij zakres do jednej ścieżki użytkownika", priority: "high", type: "chore", estimateH: 2, points: 2 },
      ],
    },
    {
      order: 2,
      name: "Budowa",
      tip: "Prototyp to nie produkcja. Wolno ci zahardkodować dane, pominąć logowanie i zignorować edge case'y — pod warunkiem że wiesz, że to robisz.",
      gate: "Jedna ścieżka działa end-to-end i da się ją pokazać bez tłumaczenia.",
      criteria: [
        "Główna ścieżka działa od początku do końca",
        "Da się ją pokazać obcej osobie bez komentarza „tu sobie wyobraź\"",
        "Skróty i długi techniczne spisane, żeby nie wjechały na produkcję",
      ],
      tasks: [
        { title: "Szkielet aplikacji + routing", priority: "high", type: "feature", estimateH: 4, points: 3 },
        { title: "Zaimplementuj główną ścieżkę", priority: "high", type: "feature", estimateH: 20, points: 13 },
        { title: "Minimalny UI (bez dopieszczania)", priority: "medium", type: "feature", estimateH: 8, points: 5 },
        { title: "Spisz zaciągnięte długi techniczne", priority: "low", type: "docs", estimateH: 1, points: 1 },
      ],
    },
    {
      order: 3,
      name: "Weryfikacja",
      tip: "Pięciu użytkowników wyłapie większość problemów użyteczności. Nie pytaj „czy się podoba\" — daj zadanie i patrz gdzie utkną.",
      gate: "Prototyp przetestowany, decyzja go/no-go podjęta.",
      criteria: [
        "Min. 5 osób przeszło przez prototyp z konkretnym zadaniem",
        "Wnioski spisane, nie tylko omówione",
        "Decyzja zapadła: rozwijamy / pivot / zamykamy",
      ],
      tasks: [
        { title: "Testy z 5 użytkownikami", priority: "high", type: "chore", estimateH: 6, points: 5 },
        { title: "Spisz wnioski i decyzję go/no-go", priority: "high", type: "docs", estimateH: 3, points: 3 },
      ],
    },
  ],
};

export const RELEASE_TEMPLATE = {
  id: "release",
  name: "Wydanie wersji",
  description:
    "Checklista wypuszczenia kolejnej wersji istniejącej aplikacji — od zamrożenia kodu po retrospektywę.",
  builtIn: true,
  phases: [
    {
      order: 1,
      name: "Zamrożenie kodu",
      tip: "Code freeze znaczy code freeze. Każda „drobna poprawka\" wciśnięta po zamrożeniu unieważnia testy, które właśnie przeszły.",
      gate: "Branch release utworzony, zakres wersji zamknięty.",
      criteria: [
        "Branch release utworzony z main",
        "Lista zmian wchodzących do wersji zamknięta",
        "Numer wersji podbity",
        "Zespół poinformowany o zamrożeniu",
      ],
      tasks: [
        { title: "Utwórz branch release", priority: "high", type: "chore", estimateH: 1, points: 1 },
        { title: "Zamroź zakres — spisz co wchodzi do wersji", priority: "high", type: "docs", estimateH: 2, points: 2 },
        { title: "Podbij numer wersji", priority: "medium", type: "chore", estimateH: 1, points: 1 },
      ],
    },
    {
      order: 2,
      name: "Kontrola jakości",
      tip: "Testuj na środowisku możliwie identycznym z produkcją. Bug, który pojawia się tylko na produkcji, to prawie zawsze różnica w konfiguracji.",
      gate: "Regresja przeszła na stagingu, zero błędów blokujących.",
      criteria: [
        "Pełna regresja wykonana na stagingu",
        "Migracje bazy przetestowane na kopii danych produkcyjnych",
        "Zero otwartych błędów blokujących",
        "Test wydajności nie wykazał regresji",
      ],
      tasks: [
        { title: "Pełna regresja na stagingu", priority: "high", type: "chore", estimateH: 8, points: 5 },
        { title: "Weryfikacja migracji bazy danych", priority: "high", type: "chore", estimateH: 4, points: 3 },
        { title: "Test wydajności pod obciążeniem", priority: "medium", type: "chore", estimateH: 4, points: 3 },
        { title: "Napraw błędy blokujące", priority: "high", type: "bug", estimateH: 8, points: 5 },
      ],
    },
    {
      order: 3,
      name: "Wydanie",
      tip: "Wdrażaj stopniowo, jeśli możesz — canary albo feature flag. Wypuszczenie na 100% ruchu naraz oznacza, że błąd dotyka wszystkich, zanim go zauważysz.",
      gate: "Wersja na produkcji, metryki stabilne.",
      criteria: [
        "Kopia zapasowa danych produkcyjnych wykonana",
        "Wdrożenie zakończone powodzeniem",
        "Metryki i logi obserwowane przez min. godzinę po wdrożeniu",
        "Plan rollbacku był gotowy przed startem",
      ],
      tasks: [
        { title: "Kopia zapasowa danych produkcyjnych", priority: "high", type: "chore", estimateH: 1, points: 1 },
        { title: "Wdrożenie na produkcję", priority: "high", type: "release", estimateH: 2, points: 2 },
        { title: "Obserwacja metryk i logów po wdrożeniu", priority: "high", type: "chore", estimateH: 3, points: 2 },
      ],
    },
    {
      order: 4,
      name: "Domknięcie",
      tip: "Retrospektywa robiona tydzień później to już archeologia. Zrób ją w ciągu 48 godzin, póki wszyscy pamiętają, co bolało.",
      gate: "Changelog opublikowany, retrospektywa zrobiona, branch zmergowany.",
      criteria: [
        "Changelog opublikowany",
        "Użytkownicy poinformowani o zmianach",
        "Retrospektywa wydania przeprowadzona w ciągu 48 godzin",
        "Branch release zmergowany z powrotem do main",
      ],
      tasks: [
        { title: "Opublikuj changelog", priority: "medium", type: "docs", estimateH: 2, points: 2 },
        { title: "Poinformuj użytkowników", priority: "medium", type: "chore", estimateH: 2, points: 1 },
        { title: "Retrospektywa wydania", priority: "medium", type: "chore", estimateH: 2, points: 2 },
        { title: "Zmerguj release z powrotem do main", priority: "high", type: "chore", estimateH: 1, points: 1 },
      ],
    },
  ],
};

export const HOTFIX_TEMPLATE = {
  id: "hotfix",
  name: "Hotfix produkcyjny",
  description: "Ścieżka na awarię: opanuj, napraw, wyciągnij wnioski. Krótka i bezlitosna.",
  builtIn: true,
  phases: [
    {
      order: 1,
      name: "Opanowanie",
      tip: "Najpierw zatrzymaj krwawienie, potem szukaj przyczyny. Rollback w 5 minut bije diagnozę w 2 godziny, gdy użytkownicy nie mogą pracować.",
      gate: "Skutki dla użytkowników zatrzymane.",
      criteria: [
        "Zasięg awarii oceniony — wiadomo kogo i co dotyczy",
        "Skutki zatrzymane: rollback, feature flag albo obejście",
        "Użytkownicy poinformowani",
      ],
      tasks: [
        { title: "Oceń zasięg awarii", priority: "high", type: "chore", estimateH: 1, points: 1 },
        { title: "Rollback lub wyłączenie feature flagą", priority: "high", type: "chore", estimateH: 1, points: 2 },
        { title: "Poinformuj użytkowników o awarii", priority: "high", type: "chore", estimateH: 1, points: 1 },
      ],
    },
    {
      order: 2,
      name: "Naprawa",
      tip: "Napisz test, który odtwarza błąd, ZANIM go naprawisz. Inaczej nie masz dowodu, że naprawiłeś, ani ochrony przed powrotem.",
      gate: "Poprawka na produkcji, test regresji istnieje.",
      criteria: [
        "Błąd odtworzony lokalnie",
        "Istnieje test, który failuje przed poprawką i przechodzi po niej",
        "Przyczyna naprawiona, nie objaw",
        "Poprawka wdrożona i potwierdzona na produkcji",
      ],
      tasks: [
        { title: "Odtwórz błąd lokalnie", priority: "high", type: "bug", estimateH: 2, points: 3 },
        { title: "Napisz test odtwarzający błąd", priority: "high", type: "chore", estimateH: 2, points: 2 },
        { title: "Napraw przyczynę", priority: "high", type: "bug", estimateH: 4, points: 5 },
        { title: "Wdróż i potwierdź poprawkę", priority: "high", type: "release", estimateH: 2, points: 2 },
      ],
    },
    {
      order: 3,
      name: "Wnioski",
      tip: "Post-mortem bez winnych. Szukasz luki w systemie, nie w człowieku — bo człowiek odejdzie, a luka zostanie.",
      gate: "Post-mortem spisany, działania zapobiegawcze zaplanowane.",
      criteria: [
        "Post-mortem zawiera oś czasu, przyczynę źródłową i skutki",
        "Monitoring wykrywający ten przypadek dodany",
        "Działania zapobiegawcze istnieją jako zadania z właścicielem",
        "Post-mortem nie wskazuje winnego, tylko lukę w procesie",
      ],
      tasks: [
        { title: "Spisz post-mortem (oś czasu, przyczyna, skutki)", priority: "high", type: "docs", estimateH: 3, points: 3 },
        { title: "Dodaj monitoring wykrywający ten przypadek", priority: "medium", type: "chore", estimateH: 4, points: 3 },
        { title: "Zaplanuj działania zapobiegawcze", priority: "medium", type: "chore", estimateH: 2, points: 2 },
      ],
    },
  ],
};

export const BUILT_IN_TEMPLATES = [
  SOFTWARE_TEMPLATE,
  SCRUM_TEMPLATE,
  MVP_SPRINT_TEMPLATE,
  RELEASE_TEMPLATE,
  HOTFIX_TEMPLATE,
  BLANK_TEMPLATE,
];
