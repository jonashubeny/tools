import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ResourceDto } from '@lemma/core';
import { L } from '@lemma/core';
import { SCENARIO_BY_ID, SKILL_BY_ID } from '@lemma/labs';
import { type Db, fromJson, toJson } from '../../db';
import { badRequest, newId, notFound } from '../context';

/**
 * PDF study guides the administrator uploads, for everybody on the instance: the metadata
 * in the main database, the files in <data>/resources. A file is accepted only if it is a
 * PDF by its first bytes, whatever its name says, and it is served back with a fixed type
 * and as an attachment-safe download.
 */

export const MAX_PDF_BYTES = 20 * 1024 * 1024;

interface FileRow {
  id: string;
  title: string;
  filename: string;
  size: number;
  sha256: string;
  skills: string;
  scenarios: string;
  uploaded_by: string;
  uploaded_at: number;
}

export class FileStore {
  constructor(
    private readonly main: Db,
    private readonly dataDir: string,
    private readonly now: () => number,
  ) {}

  private dir(): string {
    return path.join(this.dataDir, 'resources');
  }

  list(): ResourceDto[] {
    const rows = this.main.prepare('SELECT * FROM infra_files ORDER BY uploaded_at DESC').all() as FileRow[];
    return rows.map((r) => ({
      id: `file:${r.id}`,
      kind: 'pdf',
      title: L(r.title, r.title),
      skills: fromJson(r.skills, []),
      scenarios: fromJson(r.scenarios, []),
      url: `/api/infra/files/${r.id}`,
      body: null,
      verifiedOn: null,
    }));
  }

  add(by: string, input: { title: unknown; filename: unknown; skills: unknown; scenarios: unknown; data: Buffer }): ResourceDto {
    const { data } = input;
    if (data.length === 0 || data.length > MAX_PDF_BYTES) throw badRequest(`a PDF of at most ${MAX_PDF_BYTES / 1024 / 1024} MB is required`);
    if (data.subarray(0, 5).toString('latin1') !== '%PDF-') throw badRequest('the file is not a PDF');
    const title = typeof input.title === 'string' ? input.title.trim().slice(0, 120) : '';
    if (title === '') throw badRequest('a title is required');
    const list = (value: unknown, known: (id: string) => boolean): string[] =>
      (Array.isArray(value) ? value : typeof value === 'string' && value ? value.split(',') : [])
        .filter((v): v is string => typeof v === 'string')
        .map((v) => v.trim())
        .filter(known)
        .slice(0, 20);
    const id = newId();
    fs.mkdirSync(this.dir(), { recursive: true });
    fs.writeFileSync(path.join(this.dir(), `${id}.pdf`), data, { mode: 0o640 });
    const filename = (typeof input.filename === 'string' ? input.filename : 'guide.pdf').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'guide.pdf';
    this.main
      .prepare(
        'INSERT INTO infra_files (id, title, filename, size, sha256, skills, scenarios, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        title,
        filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
        data.length,
        createHash('sha256').update(data).digest('hex'),
        toJson(list(input.skills, (s) => SKILL_BY_ID.has(s))),
        toJson(list(input.scenarios, (s) => SCENARIO_BY_ID.has(s))),
        by,
        this.now(),
      );
    return this.list().find((f) => f.id === `file:${id}`)!;
  }

  read(id: string): { filename: string; data: Buffer } {
    if (!/^[A-Za-z0-9_-]{6,24}$/.test(id)) throw notFound('file');
    const r = this.main.prepare('SELECT filename FROM infra_files WHERE id = ?').get(id) as { filename: string } | undefined;
    if (!r) throw notFound('file');
    return { filename: r.filename, data: fs.readFileSync(path.join(this.dir(), `${id}.pdf`)) };
  }

  remove(id: string): void {
    const changed = this.main.prepare('DELETE FROM infra_files WHERE id = ?').run(id).changes;
    if (changed === 0) throw notFound('file');
    fs.rmSync(path.join(this.dir(), `${id}.pdf`), { force: true });
  }
}
