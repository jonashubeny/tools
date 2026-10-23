# Lemma: instalace krok za krokem (pro začátečníky)

Tenhle návod předpokládá, že nic z toho jsi ještě nedělal. Projde tě od čistého počítače
s Linuxem až k běžící Lemmě v prohlížeči. Pak volitelně zapneš i režim **Linux
a infrastruktura** s praktickými laboratořemi. Každý příkaz je tu celý, takže stačí ho
zkopírovat.

Podrobná anglická dokumentace je v [README.md](README.md). Jak laboratoře fungují uvnitř,
popisuje [docs/infra-labs.md](docs/infra-labs.md).

---

## Obsah

0. [Co budeš potřebovat](#0-co-budeš-potřebovat)
1. [Pár pojmů na začátek](#1-pár-pojmů-na-začátek)
2. [Nainstaluj Docker](#2-nainstaluj-docker)
3. [Stáhni Lemmu](#3-stáhni-lemmu)
4. [Nastav heslo (soubor .env)](#4-nastav-heslo-soubor-env)
5. [Spusť Lemmu](#5-spusť-lemmu)
6. [Otevři ji v prohlížeči](#6-otevři-ji-v-prohlížeči)
7. [První přihlášení, režimy a účty](#7-první-přihlášení-režimy-a-účty)
8. [Zapni Linuxové laboratoře](#8-zapni-linuxové-laboratoře-volitelné)
9. [Každodenní obsluha](#9-každodenní-obsluha)
10. [Když něco nefunguje](#10-když-něco-nefunguje)
11. [Přístup zvenku přes HTTPS](#11-přístup-zvenku-přes-https-volitelné)
12. [Odinstalace](#12-odinstalace)

---

## 0. Co budeš potřebovat

| Co | Kolik |
|---|---|
| Počítač nebo server | Linux na 64bitovém procesoru (x86-64). Ověřené distribuce jsou Debian 12, Ubuntu 22.04/24.04 a Fedora. Stačí i stará sestava, mini PC nebo VPS. |
| Paměť (RAM) | Pro samotnou Lemmu stačí 1 GB volné paměti. S laboratořemi počítej aspoň s 2 GB, pohodlně se 4 GB. Jedna běžící laboratoř zabere 200–400 MB. |
| Disk | Pro samotnou Lemmu 1 GB volného místa, s laboratořemi asi 3 GB. |
| Internet | Jen při instalaci a aktualizaci. Při běhu Lemma internet nepotřebuje. |
| Účet | Uživatel, který smí používat `sudo` (tedy spouštět příkazy jako správce). |

Celý postup trvá asi 15–30 minut, podle rychlosti internetu. Nejdéle trvá první sestavení.

> **Windows nebo macOS?** Lemma běží v linuxových kontejnerech. Na Windows to jde přes
> WSL 2 s Docker Desktopem a na macOS přes Docker Desktop, ale tenhle návod se drží
> Linuxu. Laboratoře potřebují plný Linux, na Docker Desktopu ověřené nejsou.

---

## 1. Pár pojmů na začátek

- **Terminál** je okno, do kterého píšeš příkazy. Na Ubuntu ho otevřeš klávesami
  `Ctrl+Alt+T`. Na server se připojíš přes `ssh uzivatel@adresa-serveru`.
- **Příkaz** v tomhle návodu vypadá takhle:
  ```sh
  echo ahoj
  ```
  Zkopíruj ho celý, vlož do terminálu (v terminálu se vkládá `Ctrl+Shift+V`) a stiskni Enter.
  Text za `#` je jen komentář a terminál ho ignoruje.
- **Docker** je program, který spouští **kontejnery**. Kontejner je zabalená aplikace se
  vším, co potřebuje ke svému běhu. Nemusíš tedy instalovat Node.js, databázi ani nic dalšího.
- **Docker Compose** spustí podle souboru `compose.yaml` několik kontejnerů najednou.
  Ovládáš ho příkazem `docker compose …`.
- **Soubor `.env`** obsahuje nastavení Lemmy, třeba heslo nebo port. Tečka na začátku
  jména znamená, že je soubor „skrytý“ a běžné `ls` ho nezobrazí (`ls -a` ano).
- **Port** je číslo „dveří“, na kterých aplikace poslouchá. Lemma používá port 8000, proto
  ji otevřeš na adrese `http://…:8000`.
- **Volume** (svazek) je místo, kam Docker ukládá data. Data Lemmy jsou ve svazku
  `lemma-data`, takže přežijí smazání i přestavění kontejneru.

---

## 2. Nainstaluj Docker

### Debian / Ubuntu

```sh
sudo apt update
sudo apt install -y ca-certificates curl git openssl
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Tohle je oficiální instalační skript Dockeru. Přidá repozitář Dockeru a nainstaluje
Docker Engine i plugin Compose.

Teď přidej sám sebe do skupiny `docker`, abys nemusel psát před každý příkaz `sudo`:

```sh
sudo usermod -aG docker "$USER"
```

Pak se **odhlas a znovu přihlas**. Na serveru stačí ukončit `ssh` a připojit se znovu.
Bez toho se změna neprojeví.

> Pozor: člen skupiny `docker` má na tom počítači prakticky práva roota. Na vlastním
> serveru je to v pořádku. Na sdíleném počítači to zvaž.

### Fedora

```sh
sudo dnf install -y dnf-plugins-core git openssl
sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Pak se taky odhlas a znovu přihlas.

### Ověř, že Docker funguje

```sh
docker run --rm hello-world
docker compose version
```

První příkaz má vypsat `Hello from Docker!`. Druhý vypíše verzi, třeba
`Docker Compose version v2.…` nebo novější. Jestli vidíš `permission denied`, odhlášení
a přihlášení ještě neproběhlo, nebo se nepovedlo (viz [kapitola 10](#10-když-něco-nefunguje)).

> **Podman místo Dockeru?** Jde to taky, s `podman-compose` místo `docker compose`.
> Pro laboratoře je dokonce bezpečnější (viz [8.6](#86-bezpečnější-varianta-rootless-podman)).
> Pro první instalaci ale doporučuju Docker, je to jednodušší.

---

## 3. Stáhni Lemmu

Lemma je ve složce `lemma` v repozitáři `tools`:

```sh
cd ~
git clone https://github.com/jonashubeny/tools.git
cd ~/tools/lemma
```

Všechny další příkazy spouštěj **v téhle složce**, tedy v té, kde je `compose.yaml`.
Kdykoli se do ní vrátíš příkazem `cd ~/tools/lemma`. Kde právě jsi, ti řekne `pwd`.

---

## 4. Nastav heslo (soubor .env)

Vytvoř si vlastní nastavení podle vzoru:

```sh
cp .env.example .env
nano .env
```

Otevře se editor `nano`. Najdi řádek

```
LEMMA_PASSWORD=
```

a dopiš za rovnítko heslo správce, aspoň 8 znaků:

```
LEMMA_PASSWORD=moje-tajne-heslo-123
```

- Použij jen **písmena, číslice, `-`, `_` a `.`**, bez mezer a bez `$`, `#` a uvozovek.
  Tyhle znaky mají v souboru `.env` zvláštní význam. Složitější heslo si nastavíš později
  přímo v aplikaci.
- Heslo se přečte **jen při prvním spuštění**. Pak je uložené v databázi a jeho změna
  v `.env` už nic neudělá. Mění se v aplikaci v Nastavení.

Ulož a zavři: `Ctrl+O`, Enter, `Ctrl+X`.

Ostatní volby můžeš zatím nechat, jak jsou. Každá je v `.env` popsaná komentářem.

---

## 5. Spusť Lemmu

```sh
docker compose up -d --build
```

- `up` znamená spustit, `-d` běžet na pozadí a `--build` nejdřív sestavit obraz aplikace.
- **Poprvé to trvá několik minut**, protože se stahuje asi 80 MB balíčků a aplikace se
  sestavuje. Další spuštění trvají sekundy.

Až příkaz doběhne, zkontroluj stav:

```sh
docker compose ps
```

Ve sloupci `STATUS` má být `Up … (healthy)`. Těsně po startu tam může být chvíli
`(health: starting)`, tak to zkus za 20 sekund znovu.

Výpis aplikace (log) zobrazíš příkazem:

```sh
docker compose logs -f
```

Výpis ukončíš `Ctrl+C`. Aplikace přitom běží dál.

---

## 6. Otevři ji v prohlížeči

**Na stejném počítači**, kde běží Docker, otevři <http://localhost:8000>.

**Z jiného zařízení** (Lemma běží na serveru a ty sedíš u notebooku): z bezpečnostních
důvodů je Lemma ve výchozím stavu vidět jen ze serveru samotného. Aby byla vidět
v domácí síti:

1. V `.env` změň `LEMMA_BIND=127.0.0.1` na `LEMMA_BIND=0.0.0.0` (příkaz `nano .env`).
2. Spusť znovu `docker compose up -d`.
3. Zjisti adresu serveru:
   ```sh
   hostname -I
   ```
   Vypíše něco jako `192.168.1.50 …`. Platí první číslo.
4. Na notebooku otevři `http://192.168.1.50:8000` s adresou, kterou ti vypsal server.

> Tímhle Lemmu otevřeš pro celou místní síť, ale jen přes nešifrované HTTP. Doma to
> většinou stačí. Do internetu ji takhle **nevystavuj** a použij radši
> [kapitolu 11](#11-přístup-zvenku-přes-https-volitelné).

---

## 7. První přihlášení, režimy a účty

1. **Přihlášení:** dokud existuje jen účet správce, zadáváš jen heslo z `.env`. Správce se
   jmenuje `admin`.
2. **Volba režimu:** po přihlášení vybereš **Matematika** nebo **Linux a infrastruktura**.
   Přepnout jde kdykoli tlačítkem nahoře v postranním panelu. Oba režimy sdílí účet, ale
   pokrok si vedou zvlášť.
3. **Změna hesla:** v **Nastavení** si nastav vlastní, klidně složité heslo.
4. **Další lidé:** v **Nastavení → Uživatelé** založíš účty kamarádům nebo studentům.
   Zadáš jméno (malá písmena, číslice, `.`, `-`, `_`) a první heslo, které jim předáš.
   Od té chvíle chce přihlašovací stránka i jméno. Každý účet má vlastní databázi a nikdo
   nevidí data ostatních.
5. **Učitel:** ve stejném panelu můžeš u účtu určit, kdo ho učí. Učitel pak v menu **Žáci**
   vidí práci svých žáků, včetně Linuxových laboratoří, a může jim zadávat úkoly.

---

## 8. Zapni Linuxové laboratoře (volitelné)

Režim **Linux a infrastruktura** se dá procházet i bez tohohle kroku (cesta, dovednosti,
knihovna). Aby šly **spouštět laboratoře**, tedy skutečné malé linuxové servery
s terminálem v prohlížeči, potřebuješ druhý kontejner **labd**.

### 8.1 Proč druhý kontejner

Laboratoře vytváří Docker. Kdo smí ovládat Docker, ten může na počítači skoro cokoli. Proto
tohle oprávnění nedostane webová aplikace, kam se přihlašují uživatelé. Dostane ho jen
malý oddělený pomocník **labd**:

- labd není vidět zvenku. Mluví s ním jen Lemma, a to se sdíleným tajným tokenem.
- labd umí jen pevně dané operace s předem připravenými scénáři: vytvořit, zkontrolovat,
  resetovat a smazat laboratoř. Nespustí libovolný příkaz od kohokoli.
- Laboratorní stroje nemají přístup k internetu a mají omezenou paměť, CPU, počet
  procesů i místo na disku. Po nečinnosti se samy smažou.

### 8.2 Vygeneruj token

```sh
openssl rand -hex 24
```

Vypíše 48 náhodných znaků, například `3f9a…c21e`. Zkopíruj si je.

### 8.3 Doplň `.env`

```sh
nano .env
```

Sjeď dolů k sekci `Linux & Infrastructure labs` a uprav tyhle dva řádky tak, že smažeš
`# ` na začátku a doplníš token:

```
LABD_URL=http://labd:7070
LABD_TOKEN=sem-vloz-svuj-token
```

Na konec souboru přidej ještě tenhle řádek:

```
COMPOSE_PROFILES=labs
```

Díky tomu bude `docker compose` zapínat, vypínat a aktualizovat labd vždy spolu s Lemmou
a nebudeš muset ke každému příkazu psát `--profile labs`.

S běžným Dockerem (nainstalovaným podle kapitoly 2) **nic dalšího nastavovat nemusíš**.
Výchozí hodnoty `LABD_ENGINE_SOCKET_HOST=/var/run/docker.sock` a `LABD_UID=0` jsou pro něj
správně.

Ulož (`Ctrl+O`, Enter, `Ctrl+X`).

### 8.4 Spusť

```sh
docker compose up -d --build
docker compose logs -f labd
```

Při **prvním** spuštění si labd sestaví obrazy laboratorních strojů (Debian 12 se
systemd, nginx, ssh, cron…). To trvá **5–15 minut** a stáhne asi 300 MB. Počkej, až se
v logu objeví řádek se zprávou `host prepared`. Ten vypíše i to, co tvůj počítač umí:

- `"engine"` s číslem verze: labd se dostal k Dockeru,
- `"systemd":true`: stroje mohou běžet se systemd,
- `"multiUser":true`: fungují stroje s více uživateli (nginx, cron, ssh),
- `"networks":true`: fungují laboratoře s více stroji a vlastní sítí,
- `"problems":[]`: prázdný seznam znamená, že je všechno v pořádku. Jinak tu bude
  napsáno, co chybí.

Na běžném Debianu nebo Ubuntu s Dockerem mají být všechny tři schopnosti `true`
a k dispozici je všech 12 laboratoří. Výpis zavři `Ctrl+C`.

### 8.5 Vyzkoušej

1. V Lemmě přepni na **Linux a infrastruktura**.
2. Jako správce otevři v menu **Správa → Server laboratoří**. Tam uvidíš, co server umí,
   kolik paměti laboratoře zabírají a které právě běží. Tlačítko **Znovu prověřit** zjistí
   schopnosti serveru znovu.
3. Na **Přehledu** nebo v **Cestě a dovednostech** vyber scénář, třeba *Plný disk*, a klikni na
   **Spustit laboratoř**. Za 10–30 sekund se otevře terminál.
4. Vpravo máš záložky **Úkol**, **Nápověda**, **Kontrola**, **Dokumenty** a **Poznámky**.
   Až budeš myslet, že je to opravené, klikni v záložce Kontrola na
   **Zkontrolovat řešení**.
5. Tlačítko **Ukončit** laboratoř smaže a pokus se uloží do historie.

**Ověření všech scénářů na tvém serveru** (volitelné, trvá pár minut, běžící laboratoře
neruší):

```sh
docker compose run --rm labd node labd.mjs selftest
```

U každého scénáře to vypíše `PASS` nebo `FAIL` (s popisem, co nesedí). Scénáře, které server
neumí, označí `SKIP` a uvede důvod. Čtyři scénáře (`nginx-bad-gateway`, `cron-backup-broken`, `ssh-hardening`
a `service-reachability`) se zatím nespouštěly na plném Docker hostu. Když u tebe projdou,
je to první skutečné ověření.

### 8.6 Bezpečnější varianta: rootless Podman

S běžným Dockerem běží laboratorní stroje přes démona, který má práva roota. Jsou silně
omezené, ale „root v laboratoři“ je pořád root s omezeními. S **rootless Podmanem** běží
všechno pod tvým obyčejným uživatelem, takže když se něco pokazí, škoda je menší. Je to
doporučená varianta pro server, na který se přihlašují i jiní lidé.

```sh
sudo apt install -y podman podman-compose      # Fedora: sudo dnf install -y podman podman-compose
systemctl --user enable --now podman.socket
sudo loginctl enable-linger "$USER"            # aby Podman běžel i po odhlášení
id -u                                          # vypíše tvoje UID, obvykle 1000
```

Do `.env` pak doplň (místo `1000` napiš svoje UID):

```
LABD_ENGINE_SOCKET_HOST=/run/user/1000/podman/podman.sock
LABD_UID=1000
LABD_GID=1000
```

V příkazech pak místo `docker compose` piš `podman-compose` a u spuštění přidej profil:

```sh
podman-compose --profile labs up -d --build
```

Pokud `podman info` hlásí `uidmap` o velikosti 1 nebo kontejnery nemají síť (typicky
neprivilegovaný LXC kontejner na Proxmoxu), přečti si v README kapitolu *Rootless Podman*.
Na takovém hostu jde spustit 8 z 12 laboratoří.

### 8.7 Limity

V `.env` je můžeš změnit (smaž `# ` na začátku řádku):

| Proměnná | Výchozí | Co dělá |
|---|---|---|
| `LABD_MAX_LABS` | 4 | kolik laboratoří může běžet najednou (všechny účty dohromady) |
| `LABD_MAX_LABS_PER_OWNER` | 1 | kolik jich může mít jeden účet |
| `LABD_MAX_MEMORY_MB` | 2048 | kolik paměti smí zabrat všechny laboratoře dohromady |
| `LABD_MAX_DISK_MB` | 512 | kolik smí jeden stroj zapsat na disk, než ho labd zastaví |
| `LABD_MAX_LIFETIME_MINUTES` | 240 | po jaké době se laboratoř smaže, i když se v ní pracuje |

Po změně spusť `docker compose up -d`.

---

## 9. Každodenní obsluha

Vždy ve složce `~/tools/lemma`:

| Co chceš | Příkaz |
|---|---|
| Zjistit, jestli běží | `docker compose ps` |
| Podívat se do logu | `docker compose logs -f` (konec: `Ctrl+C`) |
| Zastavit | `docker compose down` (data zůstanou) |
| Znovu spustit | `docker compose up -d` |
| Restartovat | `docker compose restart` |
| **Aktualizovat na novou verzi** | `git pull` a pak `docker compose up -d --build` |

- Po restartu počítače se Lemma spustí sama (`restart: unless-stopped`). Docker musí být
  zapnutý (`sudo systemctl enable docker` to zařídí, instalační skript to dělá sám).
- **Zálohy** si Lemma dělá sama jednou denně a nechává si posledních 14. Ven ze svazku si
  je zkopíruješ takhle:
  ```sh
  docker compose cp lemma:/data/backups ./lemma-zalohy
  ```
  Obnova ze zálohy a přesun na jiný počítač jsou popsané v README v kapitole *Your data*.
- Při aktualizaci se databáze před změnou struktury automaticky zazálohuje.
- Laboratorní stroje se nezálohují. Jsou jednorázové, nic si v nich neukládej. Historie
  pokusů a poznámky se ukládají do databáze účtu a zálohují se s ní.

---

## 10. Když něco nefunguje

| Příznak | Co s tím |
|---|---|
| `permission denied … docker.sock` | Nejsi ve skupině `docker`, nebo ses po `usermod` neodhlásil. Odhlas se a přihlas, ověř příkazem `groups` (musí tam být `docker`). |
| `docker: command not found` | Docker není nainstalovaný, vrať se ke [kapitole 2](#2-nainstaluj-docker). |
| `docker compose` hlásí `unknown command` | Chybí plugin Compose: `sudo apt install docker-compose-plugin`. |
| `npm error network … ETIMEDOUT` při sestavování | Výpadek sítě při stahování. Spusť příkaz znovu. Když chyba trvá: `docker build --network host -t lemma:local .` a pak `docker compose up -d --no-build`. |
| `port is already allocated` | Port 8000 už používá jiný program. V `.env` nastav třeba `LEMMA_PORT=8080` a otevírej `:8080`. |
| Z jiného počítače se stránka nenačte | Je v `.env` `LEMMA_BIND=0.0.0.0`? Spustil jsi pak `docker compose up -d`? Neblokuje port firewall? (`sudo ufw allow 8000/tcp`, pokud používáš ufw) |
| Přihlášení hlásí „cross-site“ nebo nefunguje za proxy | Viz [kapitola 11](#11-přístup-zvenku-přes-https-volitelné), `ALLOWED_ORIGINS`. |
| Zapomenuté heslo správce | Do `.env` dej nové `LEMMA_PASSWORD=…` a přidej řádek `LEMMA_PASSWORD_RESET=1`. Spusť `docker compose up -d`, přihlas se a **ten řádek zase smaž**. Heslo jiného uživatele nastaví správce v Nastavení → Uživatelé. |
| Linux: „Laboratoře nejsou zapnuté“ nebo „Služba laboratoří neodpovídá“ | Běží labd? `docker compose ps` musí ukázat i `labd`. Pokud ne, chybí `COMPOSE_PROFILES=labs` nebo `--profile labs`. Mají Lemma i labd stejný `LABD_TOKEN` (je jen jeden v `.env`, ale po změně je potřeba `docker compose up -d`)? |
| U scénáře je „Teď spustit nejde“ | labd ještě sestavuje obrazy (viz `docker compose logs -f labd`), nebo server danou schopnost nemá. Důvod uvidíš v Správa → Server laboratoří. |
| labd hlásí `LABD_TOKEN must be at least 24 characters` | Token je moc krátký. Vygeneruj nový přes `openssl rand -hex 24`. |
| labd nemůže k socketu (`EACCES`, `ENOENT`) | Docker: nech `LABD_UID=0`. Podman: běží `podman.socket` (`systemctl --user status podman.socket`) a sedí cesta i UID? |
| Laboratoř se nespustí, protože došla paměť | Zvyš RAM, nebo sniž `LABD_MAX_LABS`. Kolik se právě používá, ukáže Server laboratoří. |
| Obrazy laboratoří se nesestaví (síť) | Do `.env` přidej `LABD_BUILD_NETWORK=host` a spusť `docker compose restart labd`. |

Když nevíš, co se děje, začni vždy u `docker compose ps` a `docker compose logs --tail 100`.

---

## 11. Přístup zvenku přes HTTPS (volitelné)

Kvůli heslům by Lemma na internetu měla běžet jen přes **HTTPS**. Nejjednodušší cesty:

- **Tailscale** (soukromá síť jen pro tvoje zařízení, bez otevírání portů): na serveru
  nainstaluj Tailscale, přihlas se a spusť `tailscale serve --bg 8000`. Lemma pak běží na
  `https://<jmeno-serveru>.<tvuj-tailnet>.ts.net`.
- **Cloudflare Tunnel**: veřejná adresa bez otevírání portů. V Cloudflare nasměruj hostname
  na `http://localhost:8000`.
- **Caddy** (vlastní doména a otevřené porty 80 a 443):
  ```
  lemma.tvoje-domena.cz {
      reverse_proxy 127.0.0.1:8000
  }
  ```

Ve všech třech případech nastav v `.env`:

```
COOKIE_SECURE=1
TRUST_PROXY=1
LEMMA_BIND=127.0.0.1
```

a spusť `docker compose up -d`. Pokud se pak nejde přihlásit (chyba „cross-site“), dopiš
do `ALLOWED_ORIGINS` adresu z prohlížeče, třeba `ALLOWED_ORIGINS=https://lemma.tvoje-domena.cz`.

Terminál laboratoří používá WebSocket. Tailscale, Cloudflare Tunnel i Caddy ho přenášejí
samy. U nginxu je potřeba přidat `proxy_http_version 1.1`, `Upgrade` a `Connection`
hlavičky.

---

## 12. Odinstalace

```sh
cd ~/tools/lemma
docker compose down                 # zastaví a odstraní kontejnery, data zůstanou
docker compose down --volumes       # POZOR: smaže i všechna data a zálohy ve svazcích
docker image rm lemma:local lemma-labd:local
docker image ls 'lemma-lab-*'       # obrazy laboratorních strojů; smažeš je přes docker image rm
```

Než smažeš svazky, zkopíruj si zálohy ven (viz [kapitola 9](#9-každodenní-obsluha)).
