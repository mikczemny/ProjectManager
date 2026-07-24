# Wdrożenie na własny serwer

> **Status: odłożone.** Wszystko poniżej jest gotowe do użycia — konfiguracje serwera, workflow
> wdrożeniowy i instrukcja. Brakuje wyłącznie kroków, które trzeba wykonać po stronie hostingu
> i panelu GitHuba. Aplikacja działa tymczasem lokalnie, bez żadnych braków funkcjonalnych.
>
> Rozpoznanie docelowego serwera jest w sekcji [Stan rozpoznania](#stan-rozpoznania) — przy
> powrocie do tematu nie trzeba go powtarzać.

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

## Stan rozpoznania

Ustalone na docelowym serwerze (lipiec 2026), żeby nie diagnozować tego ponownie:

| Element | Ustalenie | Znaczenie |
| --- | --- | --- |
| Panel | DirectAdmin (układ `~/domains/DOMENA/public_html`) | katalog docelowy wg wzorca niżej |
| Serwer www | LiteSpeed (obecny katalog `lscache`) | czyta `.htaccess`, `deploy/nginx.conf` niepotrzebny |
| `rsync` | jest, `/usr/bin/rsync` | workflow działa bez zmian, wariant FTP zbędny |
| `git` | jest | — |
| `node` | **brak na serwerze** | bez znaczenia: build robi runner GitHuba, serwer serwuje gotowe pliki |
| `~/public_html` | dowiązanie do katalogu głównej domeny | **nie wdrażać tam** — patrz ostrzeżenie niżej |

Do ustalenia przy powrocie:

- co znajduje się obecnie w katalogu głównej domeny (czy stoi tam działająca strona),
- czy założona jest subdomena pod aplikację, i jaki dokładnie katalog jej odpowiada.

## Hosting współdzielony z DirectAdmin i LiteSpeed

Układ katalogów `~/domains/DOMENA/public_html` oraz obecność katalogu `lscache` oznaczają
DirectAdmina na serwerze LiteSpeed. LiteSpeed czyta `.htaccess` tak samo jak Apache, więc
[`deploy/.htaccess`](../deploy/.htaccess) jest właściwym plikiem konfiguracyjnym.

### Nie wdrażaj do katalogu głównej strony

`~/public_html` jest zwykle dowiązaniem do katalogu głównej domeny. Wdrożenie tam **usunie stronę,
która już tam stoi** — rsync z `--delete` kasuje wszystko, czego nie ma w `dist/`.

Załóż subdomenę w DirectAdmin (np. `projekty.mikolajcar.pl`). Aplikacja dostaje własny katalog,
główna strona zostaje nietknięta, a certyfikat wyklikasz w panelu.

### Subdomena czy podkatalog — to nie jest to samo

DirectAdmin tworzy dla subdomeny katalog wewnątrz głównej domeny, zwykle
`~/domains/DOMENA/public_html/NAZWA`. Ten sam katalog jest więc dostępny pod dwoma adresami
i **każdy z nich wymaga innej konfiguracji**:

| Wejście | `VITE_BASE` | Dlaczego |
| --- | --- | --- |
| `projekty.mikolajcar.pl` | `/` (domyślnie) | katalog jest korzeniem subdomeny |
| `mikolajcar.pl/projekty` | `/projekty/` | zasoby leżą o poziom głębiej niż korzeń domeny |

Objaw pomyłki jest charakterystyczny: strona ładuje się jako biała, a w konsoli przeglądarki
widać błędy 404 przy plikach z `/assets/`.

### Certyfikat HTTPS

W DirectAdmin: **SSL Certificates → Free & automatic certificate from Let's Encrypt**. Zaznacz
subdomenę i włącz przekierowanie z HTTP. Bez HTTPS logowanie Supabase nie zadziała.

### Gdy brakuje rsync

Część hostingów współdzielonych nie ma `rsync`. Sprawdź:

```bash
which rsync
```

Jeśli komenda nic nie zwraca, w workflow zamień krok wysyłki na wariant FTP
(`SamKirkland/FTP-Deploy-Action`) albo na `scp`. Reszta workflow zostaje bez zmian.

## Automatyczne wdrażanie (GitHub Actions)

Workflow [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) po każdym wypchnięciu
do `main` buduje aplikację i wysyła ją na serwer. Można go też uruchomić ręcznie z zakładki
**Actions** — przydaje się po zmianie kluczy, gdy kod się nie zmienił.

Workflow przerywa wdrożenie, gdy: brakuje kluczy, klucz wygląda na `service_role`, lint nie
przechodzi albo konfiguracja nie trafiła do zbudowanego pliku. Lepiej, żeby zatrzymał się tutaj
niż żeby wdrożył aplikację, w której nikt się nie zaloguje.

### Krok 1 — klucz SSH dla wdrożeń

Osobny klucz wyłącznie do wdrażania, **bez hasła** (workflow nie ma go jak wpisać). Uruchom
u siebie:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_projekty -N "" -C "github-actions-projekty"
```

Część publiczną wgraj na serwer:

```bash
ssh-copy-id -i ~/.ssh/deploy_projekty.pub uzytkownik@twojadomena.pl
```

Odcisk klucza serwera (potrzebny, żeby wdrożenia nie dało się przekierować na podstawiony host):

```bash
ssh-keyscan -H twojadomena.pl
```

### Krok 2 — sekrety w repozytorium

**Settings → Secrets and variables → Actions → New repository secret.**

> Wpisujesz je bezpośrednio w GitHubie. Nie przesyłaj kluczy ani haseł przez czat — nie są mi
> potrzebne do niczego.

| Sekret | Skąd wziąć |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | tamże → `anon` `public` (**nigdy** `service_role`) |
| `SSH_PRIVATE_KEY` | zawartość `~/.ssh/deploy_projekty` (część **prywatna**, z liniami BEGIN/END) |
| `SSH_KNOWN_HOSTS` | wynik `ssh-keyscan -H twojadomena.pl` |
| `DEPLOY_HOST` | `twojadomena.pl` |
| `DEPLOY_USER` | użytkownik SSH |
| `DEPLOY_PATH` | katalog publiczny, np. `/var/www/projekty.dev/` |

W zakładce **Variables** (nie Secrets) opcjonalnie:

| Zmienna | Do czego |
| --- | --- |
| `PUBLIC_URL` | adres w podsumowaniu wdrożenia |
| `DEPLOY_PORT` | port SSH, jeśli inny niż 22 |
| `VITE_BASE` | gdy aplikacja stoi w podkatalogu, np. `/pm/` |

### Krok 3 — środowisko

Workflow używa środowiska `produkcja`. Utwórz je w **Settings → Environments**. Możesz tam włączyć
**Required reviewers**, jeśli chcesz, żeby wdrożenie czekało na Twoje kliknięcie zamiast ruszać
automatycznie po każdym pushu.

### Krok 4 — pierwsze uruchomienie

Actions → **Build i wdrożenie** → **Run workflow**. Jeśli coś jest nie tak, workflow zatrzyma się
z czytelnym komunikatem, zamiast wdrożyć uszkodzoną wersję.

## Czego to wdrożenie nie obejmuje

- **Środowiska testowego** obok produkcyjnego. Przy jednym zespole i jednym produkcie to zwykle
  przerost formy, ale gdy dojdzie więcej osób, osobna subdomena z osobnym projektem Supabase
  oszczędza nerwów.
- **Wycofania wdrożenia jednym kliknięciem.** Dziś powrót do poprzedniej wersji to ponowne
  uruchomienie starszego workflow albo `git revert` i push.
