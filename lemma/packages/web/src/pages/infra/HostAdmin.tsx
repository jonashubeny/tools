import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../app/api';
import { useLabAdmin } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { useMe } from '../../app/queries';
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, SectionLabel } from '../../ui';
import { HostNotice } from './parts';

const mb = (bytes: number | null): string => (bytes === null ? '—' : `${Math.round(bytes / 1024 / 1024)} MB`);

/** For the administrator: what the lab host can do, what runs on it, and what it costs. */
export function HostAdmin() {
  const t = useT();
  const me = useMe();
  const admin = me.data?.account?.admin === true;
  const data = useLabAdmin(admin);
  const client = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  if (!admin) return <Empty title={t('Jen pro správce', 'For the administrator only')} />;
  if (data.isPending) return <Loading />;
  if (data.isError) return <ErrorNote error={data.error} retry={() => void data.refetch()} />;
  const d = data.data;
  const yes = (value: boolean | null): string => (value === null ? t('zjišťuje se', 'probing') : value ? t('ano', 'yes') : t('ne', 'no'));

  const run = async (name: string, call: () => Promise<unknown>): Promise<void> => {
    setBusy(name);
    try {
      await call();
      await client.invalidateQueries({ queryKey: ['infra', 'admin'] });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Správa', 'Administration')}
        title={t('Server laboratoří', 'Lab host')}
        actions={
          d.host.configured && (
            <Button onClick={() => void run('prepare', () => api.post('/api/admin/labs/prepare'))} busy={busy === 'prepare'}>
              <RefreshCw size={14} />
              {t('Znovu prověřit', 'Probe again')}
            </Button>
          )
        }
      />
      <HostNotice host={d.host} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 p-4 text-sm">
          <SectionLabel>{t('Schopnosti', 'Capabilities')}</SectionLabel>
          <div>{t('Engine', 'Engine')}: <span className="font-mono">{d.host.engine ?? '—'}</span></div>
          <div>systemd: {yes(d.host.capabilities.systemd)}</div>
          <div>{t('Víc uživatelských ID', 'Several user IDs')}: {yes(d.host.capabilities.multiUser)}</div>
          <div>{t('Privátní sítě', 'Private networks')}: {yes(d.host.capabilities.networks)}</div>
          <div>
            {t('Obrazy', 'Images')}: base <Badge>{d.host.images.base}</Badge> full <Badge>{d.host.images.full}</Badge>
          </div>
          {d.host.problems.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-2">
              {d.host.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-1 p-4 text-sm">
          <SectionLabel>{t('Limity', 'Limits')}</SectionLabel>
          {d.limits ? (
            Object.entries(d.limits).map(([key, value]) => (
              <div key={key} className="flex justify-between font-mono text-xs">
                <span>{key}</span>
                <span>{value}</span>
              </div>
            ))
          ) : (
            <div className="text-ink-3">—</div>
          )}
        </Card>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-2">
              <th className="px-4 py-2 font-medium">{t('Laboratoř', 'Lab')}</th>
              <th className="px-2 py-2 font-medium">{t('Účet', 'Account')}</th>
              <th className="px-2 py-2 font-medium">{t('Stav', 'Status')}</th>
              <th className="px-2 py-2 font-medium">{t('Stroje', 'Machines')}</th>
              <th className="px-2 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {d.labs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-3">
                  {t('Žádné laboratoře', 'No labs')}
                </td>
              </tr>
            )}
            {d.labs.map((lab) => (
              <tr key={lab.id} className="border-t border-border align-top">
                <td className="px-4 py-2">
                  <div>{lab.scenarioId}</div>
                  <div className="font-mono text-[11px] text-ink-3">{lab.id}</div>
                  {lab.detail && <div className="mt-1 max-w-md font-mono text-[11px] whitespace-pre-wrap text-ink-3">{lab.detail}</div>}
                </td>
                <td className="px-2 py-2 font-mono text-xs">{lab.owner}</td>
                <td className="px-2 py-2">
                  {lab.status}
                  {lab.error && <div className="text-xs text-ink-3">{lab.error}</div>}
                </td>
                <td className="px-2 py-2 font-mono text-xs">
                  {lab.machines.map((m) => (
                    <div key={m.name}>
                      {m.name}: {mb(m.memory)} RAM · {m.cpuPercent ?? '—'} % CPU · {mb(m.diskBytes)} {t('disk', 'disk')}
                    </div>
                  ))}
                </td>
                <td className="px-2 py-2 text-right">
                  {['provisioning', 'ready', 'busy', 'failed'].includes(lab.status) && (
                    <Button
                      size="sm"
                      variant="danger"
                      busy={busy === lab.id}
                      onClick={() =>
                        window.confirm(t('Ukončit tuto laboratoř?', 'End this lab?')) &&
                        void run(lab.id, () => api.delete(`/api/admin/labs/${encodeURIComponent(lab.id)}`))
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
