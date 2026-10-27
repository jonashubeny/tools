import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import path from "node:path";
import spotifyUrlInfo from "spotify-url-info";
import NodeID3 from "node-id3";

const spust = promisify(execFile);
const { getTracks } = spotifyUrlInfo(fetch);

const SLOZKA_SCRIPTU = import.meta.dirname;
const PLAYLIST_JSON = path.join(SLOZKA_SCRIPTU, "playlist.json");
const STAZENO_JSON = path.join(SLOZKA_SCRIPTU, "stazeno.json");

const configText = await readFile(path.join(SLOZKA_SCRIPTU, "config.json"), "utf8");
const config = JSON.parse(configText);
const SLOZKA_MP3 = config.slozka_mp3.replace(/^~/,homedir());

// pomocne funkce
async function nactiJSON(soubor, vychozi) {
    try {
        const text = await readFile(soubor, "utf8");
        return JSON.parse(text);
    } catch {
        return vychozi;
    }
}

async function ulozJson(soubor, data) {
    const text = JSON.stringify(data, null, 2);
    await writeFile(soubor, text, "utf8");
}

async function existuje(soubor) {
    try {
        await access(soubor);
        return true;
    } catch {
        return false;
    }
}

function jmenoSouboru(p) {
    const jmeno = `${p.interpret} - ${p.nazev}`;
    return jmeno.replace(/[\/\\:*?"<>|]/g, "_").trim();
}

// spotify vraci max 100 skladeb na playlist, proto jde zadat vic playlistu
// v config.playlist_url (jedna URL nebo pole URL) a skladby se spoji
async function nactiPlaylist() {
    const adresy = [config.playlist_url].flat();
    const vysledek = new Map();

    for (const adresa of adresy) {
        const skladby = await getTracks(adresa);
        if (skladby.length >= 100) {
            console.log(`Pozor: playlist ${adresa} má aspoň 100 skladeb, zbytek se nenačte. Rozděl ho.`);
        }

        const jenPisnicky = skladby.filter((s) => s.uri.startsWith("spotify:track"));

        for (const s of jenPisnicky) {
            const id = s.uri.split(":")[2];
            vysledek.set(id, {
                id,
                nazev: s.name,
                interpret: s.artist,
                delka: s.duration ? Math.round(s.duration / 1000) : null,
            });
        }
    }

    return [...vysledek.values()];
}

async function stahniMp3(p) {
    const jmeno = jmenoSouboru(p);
    const cilovySoubor = path.join(SLOZKA_MP3, `${jmeno}.mp3`);

    const argumenty = [
        `ytsearch1:${p.interpret} - ${p.nazev} audio`,
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "192K",
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "-o", path.join(SLOZKA_MP3, `${jmeno}.%(ext)s`),
    ];

    try {
        await spust("yt-dlp", argumenty);
    } catch (chyba) {
        console.log(`nepodarilo se stáhnout: ${chyba.message}`);
        return null;
    }

    if (await existuje(cilovySoubor)) {
        return `${jmeno}.mp3`
    }

    return null;
}

// ---------- tagy (prevzato z opravit-tagy.py) ----------
// dohleda skladbu na Deezeru (zaloha iTunes) a zapise nazev, interpreta, album,
// rok, zanr, cislo stopy/disku a cover alba

const UA = "playlist-sync/1.0";
const MIN_SHODA = 0.75;
const KOMPILACE = /\b(hits|now that|compilation|best of|greatest|top \d+|party|summer \d{4}|workout|playlist|various|mix \d{4}|karaoke|tribute)\b/i;

function pockej(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stahniJson(adresa, parametry) {
    if (parametry) {
        adresa += "?" + new URLSearchParams(parametry);
    }
    for (let pokus = 0; pokus < 3; pokus++) {
        try {
            const odpoved = await fetch(adresa, {
                headers: { "User-Agent": UA },
                signal: AbortSignal.timeout(15000),
            });
            const data = await odpoved.json();
            // Deezer vraci prekroceni kvoty jako error s kodem 4
            if (data?.error?.code === 4) {
                await pockej(5000);
                continue;
            }
            return data;
        } catch {
            await pockej(2000 * (pokus + 1));
        }
    }
    return null;
}

async function stahniObrazek(adresa) {
    try {
        const odpoved = await fetch(adresa, {
            headers: { "User-Agent": UA },
            signal: AbortSignal.timeout(20000),
        });
        if (!odpoved.ok) return null;
        return {
            data: Buffer.from(await odpoved.arrayBuffer()),
            mime: odpoved.headers.get("content-type")?.split(";")[0] || "image/jpeg",
        };
    } catch {
        return null;
    }
}

// porovnavani nazvu

function normalizuj(s) {
    s = s.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase();
    s = s.replaceAll("_", " ").replaceAll("&", " and ");
    s = s.replace(/[\(\[].*?(feat|ft\.|with|prod).*?[\)\]]/g, " ");
    s = s.replace(/\b(feat|ft)\.? .*/, " ");
    s = s.replace(/[^a-z0-9 ]+/g, " ");
    return s.replace(/\s+/g, " ").trim();
}

// pocet shodnych znaku jako v pythonim difflib.SequenceMatcher:
// najdi nejdelsi spolecny usek a totez opakuj vlevo a vpravo od nej
function pocetShod(a, b) {
    let delka = 0, ia = 0, ib = 0;
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < b.length; j++) {
            let k = 0;
            while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
            if (k > delka) {
                delka = k; ia = i; ib = j;
            }
        }
    }
    if (delka === 0) return 0;
    return delka
        + pocetShod(a.slice(0, ia), b.slice(0, ib))
        + pocetShod(a.slice(ia + delka), b.slice(ib + delka));
}

function podobnost(a, b) {
    a = normalizuj(a);
    b = normalizuj(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    let pomer = 2 * pocetShod(a, b) / (a.length + b.length);
    // jeden obsahuje druhy ("Dancin" vs "Dancin - Krono Remix")
    if (a.includes(b) || b.includes(a)) {
        const kratsi = Math.min(a.length, b.length);
        const delsi = Math.max(a.length, b.length);
        pomer = Math.max(pomer, 0.85 * kratsi / delsi + 0.15);
    }
    return pomer;
}

function rozdelInterprety(text) {
    return text.split(/\s*(?:,|&|\/|\bx\b|\bfeat\.?|\bft\.?|\band\b)\s*/i).filter(Boolean);
}

function slova(text) {
    return normalizuj(text).split(" ");
}

function shoda(kandidat, interpreti, nazev, delka) {
    const t = podobnost(nazev, kandidat.nazev);
    const jehoInterpreti = [kandidat.interpret, ...rozdelInterprety(kandidat.interpret)];
    let a = 0.5;
    if (interpreti.length > 0) {
        a = Math.max(...interpreti.flatMap((x) => jehoInterpreti.map((y) => podobnost(x, y))));
    }
    let s = 0.6 * t + 0.4 * a;
    if (delka && kandidat.delka) {
        const rozdil = Math.abs(delka - kandidat.delka);
        if (rozdil <= 3) s += 0.05;
        else if (rozdil > 20) s -= 0.1;
    }
    if (KOMPILACE.test(kandidat.album || "")) {
        s -= 0.12;
    }
    // remix/live/acoustic musi sedet s nazvem ze Spotify
    for (const slovo of ["remix", "live", "acoustic", "instrumental", "remaster", "version", "mix"]) {
        if (slova(nazev).includes(slovo) !== slova(kandidat.nazev).includes(slovo)) {
            s -= 0.15;
        }
    }
    return s;
}

// zdroje

function dotaz(interpreti, nazev) {
    return `${interpreti[0] ?? ""} ${nazev.replace(/[\(\[].*?[\)\]]/g, "")}`.trim();
}

async function hledejDeezer(interpreti, nazev) {
    const data = await stahniJson("https://api.deezer.com/search", { q: dotaz(interpreti, nazev), limit: 15 });
    return (data?.data ?? []).map((t) => ({
        zdroj: "deezer",
        id: t.id,
        nazev: t.title,
        interpret: t.artist.name,
        album: t.album.title,
        albumId: t.album.id,
        delka: t.duration,
        cover: t.album.cover_xl,
    }));
}

const albaDeezer = new Map();

async function detailDeezer(k) {
    const skladba = (await stahniJson(`https://api.deezer.com/track/${k.id}`)) ?? {};
    if (!albaDeezer.has(k.albumId)) {
        albaDeezer.set(k.albumId, (await stahniJson(`https://api.deezer.com/album/${k.albumId}`)) ?? {});
    }
    const album = albaDeezer.get(k.albumId);
    const interpreti = [...new Set((skladba.contributors ?? []).map((x) => x.name))];
    const zanry = (album.genres?.data ?? []).map((g) => g.name);
    return {
        nazev: skladba.title ?? k.nazev,
        interpret: interpreti.join(", ") || k.interpret,
        album: album.title ?? k.album,
        interpretAlba: album.artist?.name ?? k.interpret,
        datum: (skladba.release_date || album.release_date || "").slice(0, 10),
        zanr: zanry[0],
        stopa: skladba.track_position,
        stop: album.nb_tracks,
        disk: skladba.disk_number,
        cover: album.cover_xl || k.cover,
    };
}

let posledniITunes = 0;

async function hledejITunes(interpreti, nazev) {
    // iTunes povoluje cca 20 dotazu za minutu
    const cekej = 3200 - (Date.now() - posledniITunes);
    if (cekej > 0) await pockej(cekej);
    posledniITunes = Date.now();
    const data = await stahniJson("https://itunes.apple.com/search", {
        term: dotaz(interpreti, nazev), entity: "song", limit: 15,
    });
    return (data?.results ?? [])
        .filter((t) => t.kind === "song")
        .map((t) => ({
            zdroj: "itunes",
            nazev: t.trackName,
            interpret: t.artistName,
            album: t.collectionName ?? "",
            delka: t.trackTimeMillis ? t.trackTimeMillis / 1000 : null,
            surova: t,
        }));
}

function detailITunes(k) {
    const t = k.surova;
    const obrazek = t.artworkUrl100 ?? "";
    return {
        nazev: t.trackName,
        interpret: t.artistName,
        album: (t.collectionName ?? "").replace(/ - (EP|Single)$/, ""),
        interpretAlba: t.collectionArtistName || t.artistName,
        datum: (t.releaseDate ?? "").slice(0, 10),
        zanr: t.primaryGenreName,
        stopa: t.trackNumber,
        stop: t.trackCount,
        disk: t.discNumber,
        cover: obrazek ? obrazek.replace("100x100bb", "1000x1000bb") : null,
    };
}

async function dohledej(interpreti, nazev, delka) {
    let nejlepsi = null, nejlepsiShoda = 0;
    for (const hledej of [hledejDeezer, hledejITunes]) {
        const kandidati = await hledej(interpreti, nazev);
        for (const [i, k] of kandidati.entries()) {
            const s = shoda(k, interpreti, nazev, delka) - 0.005 * i;
            if (s > nejlepsiShoda) {
                nejlepsi = k;
                nejlepsiShoda = s;
            }
        }
        // kompilace ("Indie Hits" apod.) zkus jeste vylepsit v dalsim zdroji
        if (nejlepsiShoda >= MIN_SHODA && !KOMPILACE.test(nejlepsi.album)) break;
    }
    if (!nejlepsi || nejlepsiShoda < MIN_SHODA) {
        return { info: null, shoda: nejlepsiShoda, kandidat: nejlepsi };
    }
    const info = nejlepsi.zdroj === "deezer" ? await detailDeezer(nejlepsi) : detailITunes(nejlepsi);
    return { info, shoda: nejlepsiShoda, kandidat: nejlepsi };
}

// zapis

async function maDobreTagy(soubor) {
    try {
        const tagy = await NodeID3.Promise.read(soubor);
        return Boolean(tagy.album && tagy.image);
    } catch {
        return false;
    }
}

async function zapisTagy(soubor, info, cover) {
    const tagy = {
        title: info.nazev,
        artist: info.interpret,
        performerInfo: info.interpretAlba,
        album: info.album,
        year: info.datum ? info.datum.slice(0, 4) : undefined,
        genre: info.zanr,
        trackNumber: info.stopa ? String(info.stopa) + (info.stop ? `/${info.stop}` : "") : undefined,
        partOfSet: info.disk ? String(info.disk) : undefined,
    };
    if (cover) {
        tagy.image = {
            mime: cover.mime,
            type: { id: 3, name: "front cover" },
            description: "Cover",
            imageBuffer: cover.data,
        };
    }
    await NodeID3.Promise.update(tagy, soubor);
}

async function otaguj(soubor, p) {
    const interpreti = p.interpret.split(/, | & /).map((x) => x.trim()).filter(Boolean);
    let { info, shoda: s, kandidat } = await dohledej(interpreti, p.nazev, p.delka);

    if (!info) {
        const tip = kandidat ? ` (nejbližší: ${kandidat.interpret} - ${kandidat.nazev}, ${s.toFixed(2)})` : "";
        console.log(`    ✗ tagy nenalezeny${tip}`);
        info = { nazev: p.nazev, interpret: interpreti.join(", ") };
    } else {
        console.log(`    ✓ ${info.interpret} - ${info.nazev} | ${info.album} (${info.datum.slice(0, 4)}) [${kandidat.zdroj}, ${s.toFixed(2)}]`);
        // u vice interpretu je seznam ze Spotify casto uplnejsi
        if (interpreti.length > info.interpret.split(", ").length) {
            info.interpret = interpreti.join(", ");
        }
    }

    let cover = null;
    if (info.cover) {
        cover = await stahniObrazek(info.cover);
        if (!cover) console.log("    ! cover se nepodařilo stáhnout");
    }
    try {
        await zapisTagy(soubor, info, cover);
    } catch (chyba) {
        console.log(`    ! zápis tagů selhal: ${chyba.message}`);
    }
}

// hlavni program
// --otagovat: projde i dřív stažené písničky, které ještě nemají album a cover
const otagovatVse = process.argv.includes("--otagovat");

await mkdir(SLOZKA_MP3, {recursive: true});

const stazeno = await nactiJSON(STAZENO_JSON, {});

const playlist = await nactiPlaylist();
await ulozJson(PLAYLIST_JSON, playlist);
console.log(`Playlist má ${playlist.length} písniček, staženo je ${Object.keys(stazeno).length}.`);

const nove = playlist.filter((p) => !(p.id in stazeno));
console.log(`Nových písniček: ${nove.length}`);

let pocetStazenych = 0;

for (const [i, p] of nove.entries()) {
    const poradi = `[${i + 1}/${nove.length}]`;
    // pisnicka uz ve slozce je (treba stazena jinak), jen si ji zapiseme
    const jmeno = `${jmenoSouboru(p)}.mp3`;
    if (await existuje(path.join(SLOZKA_MP3, jmeno))) {
        console.log(`${poradi} Už existuje, přeskakuji: ${jmeno}`);
        stazeno[p.id] = jmeno;
        await ulozJson(STAZENO_JSON, stazeno);
        const soubor = path.join(SLOZKA_MP3, jmeno);
        if (!(await maDobreTagy(soubor))) {
            await otaguj(soubor, p);
        }
        continue;
    }

    console.log(`${poradi} Stahuji: ${p.interpret} - ${p.nazev}`);
    const soubor = await stahniMp3(p);
    if (soubor !== null) {
        stazeno[p.id] = soubor;
        await ulozJson(STAZENO_JSON, stazeno);
        pocetStazenych++;
        await otaguj(path.join(SLOZKA_MP3, soubor), p);
    }
}

if (otagovatVse) {
    const idNovych = new Set(nove.map((p) => p.id));
    const kOtagovani = [];
    for (const p of playlist) {
        if (idNovych.has(p.id) || !(p.id in stazeno)) continue;
        const soubor = path.join(SLOZKA_MP3, stazeno[p.id]);
        if ((await existuje(soubor)) && !(await maDobreTagy(soubor))) {
            kOtagovani.push({ soubor, p });
        }
    }
    console.log(`Starších písniček bez tagů: ${kOtagovani.length}`);
    for (const [i, { soubor, p }] of kOtagovani.entries()) {
        console.log(`[${i + 1}/${kOtagovani.length}] Taguji: ${path.basename(soubor)}`);
        await otaguj(soubor, p);
    }
}

console.log(`Hotovo. Nově staženo: ${pocetStazenych}`);