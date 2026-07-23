# projekty.dev

Prosta aplikacja webowa do zarządzania projektami programistycznymi.

## Funkcje

- **Projekty** — tworzenie, usuwanie, pasek postępu.
- **Tablica kanban** — Do zrobienia / W trakcie / Review / Zrobione, drag & drop.
- **Śledzenie czasu** — timer start/stop na zadaniu, suma czasu na projekt.
- **Zespół** — dodawanie osób, przypisywanie do zadań, obciążenie pracą.
- **Komentarze** — dziennik zmian przy każdym zadaniu.
- **Szablony projektów** — gotowy szablon "Rozwój oprogramowania" (5 faz: Planowanie → Projektowanie → Development → Testowanie → Wdrożenie) z zadaniami i poradami mentora dopiętymi do każdej fazy.

Dane trzymane są lokalnie w przeglądarce (`localStorage`) — bez backendu.

## Uruchomienie

\`\`\`bash
npm install
npm run dev
\`\`\`

Aplikacja wystartuje pod adresem podanym przez Vite (domyślnie http://localhost:5173).

## Build produkcyjny

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Stos technologiczny

- React 19 + Vite
- lucide-react — ikony
- Brak backendu / bazy danych — dane w localStorage

## Struktura

\`\`\`
src/
  App.jsx       # cała logika i UI aplikacji
  main.jsx      # punkt wejścia React
  index.css     # bazowe style globalne
\`\`\`

## Plany rozwoju

- Kolejne szablony projektów (np. produkcja wideo / YouTube)
- Filtrowanie tablicy po osobie / priorytecie
- Terminy (deadline'y) i widok kalendarza
- Eksport / import danych (JSON)
