import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import path from "node:path";
import spotifyUrlInfo from "spotify-url-info";

const spust = promisify(execFile);
const { getTracks } = spotifyUrlInfo(fetch);

