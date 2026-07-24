import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const hasCloud = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)

  return {
    plugins: [
      react(),
      {
        /**
         * Zmienne VITE_* są wtapiane w bundle w chwili builda, nie czytane
         * przy starcie aplikacji. Build bez nich daje działającą aplikację
         * — tyle że wyłącznie lokalną, bez śladu po logowaniu i synchronizacji.
         *
         * To jest cicha awaria, którą łatwo wdrożyć i zauważyć dopiero, gdy
         * zespół nie może się zalogować. Dlatego mówimy o tym głośno.
         */
        name: 'ostrzez-o-braku-konfiguracji-chmury',
        apply: 'build',
        buildStart() {
          if (!hasCloud) {
            this.warn(
              '\n' +
                '  ┌─────────────────────────────────────────────────────────────┐\n' +
                '  │  UWAGA: build BEZ konfiguracji chmury.                      │\n' +
                '  │                                                             │\n' +
                '  │  Brakuje VITE_SUPABASE_URL lub VITE_SUPABASE_ANON_KEY.      │\n' +
                '  │  Aplikacja zadziała, ale wyłącznie lokalnie — logowanie     │\n' +
                '  │  i synchronizacja zespołu nie będą dostępne.                │\n' +
                '  │                                                             │\n' +
                '  │  Jeśli to build produkcyjny, przerwij i uzupełnij .env.      │\n' +
                '  └─────────────────────────────────────────────────────────────┘\n'
            )
          }
        },
      },
    ],

    /**
     * Ścieżka bazowa. Domyślnie „/" — aplikacja siedzi w katalogu głównym
     * domeny. Przy wdrożeniu do podkatalogu (np. domena.pl/pm/) ustaw
     * VITE_BASE=/pm/, inaczej odwołania do zasobów będą wskazywać w próżnię.
     */
    base: env.VITE_BASE || '/',
  }
})
