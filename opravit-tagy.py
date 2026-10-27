#!/usr/bin/env python3
"""Opraví ID3 tagy mp3 souborů a vloží do nich cover alba.

Interpret a název se berou z názvu souboru ("Interpret1, Interpret2 - Název.mp3"),
dohledají se na Deezeru (záloha iTunes) a zapíše se: název, interpret, interpret alba,
album, rok, žánr, číslo stopy/disku a cover (1000x1000).

Použití:
    opravit-tagy.py [-d SLOŽKA] [--dry-run] [--force] [--save-cover] [--min-score 0.75]
    opravit-tagy.py -s "Faded"              jen konkrétní písnička (vždy znovu)
    opravit-tagy.py -x "Soubor.mp3" ...     přidat do seznamu přeskakovaných

Bez -d zpracuje ~/Hudba (včetně podsložek). Soubory, které už mají album i cover,
přeskočí (pokud není --force), stejně jako soubory ze seznamu
opravit-tagy-preskocit.txt vedle skriptu. Nenalezené skladby vypíše na konci a dostanou
aspoň interpreta a název z názvu souboru.
"""
import argparse
import difflib
import fnmatch
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

VENV = Path(__file__).resolve().parent / ".venv-tagy"

try:
    import mutagen  # noqa: F401
except ImportError:
    # První spuštění: nainstaluj mutagen do vlastního venv a spusť se znovu v něm.
    py = VENV / "bin" / "python"
    if Path(sys.prefix).resolve() == VENV.resolve():
        sys.exit("mutagen se nepodařilo nainstalovat")
    if not py.exists():
        print(f"Instaluji mutagen do {VENV} ...", file=sys.stderr)
        subprocess.run([sys.executable, "-m", "venv", str(VENV)], check=True)
        subprocess.run([str(py), "-m", "pip", "install", "-q", "mutagen"], check=True)
    os.execv(str(py), [str(py), __file__, *sys.argv[1:]])

from mutagen.id3 import (APIC, ID3, ID3NoHeaderError, TALB, TCON, TDRC, TIT2,
                         TPE1, TPE2, TPOS, TRCK)
from mutagen.mp3 import MP3

UA = "opravit-tagy/1.0"
COMPILATION_WORDS = re.compile(
    r"\b(hits|now that|compilation|best of|greatest|top \d+|party|summer \d{4}|"
    r"workout|playlist|various|mix \d{4}|karaoke|tribute)\b", re.I)


# ---------- HTTP ----------

