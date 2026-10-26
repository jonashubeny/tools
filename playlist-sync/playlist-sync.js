import { readFile, writeFile, mkdir, access, rename, unlink, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import spotifyUrlInfo from "spotify-url-info";

const spust = promisify(execFile);
const { getTracks } = spotifyUrlInfo(fetch);

const SLOZKA_SCRIPTU = import.meta.dirname;
const PLAYLIST_JSON = path.join(SLOZKA_SCRIPTU, "playlist.json");
const STAZENO_JSON = path.join(SLOZKA_SCRIPTU, "stazeno.json");

const configText = await readFile(path.join(SLOZKA_SCRIPTU, "config.json"), "utf8");
const config = JSON.parse(configText);
const SLOZKA_MP3 = config.slozka_mp3.replace(/^~/, homedir());

// prepinace: --retag = jen pretagovat existujici soubory, --dry-run = nic nezapisovat
const ARGUMENTY = process.argv.slice(2);
const RETAG = ARGUMENTY.includes("--retag");
const DRY_RUN = ARGUMENTY.includes("--dry-run");

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

const pockej = (ms) => new Promise((hotovo) => setTimeout(hotovo, ms));

function normalizuj(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function prvniInterpret(interpret) {
  return interpret.split(",")[0].trim();
}

// "Dancin (feat. Luvli) - Krono Remix" -> "Dancin", jen jako zalozni dotaz
function ocistiNazev(nazev) {
  return nazev
    .replace(/\s*[\(\[].*?[\)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
}

// "Interpret - Nazev.mp3" -> { interpret, nazev }, pro soubory mimo stazeno.json
function zJmenaSouboru(jmeno) {
  const bezPripony = jmeno.replace(/\.mp3$/i, "");
  const oddelovac = bezPripony.indexOf(" - ");
  if (oddelovac === -1) return { id: bezPripony, interpret: "", nazev: bezPripony };
  return {
    id: bezPripony,
    interpret: bezPripony.slice(0, oddelovac).trim(),
    nazev: bezPripony.slice(oddelovac + 3).trim(),
  };
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

// metadata z Deezeru (album, interpret alba, rok, obal)

async function deezer(url) {
  await pockej(150); // Deezer povoluje cca 50 pozadavku za 5 s
  const odpoved = await fetch(url);
  if (!odpoved.ok) throw new Error(`Deezer vrátil ${odpoved.status}`);
  const data = await odpoved.json();
  if (data.error) throw new Error(`Deezer: ${data.error.message}`);
  return data;
}

async function hledejNaDeezeru(p) {
  const interpret = prvniInterpret(p.interpret);
  const cistyNazev = ocistiNazev(p.nazev);
  const dotazy = [
    `artist:"${interpret}" track:"${p.nazev}"`,
    `artist:"${interpret}" track:"${cistyNazev}"`,
    `${interpret} ${cistyNazev}`,
  ];

  for (const dotaz of dotazy) {
    const data = await deezer(`https://api.deezer.com/search?q=${encodeURIComponent(dotaz)}&limit=5`);
    // vezmeme prvni vysledek, kde sedi interpret (at nam to neprihodi cover verzi od nekoho jineho)
    const shoda = (data.data ?? []).find((t) => {
      const nalezeny = normalizuj(t.artist.name);
      const hledany = normalizuj(interpret);
      if (!hledany) return true;
      return nalezeny.includes(hledany) || hledany.includes(nalezeny);
    });
    if (shoda) return shoda;
  }
  return null;
}

const albaCache = new Map();

async function nactiMetadata(p) {
  const skladba = await hledejNaDeezeru(p);
  if (!skladba) return null;

  let album = albaCache.get(skladba.album.id);
  if (!album) {
    album = await deezer(`https://api.deezer.com/album/${skladba.album.id}`);
    albaCache.set(skladba.album.id, album);
  }

  return {
    album: album.title,
    interpretAlba: album.artist?.name ?? prvniInterpret(p.interpret),
    rok: album.release_date?.slice(0, 4) ?? "",
    obal: album.cover_xl || skladba.album.cover_xl || null,
  };
}

// zapis tagu + obalu pres ffmpeg (stare tagy vcetne "playlist" se smazou)
async function zapisTagy(soubor, p, meta) {
  const docasny = soubor.replace(/\.mp3$/i, ".tagovani.mp3");
  const argumenty = ["-y", "-loglevel", "error", "-i", soubor];

  let obalSoubor = null;
  if (meta?.obal) {
    try {
      const odpoved = await fetch(meta.obal);
      if (odpoved.ok) {
        obalSoubor = path.join(tmpdir(), `obal-${normalizuj(p.id) || "x"}.jpg`);
        await writeFile(obalSoubor, Buffer.from(await odpoved.arrayBuffer()));
        argumenty.push("-i", obalSoubor);
      }
    } catch {
      obalSoubor = null; // bez obalu, ale tagy zapiseme
    }
  }

  argumenty.push("-map", "0:a");
  if (obalSoubor) {
    argumenty.push(
      "-map", "1:v",
      "-disposition:v", "attached_pic",
      "-metadata:s:v", "title=Album cover",
      "-metadata:s:v", "comment=Cover (front)",
    );
  }

  argumenty.push("-c", "copy", "-map_metadata", "-1", "-id3v2_version", "3");
  argumenty.push("-metadata", `title=${p.nazev}`);
  if (p.interpret) argumenty.push("-metadata", `artist=${p.interpret}`);
  if (meta) {
    argumenty.push("-metadata", `album=${meta.album}`);
    argumenty.push("-metadata", `album_artist=${meta.interpretAlba}`);
    if (meta.rok) argumenty.push("-metadata", `date=${meta.rok}`);
  }
  argumenty.push(docasny);

  try {
    await spust("ffmpeg", argumenty);
    await rename(docasny, soubor);
  } catch (chyba) {
    await unlink(docasny).catch(() => {});
    throw chyba;
  } finally {
    if (obalSoubor) await unlink(obalSoubor).catch(() => {});
  }
}

async function otagujSoubor(soubor, p) {
  let meta = null;
  try {
    meta = await nactiMetadata(p);
  } catch (chyba) {
    console.log(`  metadata se nepodařilo načíst: ${chyba.message}`);
  }

  const popis = meta ? `${meta.album} (${meta.rok || "?"})${meta.obal ? "" : ", bez obalu"}` : "album nenalezeno";
  console.log(`  → ${popis}`);

  if (!DRY_RUN) {
    try {
      await zapisTagy(soubor, p, meta);
    } catch (chyba) {
      console.log(`  zápis tagů selhal: ${chyba.message}`);
      return false;
    }
  }
  return meta !== null;
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
    return `${jmeno}.mp3`;
  }
  return null;
}

// rezim --retag: projde vsechny mp3 ve slozce a doplni jim tagy a obal

async function pretagujVse() {
  const stazeno = await nactiJSON(STAZENO_JSON, {});
  const playlist = await nactiJSON(PLAYLIST_JSON, []);
  const podleId = new Map(playlist.map((p) => [p.id, p]));

  // soubor -> data ze Spotify (pokud ho mame ve stazeno.json)
  const podleSouboru = new Map();
  for (const [id, jmeno] of Object.entries(stazeno)) {
    if (podleId.has(id)) podleSouboru.set(jmeno, podleId.get(id));
  }

  const soubory = (await readdir(SLOZKA_MP3))
    .filter((s) => s.toLowerCase().endsWith(".mp3") && !s.includes(".tagovani."))
    .sort();

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Přetagovávám ${soubory.length} souborů ve ${SLOZKA_MP3}`);

  const nenalezeno = [];
  for (const [i, jmeno] of soubory.entries()) {
    console.log(`[${i + 1}/${soubory.length}] ${jmeno}`);
    const p = podleSouboru.get(jmeno) ?? zJmenaSouboru(jmeno);
    const ok = await otagujSoubor(path.join(SLOZKA_MP3, jmeno), p);
    if (!ok) nenalezeno.push(jmeno);
  }

  console.log(`Hotovo. Album se nenašlo u ${nenalezeno.length} souborů:`);
  for (const jmeno of nenalezeno) console.log(`  - ${jmeno}`);
}

// bezne stahovani

async function stahujNove() {
  await mkdir(SLOZKA_MP3, { recursive: true });

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
      await otagujSoubor(path.join(SLOZKA_MP3, soubor), p);
      stazeno[p.id] = soubor;
      await ulozJson(STAZENO_JSON, stazeno);
      pocetStazenych++;
    }
  }

  console.log(`Hotovo. Nově staženo: ${pocetStazenych}`);
}

// hlavni program

if (RETAG) {
  await pretagujVse();
} else {
  await stahujNove();
}