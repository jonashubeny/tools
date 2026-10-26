import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import path from "node:path";
import spotifyUrlInfo from "spotify-url-info";

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

// hlavni program
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
        continue;
    }

    console.log(`${poradi} Stahuji: ${p.interpret} - ${p.nazev}`);
    const soubor = await stahniMp3(p);
    if (soubor !== null) {
        stazeno[p.id] = soubor;
        await ulozJson(STAZENO_JSON, stazeno);
        pocetStazenych++;
    }
}

console.log(`Hotovo. Nově staženo: ${pocetStazenych}`);