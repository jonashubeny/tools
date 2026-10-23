import type { MeDto, ResourceDto } from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Upload } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { ApiFailure } from '../../app/api';
import { useInfraRoadmap, useResources } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { Markdown } from '../../app/Markdown';
import { useMe } from '../../app/queries';
import { Badge, Button, Card, ErrorNote, Field, Loading, PageHeader, Segmented, TextInput } from '../../ui';

const KIND: Record<ResourceDto['kind'], [string, string]> = {
  doc: ['dokument', 'document'],
  cheatsheet: ['tahák', 'cheat sheet'],
  checklist: ['postup', 'checklist'],
  link: ['oficiální dokumentace', 'official docs'],
  explainer: ['vysvětlení', 'explainer'],
  pdf: ['PDF', 'PDF'],
};

/** Everything to read, by topic: cheat sheets, checklists, official docs, uploaded PDF guides. */
export function InfraLibrary() {
  const t = useT();
  const resources = useResources();
  const roadmap = useInfraRoadmap();
  const me = useMe();
  const [filter, setFilter] = useState<'all' | 'written' | 'link' | 'pdf'>('all');

  const skillTitle = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of roadmap.data?.categories ?? []) for (const s of c.skills) map.set(s.skill.skill, t(s.skill.title));
    return map;
  }, [roadmap.data, t]);

  if (resources.isPending) return <Loading />;
  if (resources.isError) return <ErrorNote error={resources.error} retry={() => void resources.refetch()} />;
  const shown = resources.data.filter((r) =>
    filter === 'all' ? true : filter === 'written' ? r.body !== null : filter === 'link' ? r.kind === 'link' : r.kind === 'pdf',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Linux a infrastruktura', 'Linux & Infrastructure')}
        title={t('Knihovna', 'Library')}
        lead={t(
          'Odkazy vedou jen na oficiální dokumentaci; texty psané pro Lemmu uvádějí, na čem byly ověřeny.',
          'Links go to official documentation only; texts written for Lemma say what they were checked against.',
        )}
        actions={
          <Segmented
            label={t('Druh', 'Kind')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('Vše', 'All') },
              { value: 'written', label: t('Taháky', 'Sheets') },
              { value: 'link', label: t('Dokumentace', 'Docs') },
              { value: 'pdf', label: 'PDF' },
            ]}
          />
        }
      />
      {me.data?.account?.admin && <UploadForm me={me.data} />}
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((r) => (
          <Card key={r.id} id={r.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium">{t(r.title)}</div>
              <Badge>{t(KIND[r.kind][0], KIND[r.kind][1])}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {r.skills.map((s) => (
                <span key={s} className="text-xs text-ink-3">
                  {skillTitle.get(s) ?? s}
                </span>
              ))}
            </div>
            {r.body && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-accent-ink">{t('Zobrazit', 'Show')}</summary>
                <div className="mt-2">
                  <Markdown text={t(r.body)} />
                </div>
              </details>
            )}
            {r.url && (
              <a href={r.url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-sm">
                {r.kind === 'pdf' ? <FileText size={14} /> : <ExternalLink size={14} />}
                {r.kind === 'pdf' ? t('Otevřít PDF', 'Open the PDF') : new URL(r.url).host}
              </a>
            )}
            {r.verifiedOn && <div className="mt-2 font-mono text-[11px] text-ink-3">{r.verifiedOn}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

/** The administrator adds PDF guides for everybody; checked to be PDFs on the server. */
function UploadForm({ me: _me }: { me: MeDto }) {
  const t = useT();
  const client = useQueryClient();
  const [title, setTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('title', title);
      form.set('skills', skills);
      form.set('file', file);
      const response = await fetch('/api/admin/infra/files', { method: 'POST', body: form, credentials: 'same-origin' });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new ApiFailure(response.status, body.error ?? 'error', body.message ?? 'upload failed');
      }
      setTitle('');
      setFile(null);
      await client.invalidateQueries({ queryKey: ['infra', 'resources'] });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <Field label={t('Název PDF průvodce', 'Title of the PDF guide')}>
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
        </Field>
        <Field label={t('Dovednosti (id, čárkou)', 'Skills (ids, comma-separated)')} hint="linux.systemd, net.dns">
          <TextInput value={skills} onChange={(event) => setSkills(event.target.value)} />
        </Field>
        <input type="file" accept="application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="text-sm" />
        <Button type="submit" busy={busy} disabled={!file || title.trim() === ''}>
          <Upload size={14} />
          {t('Nahrát', 'Upload')}
        </Button>
      </form>
      {error !== null && (
        <div className="mt-3">
          <ErrorNote error={error} />
        </div>
      )}
    </Card>
  );
}
