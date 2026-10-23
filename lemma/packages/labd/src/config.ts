import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * labd's configuration, from the environment (see .env.example, section "Labs").
 * Every limit has a default that suits a small home server.
 */
export interface LabdConfig {
  host: string;
  port: number;
  /** Shared secret with the Lemma server; every API call must carry it. */
  token: string;
  /** The container engine's API socket (Docker, or Podman's compatible one). */
  engineSocket: string;
  stateDir: string;
  imagesDir: string;
  /** Names and labels of everything labd creates start with this. */
  prefix: string;
  maxLabs: number;
  maxLabsPerOwner: number;
  /** Sum of the memory of all running lab machines. */
  maxMemoryMb: number;
  /** Writable layer of one lab machine; a machine over it is stopped. */
  maxDiskMb: number;
  /** A lab is removed this long after it was created, however active. */
  maxLifetimeMinutes: number;
  /** Network mode for image builds ("" = the engine's default; "host" where bridges do not work). */
  buildNetwork: string;
  /** Build images for an engine that maps a single user ID: 'auto' probes. */
  singleUid: 'auto' | 'yes' | 'no';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const int = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadLabdConfig(env: NodeJS.ProcessEnv = process.env): LabdConfig {
  const token = env.LABD_TOKEN ?? '';
  if (token.length < 24) throw new Error('LABD_TOKEN must be set to at least 24 characters (the same value for lemma and labd)');
  const single = (env.LABD_SINGLE_UID ?? 'auto').toLowerCase();
  const level = (env.LOG_LEVEL ?? 'info').toLowerCase();
  return {
    host: env.LABD_HOST || '0.0.0.0',
    port: int(env.LABD_PORT, 7070, 1, 65535),
    token,
    engineSocket: env.LABD_ENGINE_SOCKET || '/var/run/docker.sock',
    stateDir: path.resolve(env.LABD_STATE_DIR || './data/labd'),
    // In the image the bundle sits next to images/; in development, next to src/.
    imagesDir: path.resolve(env.LABD_IMAGES_DIR || path.join(here, '..', 'images')),
    prefix: /^[a-z][a-z0-9-]{1,20}$/.test(env.LABD_PREFIX ?? '') ? env.LABD_PREFIX! : 'lemma-lab',
    maxLabs: int(env.LABD_MAX_LABS, 4, 1, 50),
    maxLabsPerOwner: int(env.LABD_MAX_LABS_PER_OWNER, 1, 1, 5),
    maxMemoryMb: int(env.LABD_MAX_MEMORY_MB, 2048, 128, 262_144),
    maxDiskMb: int(env.LABD_MAX_DISK_MB, 512, 64, 65_536),
    maxLifetimeMinutes: int(env.LABD_MAX_LIFETIME_MINUTES, 240, 15, 1440),
    buildNetwork: env.LABD_BUILD_NETWORK ?? '',
    singleUid: single === 'yes' || single === '1' || single === 'true' ? 'yes' : single === 'no' || single === '0' || single === 'false' ? 'no' : 'auto',
    logLevel: level === 'debug' || level === 'warn' || level === 'error' ? level : 'info',
  };
}