def get_json(url, params=None, retries=3):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.load(r)
            # Deezer vrací kvótu jako error s kódem 4
            if isinstance(data, dict) and data.get("error", {}).get("code") == 4:
                time.sleep(5)
                continue
            return data
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def get_bytes(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read(), r.headers.get_content_type()
    except Exception:
        return None, None


# ---------- název souboru a porovnávání ----------

def parse_filename(path):
    stem = path.stem
    if " - " in stem:
        artist_part, title = stem.split(" - ", 1)
    else:
        artist_part, title = "", stem
    artists = [a.strip() for a in artist_part.split(",") if a.strip()]
    return artists, title.strip()


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    s = s.replace("_", " ").replace("&", " and ")
    s = re.sub(r"[\(\[].*?(feat|ft\.|with|prod).*?[\)\]]", " ", s)
    s = re.sub(r"\b(feat|ft)\.? .*", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    # jeden obsahuje druhý ("Dancin" vs "Dancin - Krono Remix")
    if a in b or b in a:
        ratio = max(ratio, 0.85 * min(len(a), len(b)) / max(len(a), len(b)) + 0.15)
    return ratio


def score(cand, artists, title, duration):
    t = sim(title, cand["title"])
    cand_artists = [cand["artist"]] + re.split(r"\s*(?:,|&|/|\bx\b|\bfeat\.?|\bft\.?|\band\b)\s*",
                                               cand["artist"], flags=re.I)
    a = max((sim(x, y) for x in artists for y in cand_artists if y), default=0.5)
    s = 0.6 * t + 0.4 * a
    if duration and cand.get("duration"):
        diff = abs(duration - cand["duration"])
        s += 0.05 if diff <= 3 else (-0.1 if diff > 20 else 0)
    if COMPILATION_WORDS.search(cand.get("album", "")):
        s -= 0.12
    # remix/live/acoustic musí sedět s názvem souboru
    for word in ("remix", "live", "acoustic", "instrumental", "remaster", "version", "mix"):
        if (word in norm(title).split()) != (word in norm(cand["title"]).split()):
            s -= 0.15
    return s


# ---------- zdroje ----------

def deezer_search(artists, title):
    q = f"{artists[0] if artists else ''} {re.sub(r'[\(\[].*?[\)\]]', '', title)}"
    data = get_json("https://api.deezer.com/search", {"q": q.strip(), "limit": 15})
    out = []
    for t in (data or {}).get("data", []):
        out.append({
            "src": "deezer", "id": t["id"], "title": t["title"],
            "artist": t["artist"]["name"], "album": t["album"]["title"],
            "album_id": t["album"]["id"], "duration": t.get("duration"),
            "cover": t["album"].get("cover_xl"),
        })
    return out


_album_cache = {}


def deezer_details(c):
    track = get_json(f"https://api.deezer.com/track/{c['id']}") or {}
    aid = c["album_id"]
    if aid not in _album_cache:
        _album_cache[aid] = get_json(f"https://api.deezer.com/album/{aid}") or {}
    album = _album_cache[aid]
    contributors = list(dict.fromkeys(x["name"] for x in track.get("contributors", [])))
    genres = [g["name"] for g in album.get("genres", {}).get("data", [])]
    return {
        "title": track.get("title", c["title"]),
        "artist": ", ".join(contributors) or c["artist"],
        "album": album.get("title", c["album"]),
        "albumartist": album.get("artist", {}).get("name", c["artist"]),
        "date": (track.get("release_date") or album.get("release_date") or "")[:10],
        "genre": genres[0] if genres else None,
        "track": track.get("track_position"),
        "tracks": album.get("nb_tracks"),
        "disc": track.get("disk_number"),
        "cover": album.get("cover_xl") or c["cover"],
    }


_last_itunes = 0.0


def itunes_search(artists, title):
    global _last_itunes
    # iTunes povoluje cca 20 dotazů za minutu
    wait = 3.2 - (time.time() - _last_itunes)
    if wait > 0:
        time.sleep(wait)
    _last_itunes = time.time()
    q = f"{artists[0] if artists else ''} {re.sub(r'[\(\[].*?[\)\]]', '', title)}"
    data = get_json("https://itunes.apple.com/search",
                    {"term": q.strip(), "entity": "song", "limit": 15})
    out = []
    for t in (data or {}).get("results", []):
        if t.get("kind") != "song":
            continue
        out.append({
            "src": "itunes", "title": t["trackName"], "artist": t["artistName"],
            "album": t.get("collectionName", ""),
            "duration": (t.get("trackTimeMillis") or 0) / 1000 or None,
            "raw": t,
        })
    return out


def itunes_details(c):
    t = c["raw"]
    art = t.get("artworkUrl100", "")
    return {
        "title": t["trackName"],
        "artist": t["artistName"],
        "album": re.sub(r" - (EP|Single)$", "", t.get("collectionName", "")),
        "albumartist": t.get("collectionArtistName") or t["artistName"],
        "date": (t.get("releaseDate") or "")[:10],
        "genre": t.get("primaryGenreName"),
        "track": t.get("trackNumber"),
        "tracks": t.get("trackCount"),
        "disc": t.get("discNumber"),
        "cover": art.replace("100x100bb", "1000x1000bb") if art else None,
    }


def lookup(artists, title, duration, min_score):
    best, best_s = None, 0.0
    for search in (deezer_search, itunes_search):
        cands = search(artists, title)
        for i, c in enumerate(cands):
            s = score(c, artists, title, duration) - 0.005 * i
            if s > best_s:
                best, best_s = c, s
        # kompilace ("Indie Hits" apod.) zkus ještě vylepšit v dalším zdroji
        if best_s >= min_score and not COMPILATION_WORDS.search(best["album"]):
            break
    if not best or best_s < min_score:
        return None, best_s, best
    details = deezer_details(best) if best["src"] == "deezer" else itunes_details(best)
    return details, best_s, best


# ---------- zápis ----------

def has_good_tags(path):
    try:
        tags = ID3(path)
    except ID3NoHeaderError:
        return False
    return bool(tags.getall("TALB")) and bool(tags.getall("APIC"))


def write_tags(path, info, cover):
    try:
        tags = ID3(path)
    except ID3NoHeaderError:
        tags = ID3()
    for frame in ("TIT2", "TPE1", "TPE2", "TALB", "TDRC", "TCON", "TRCK", "TPOS", "APIC"):
        tags.delall(frame)
    tags.add(TIT2(encoding=3, text=info["title"]))
    tags.add(TPE1(encoding=3, text=info["artist"]))
    if info.get("albumartist"):
        tags.add(TPE2(encoding=3, text=info["albumartist"]))
    if info.get("album"):
        tags.add(TALB(encoding=3, text=info["album"]))
    if info.get("date"):
        tags.add(TDRC(encoding=3, text=info["date"]))
    if info.get("genre"):
        tags.add(TCON(encoding=3, text=info["genre"]))
    if info.get("track"):
        trck = str(info["track"]) + (f"/{info['tracks']}" if info.get("tracks") else "")
        tags.add(TRCK(encoding=3, text=trck))
    if info.get("disc"):
        tags.add(TPOS(encoding=3, text=str(info["disc"])))
    if cover:
        data, mime = cover
        tags.add(APIC(encoding=3, mime=mime or "image/jpeg", type=3, desc="Cover", data=data))
    tags.save(path, v2_version=3)


SKIP_FILE = Path(__file__).resolve().parent / "opravit-tagy-preskocit.txt"


def load_skip_list():
    if not SKIP_FILE.exists():
        return []
    lines = (l.strip() for l in SKIP_FILE.read_text(encoding="utf-8").splitlines())
    return [l for l in lines if l and not l.startswith("#")]


def add_to_skip_list(items):
    existing = set(load_skip_list())
    new = [Path(x).name if Path(x).expanduser().is_file() else x for x in items]
    new = [x for x in dict.fromkeys(new) if x not in existing]
    if not SKIP_FILE.exists():
        SKIP_FILE.write_text("# Soubory, které opravit-tagy.py přeskočí.\n"
                             "# Jeden název souboru nebo vzor (*, ?) na řádek.\n", encoding="utf-8")
    with SKIP_FILE.open("a", encoding="utf-8") as f:
        for x in new:
            f.write(x + "\n")
    for x in new:
        print(f"+ {x}")
    print(f"Přidáno {len(new)} položek do {SKIP_FILE}")


def is_skipped(path, patterns):
    return any(fnmatch.fnmatch(path.name, p) or fnmatch.fnmatch(str(path), p) for p in patterns)


def fold(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().casefold()


def pick_songs(queries, all_files):
    chosen = []
    for q in queries:
        p = Path(q).expanduser()
        if p.is_file():
            chosen.append(p)
            continue
        hits = [f for f in all_files if fold(q) in fold(f.stem)]
        if not hits:
            sys.exit(f"Žádná písnička neodpovídá: {q}")
        chosen.extend(hits)
    return list(dict.fromkeys(chosen))


class Progress:
    """Ukazatel na posledním řádku terminálu; ostatní výpis běží nad ním."""

    def __init__(self, total):
        self.total, self.done, self.start = total, 0, time.time()
        self.on = sys.stderr.isatty()

    def clear(self):
        if self.on:
            sys.stderr.write("\r\033[K")

    def print(self, *a):
        self.clear()
        print(*a, flush=True)
        self.draw()

    def step(self):
        self.done += 1
        self.draw()

    def draw(self):
        if not self.on:
            return
        width = 30
        frac = self.done / self.total if self.total else 1
        bar = "█" * int(frac * width) + "░" * (width - int(frac * width))
        eta = ""
        elapsed = time.time() - self.start
        if 0 < self.done < self.total:
            left = int(elapsed / self.done * (self.total - self.done))
            eta = f" · zbývá ~{left // 60}:{left % 60:02d}"
        sys.stderr.write(f"\r\033[K{bar} {frac:4.0%} {self.done}/{self.total}{eta}")
        sys.stderr.flush()

    def finish(self):
        self.clear()
        sys.stderr.flush()


def main():
    ap = argparse.ArgumentParser(
        description="Opraví tagy mp3 a stáhne covery alb.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""příklady:
  opravit-tagy.py                  otaguj celou ~/Hudba
  opravit-tagy.py -n               jen ukaž, co by se změnilo
  opravit-tagy.py -d ~/Stazene     jiná složka s hudbou
  opravit-tagy.py -s faded         jen jedna písnička (část názvu stačí)
  opravit-tagy.py -x "Alex G - *"  tyhle soubory příště přeskoč

seznam přeskakovaných: {SKIP_FILE}""")
    ap.add_argument("-d", "--dir", dest="dirs", action="append", metavar="SLOŽKA",
                    help="složka s hudbou (výchozí: ~/Hudba), lze zadat víckrát")
    ap.add_argument("extra_dirs", nargs="*", help=argparse.SUPPRESS)
    ap.add_argument("-s", "--pisnicka", action="append", metavar="NÁZEV",
                    help="zpracuj jen tuhle písničku (cesta k souboru nebo část názvu), "
                         "vždy znovu stáhne; lze zadat víckrát")
    ap.add_argument("-x", "--preskocit", nargs="+", metavar="SOUBOR",
                    help="přidej soubory (nebo vzory jako 'Alex G - *') do seznamu "
                         "přeskakovaných a skonči")
    ap.add_argument("-n", "--dry-run", action="store_true", help="jen vypiš, nic nezapisuj")
    ap.add_argument("-f", "--force", action="store_true", help="přepiš i už otagované soubory")
    ap.add_argument("--save-cover", action="store_true",
                    help="ulož cover i jako 'Soubor.jpg' vedle mp3")
    ap.add_argument("--min-score", type=float, default=0.75,
                    help="minimální shoda pro přijetí výsledku (0-1, výchozí 0.75)")
    args = ap.parse_args()

    if args.preskocit:
        add_to_skip_list(args.preskocit)
        return

    dirs = (args.dirs or []) + args.extra_dirs or ["~/Hudba"]
    for d in dirs:
        if not Path(d).expanduser().is_dir():
            sys.exit(f"Složka neexistuje: {d}")
    all_files = sorted(p for d in dirs for p in Path(d).expanduser().rglob("*.mp3"))

    ignored = 0
    if args.pisnicka:
        # konkrétní písničky: vždy znovu, seznam přeskakovaných neplatí
        files = pick_songs(args.pisnicka, all_files)
        force = True
    else:
        patterns = load_skip_list()
        files = [p for p in all_files if not is_skipped(p, patterns)]
        ignored = len(all_files) - len(files)
        force = args.force
    if not files:
        sys.exit("Žádné mp3 soubory.")

    done = skipped = 0
    missed = []
    bar = Progress(len(files))
    bar.draw()
    for i, path in enumerate(files, 1):
        prefix = f"[{i}/{len(files)}] {path.name}"
        if not force and has_good_tags(path):
            skipped += 1
            bar.step()
            continue
        artists, title = parse_filename(path)
        try:
            duration = MP3(path).info.length
        except Exception:
            duration = None

        info, s, cand = lookup(artists, title, duration, args.min_score)
        if not info:
            hint = f" (nejbližší: {cand['artist']} - {cand['title']}, {s:.2f})" if cand else ""
            bar.print(f"{prefix}\n    ✗ nenalezeno{hint}")
            missed.append(path.name)
            info = {"title": title, "artist": ", ".join(artists)}
        else:
            bar.print(f"{prefix}\n    ✓ {info['artist']} - {info['title']} | {info['album']}"
                      f" ({info['date'][:4]}) [{cand['src']}, {s:.2f}]")
            # u více interpretů ze jména souboru je seznam často úplnější
            if len(artists) > len(info["artist"].split(", ")):
                info["artist"] = ", ".join(artists)
            done += 1

        if args.dry_run:
            bar.step()
            continue
        cover = None
        if info.get("cover"):
            cover = get_bytes(info["cover"])
            if not cover[0]:
                cover = None
                bar.print("    ! cover se nepodařilo stáhnout")
        try:
            write_tags(path, info, cover)
        except Exception as e:
            bar.print(f"    ! zápis selhal: {e}")
            bar.step()
            continue
        if cover and args.save_cover:
            path.with_suffix(".jpg").write_bytes(cover[0])
        bar.step()
    bar.finish()

    print(f"\nHotovo: {done} nalezeno, {len(missed)} nenalezeno, "
          f"{skipped} už otagovaných, {ignored} na seznamu přeskakovaných.")
    if missed:
        print("Nenalezené (mají jen interpreta a název z názvu souboru):")
        for m in missed:
            print("  -", m)
        print("Nechceš je zkoušet znovu? Přidej je: opravit-tagy.py -x 'název souboru.mp3'")


if __name__ == "__main__":
    main()
