import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { UserDto } from '@lemma/core';
import { expect } from 'vitest';
import { ensurePassword } from '../src/app';
import { type Harness, harness } from './helpers';

/**
 * Fictional learners for the tests of the learning engine live in src/dev/personas.ts,
 * where a demonstration instance can be seeded from them as well. This file adds what
 * only tests need: instances with several signed-in accounts.
 */
export * from '../src/dev/personas';

// -------------------------------------------------------------------- several accounts

const temporary: string[] = [];

/** Remove the data directories the tests of a file created. Call from afterEach. */
export function cleanUp(): void {
  for (const dir of temporary.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

export const ADMIN_PASSWORD = 'correct horse battery';

/** An instance with sign-in on and user databases on disk, in a directory of its own. */
export function instance(env: Record<string, string> = {}): Harness & { dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemma-teach-'));
  temporary.push(dir);
  const h = harness({ auth: true, env: { DATA_DIR: dir, ...env } });
  ensurePassword(h.db, h.config, h.now());
  return { ...h, dir };
}

const cookieOf = (headers: Headers): string => (headers.get('set-cookie') ?? '').split(';')[0]!;

export async function signIn(h: Harness, username: string | undefined, password: string): Promise<string> {
  const response = await h.send(
    'POST',
    '/api/auth/login',
    username === undefined ? { password } : { username, password },
  );
  expect(response.status).toBe(200);
  return cookieOf(response.headers);
}

export const asAdmin = (h: Harness): Promise<string> => signIn(h, undefined, ADMIN_PASSWORD);

export const passwordOf = (username: string): string => `${username} has a long password`;

/** Create a user and sign them in. Returns their session cookie. */
export async function createUser(h: Harness, admin: string, username: string): Promise<string> {
  const response = await h.send<UserDto>(
    'POST',
    '/api/admin/users',
    { username, password: passwordOf(username) },
    { Cookie: admin },
  );
  expect(response.status).toBe(200);
  return signIn(h, username, passwordOf(username));
}

export async function setTeachers(h: Harness, admin: string, student: string, teachers: string[]): Promise<UserDto> {
  const response = await h.send<UserDto>('PUT', `/api/admin/users/${student}`, { teachers }, { Cookie: admin });
  expect(response.status).toBe(200);
  return response.body;
}
