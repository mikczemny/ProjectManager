# Wdrożenie na własny serwer

Aplikacja to **statyczne pliki** — HTML, JS, CSS. Nie ma backendu do uruchomienia, procesu Node do
pilnowania ani bazy do postawienia (dane obsługuje Supabase). Wdrożenie sprowadza się do
skopiowania katalogu `dist/` tam, gdzie serwer www go zobaczy.

## Trzy rzeczy, które trzeba wiedzieć zanim zaczniesz

### 1. Klucze są wtapiane w bundle podczas builda

Zmienne `VITE_*` **nie są czytane przy starcie aplikacji** — Vite wstawia ich wartości do kodu
w chwili budowania. Konsekwencja jest praktyczna:

> Build bez `.env.local` produkuje działającą aplikację **bez chmury**. Nie zobaczysz błędu.
> Zobaczysz brak logowania — zwykle dopiero wtedy, gdy ktoś z zespołu spróbuje się zalogować.

Dlatego `npm run build` wypisuje głośne ostrzeżenie, gdy kluczy brakuje. Jeśli zobaczysz ramkę
`UWAGA: build BEZ konfiguracji chmury`, przerwij i uzupełnij konfigurację.

Wynika z tego też, że **nie da się zbudować raz i skonfigurować później**. Zmiana kluczy oznacza
ponowny build.

### 2. Klucz `anon` będzie widoczny w kodzie strony — i tak ma być

Po wdrożeniu każdy może otworzyć źródło i znaleźć adres projektu Supabase oraz klucz `anon`.
To nie jest wyciek: ten klucz jest publiczny z założenia, a dostępu pilnuje RLS w bazie
(migracja [`0002_entities.sql`](../supabase/migrations/0002_entities.sql)). Bez zalogowania klucz
nie daje dostępu do niczego, a po zalogowaniu — wyłącznie do przestrzeni, do których należysz.

Czego **nigdy** nie wolno wstawić do konfiguracji frontendu: klucza `service_role`. Ten omija RLS
i daje pełen dostęp do wszystkich danych.

### 3. Domena musi być dopisana w Supabase, inaczej logowanie nie zadziała

Magic link wraca pod adres, z którego wyszedł (`window.location.origin`). Supabase odrzuci
przekierowanie na adres, którego nie zna — link z maila po prostu nie zaloguje.

W panelu Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://projekty.twojadomena.pl`
- **Redirect URLs**: dopisz `https://projekty.twojadomena.pl/**`

Jeśli nadal chcesz pracować lokalnie, zostaw też `http://localhost:5173/**`.

## Wdrożenie krok po kroku

### Krok 1 — konfiguracja

W katalogu projektu utwórz `.env.local` (jeśli jeszcze go nie ma):

```bash
cp .env.example .env.local
```

Uzupełnij `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` wartościami z panelu Supabase
(Project Settings → API).

> Jeśli aplikacja ma stać w podkatalogu domeny (np. `twojadomena.pl/pm/`), dopisz jeszcze
> `VITE_BASE=/pm/`. Bez tego odwołania do zasobów będą wskazywać w próżnię i zobaczysz białą
> stronę.

### Krok 2 — build

```bash
npm ci && npm run build
```

Efekt trafia do `dist/`. Upewnij się, że **nie** pojawiło się ostrzeżenie o braku konfiguracji
chmury.

### Krok 3 — wysyłka na serwer

Przez SSH (`--delete` usuwa z serwera pliki po poprzednich wdrożeniach — bez tego stare bundle
zostają tam na zawsze):

```bash
rsync -avz --delete dist/ user@serwer:/var/www/projekty.dev/
```

Przez FTP / panel hostingu: wgraj **zawartość** katalogu `dist/` (nie sam katalog) do katalogu
publicznego — zwykle `public_html`, `www` albo `htdocs`.

### Krok 4 — serwer www

- **nginx**: skopiuj [`deploy/nginx.conf`](../deploy/nginx.conf) do `/etc/nginx/sites-available/`,
  podmień domenę i ścieżkę certyfikatu, zrób dowiązanie w `sites-enabled/`, sprawdź `nginx -t`
  i przeładuj.
- **Apache / hosting współdzielony**: wgraj [`deploy/.htaccess`](../deploy/.htaccess) obok
  `index.html`.

Certyfikat HTTPS, jeśli jeszcze go nie masz:

```bash
sudo certbot --nginx -d projekty.twojadomena.pl
```

### Krok 5 — sprawdzenie

1. Otwórz `https://projekty.twojadomena.pl` — powinna pojawić się aplikacja.
2. W pasku bocznym musi być widoczne **„Zaloguj i synchronizuj"**. Jeśli go nie ma, build poszedł
   bez kluczy — wróć do kroku 1.
3. Zaloguj się mailem i kliknij link. Jeśli link nie loguje, sprawdź Redirect URLs w Supabase.
4. Załóż przestrzeń zespołu i sprawdź, czy projekt pojawia się po odświeżeniu strony.

## Aktualizacja po zmianach w kodzie

```bash
git pull && npm ci && npm run build && rsync -avz --delete dist/ user@serwer:/var/www/projekty.dev/
```

Użytkownicy dostaną nową wersję po odświeżeniu strony — `index.html` nie jest cache'owany, więc
od razu wskaże na nowe pliki.

## Kopia zapasowa

Wdrożenie na serwer **nie jest kopią zapasową danych**. Pliki na serwerze to sama aplikacja; dane
zespołu żyją w Supabase. O kopie zadbaj osobno:

- Supabase (plan płatny) robi automatyczne kopie bazy.
- Niezależnie od tego przycisk **„Kopia"** w pasku bocznym eksportuje wszystko do pliku JSON.
  Warto to robić przed większymi zmianami.

## Czego to wdrożenie nie obejmuje

- **Automatycznego wdrażania z repozytorium** (CI/CD). Dziś build i wysyłka są ręczne. Jeśli
  zacznie to uwierać, GitHub Actions z krokiem `rsync` to około pół dnia roboty — klucze trafiają
  wtedy do sekretów repozytorium, nie na dysk serwera.
- **Środowiska testowego** obok produkcyjnego. Przy jednym zespole i jednym produkcie to zwykle
  przerost formy, ale gdy dojdzie więcej osób, osobna subdomena z osobnym projektem Supabase
  oszczędza nerwów.
