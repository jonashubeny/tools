import { Printer } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useGuide } from '../../app/infra-queries';
import { useT } from '../../app/i18n';
import { Markdown } from '../../app/Markdown';
import { Button, ErrorNote, Loading } from '../../ui';

/**
 * A study guide assembled from content the platform already holds and has checked. It is
 * laid out for printing; "Save as PDF" in the browser's print dialog makes the PDF, so no
 * text passes through anything else on the way.
 */
export function InfraGuide() {
  const t = useT();
  const [params] = useSearchParams();
  const guide = useGuide({ skill: params.get('skill') ?? undefined, scenario: params.get('scenario') ?? undefined });
  if (guide.isPending) return <Loading />;
  if (guide.isError) return <ErrorNote error={guide.error} retry={() => void guide.refetch()} />;
  const g = guide.data;
  return (
    <article className="guide mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <p className="text-sm text-ink-2">
          {t(
            'Pro PDF zvolte v tiskovém dialogu „Uložit jako PDF“.',
            'For a PDF, choose "Save as PDF" in the print dialog.',
          )}
        </p>
        <Button onClick={() => window.print()}>
          <Printer size={14} />
          {t('Tisk / PDF', 'Print / PDF')}
        </Button>
      </div>
      <header>
        <div className="mono-label">Lemma · {t('studijní materiál', 'study guide')}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t(g.title)}</h1>
        <div className="mt-1 text-xs text-ink-3">
          {t('Sestaveno', 'Assembled')} {new Date(g.generatedAt).toLocaleString(t.locale)}
        </div>
      </header>
      {g.sections.length === 0 && <p className="text-sm text-ink-2">{t('K tomuto tématu zatím nic není.', 'Nothing on this topic yet.')}</p>}
      {g.sections.map((section, n) => (
        <section key={n} className="break-inside-avoid-page space-y-2 border-t border-border pt-4">
          <h2 className="text-lg font-semibold">{t(section.title)}</h2>
          <Markdown text={t(section.body)} />
          <div className="font-mono text-[11px] text-ink-3">
            {section.source}
            {section.verifiedOn ? ` · ${t('ověřeno na', 'checked on')} ${section.verifiedOn}` : ''}
          </div>
        </section>
      ))}
      {g.links.length > 0 && (
        <section className="space-y-2 border-t border-border pt-4">
          <h2 className="text-lg font-semibold">{t('Oficiální dokumentace', 'Official documentation')}</h2>
          <ul className="space-y-1 text-sm">
            {g.links.map((link) => (
              <li key={link.url}>
                {t(link.title)} — <span className="break-all font-mono text-xs">{link.url}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
