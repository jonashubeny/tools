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
