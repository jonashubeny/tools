# tools
Here I store my tools.

## opravit-tagy.py

Opraví tagy mp3 (název, interpret, album, rok, žánr, číslo stopy) a vloží do nich cover alba.
Interpret a název bere z názvu souboru `Interpret - Název.mp3`, zbytek dohledá na Deezeru / iTunes.
Při prvním spuštění si sám nainstaluje `mutagen` do `.venv-tagy`.

```bash
./opravit-tagy.py                  # otaguj celou ~/Hudba
./opravit-tagy.py -n               # jen ukaž, co by se změnilo
./opravit-tagy.py -d ~/Stazene     # jiná složka s hudbou
./opravit-tagy.py -s faded         # jen jedna písnička (část názvu stačí)
./opravit-tagy.py -x "Alex G - *"  # tyhle soubory příště přeskoč
./opravit-tagy.py -f               # přetaguj i už hotové
```

Už otagované soubory (mají album i cover) se přeskakují. Seznam přeskakovaných je
v `opravit-tagy-preskocit.txt`. Po otagování v Clementine: Nástroje → Prohledat celou sbírku znovu.

## playlist-sync

Stáhne nové písničky ze Spotify playlistů jako mp3 (yt-dlp) a otaguje je včetně coveru.
Playlisty a cílová složka se nastavují v `playlist-sync/config.json`.
Podrobný popis je v [playlist-sync/README.md](playlist-sync/README.md).

```bash
node playlist-sync/playlist-sync.js             # stáhni nové písničky a otaguj je
node playlist-sync/playlist-sync.js --otagovat  # a otaguj i ručně přidané
node playlist-sync/playlist-sync.js -d ~/Hudba  # jen otaguj složku, nic nestahuj
node playlist-sync/playlist-sync.js --help      # všechny přepínače
```
