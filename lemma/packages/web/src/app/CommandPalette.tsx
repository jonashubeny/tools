import { CornerDownLeft, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '../lib/cn';
import { api } from './api';
import { useT } from './i18n';
import type { NavGroup } from './nav';
import { LAB_NAMES } from './labels';
import { useGraph } from './queries';

interface Command {
  id: string;
  title: string;
  hint: string;
  /** Extra text to match against (the other language, ids). */
  haystack: string;
  run: () => void | Promise<void>;
}

const fold = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Jump anywhere by typing: pages, concepts, Lab tools, and a few actions. */
export function CommandPalette({
  open,
  onClose,
  groups,
  entrance,
}: {
  open: boolean;
  onClose: () => void;
  /** The pages the sidebar offers this learner: the palette offers the same ones. */
  groups: NavGroup[];
  entrance: boolean;
}) {
  const t = useT();
  const navigate = useNavigate();
  const graph = useGraph();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      // Wait for the element to exist before focusing it.
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path);
    const page = (path: string, cs: string, en: string): Command => ({
      id: `page:${path}`,
      title: t(cs, en),
      hint: t('stránka', 'page'),
      haystack: `${cs} ${en}`,
      run: go(path),
    });
    const start = (id: string, cs: string, en: string, context: 'mixed' | 'adaptive'): Command => ({
      id,
      title: t(cs, en),
      hint: t('akce', 'action'),
      haystack: `${cs} ${en}`,
      run: async () => {
        const started = await api.post<{ run: { id: string } }>('/api/practice/start', { context });
        navigate(`/practice/${started.run.id}`);
      },
    });
    const out: Command[] = [
      ...groups.flatMap((group) => group.items.map((item) => page(item.to, item.label.cs, item.label.en))),
      page('/settings', 'Nastavení', 'Settings'),
      start('action:adaptive', 'Spustit adaptivní procvičování', 'Start adaptive practice', 'adaptive'),
      start('action:mixed', 'Spustit smíšené opakování', 'Start a mixed review', 'mixed'),
    ];
    // The Lab's tools are about functions: they belong to the school goal.
    for (const [tool, name] of entrance ? [] : Object.entries(LAB_NAMES)) {
      out.push({
        id: `lab:${tool}`,
        title: t(name),
        hint: t('laboratoř', 'lab'),
        haystack: `${name.cs} ${name.en} ${tool}`,
        run: go(`/lab/${tool}`),
      });
    }
    for (const skill of graph.data?.skills ?? []) {
      out.push({
        id: `concept:${skill.id}`,
        title: t(skill.title),
        hint: skill.topic !== null ? `${t('kapitola', 'topic')} ${skill.topic}` : t('pojem', 'concept'),
        haystack: `${skill.title.cs} ${skill.title.en} ${skill.id}`,
        run: go(`/concept/${skill.id}`),
      });
    }
    return out;
  }, [graph.data, navigate, t, groups, entrance]);

  const results = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return commands.slice(0, 12);
    return commands.filter((command) => words.every((word) => fold(command.haystack).includes(word))).slice(0, 40);
  }, [commands, query]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const run = (command: Command | undefined): void => {
    if (!command) return;
    onClose();
    void command.run();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('Hledat', 'Search')}
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border-strong bg-surface-1"
        style={{ boxShadow: 'var(--shadow)' }}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5">
          <Search size={16} className="text-ink-3" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setIndex((i) => Math.min(results.length - 1, i + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                run(results[index]);
              } else if (event.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t('Kam? Stránka, pojem, nástroj…', 'Where to? A page, a concept, a tool…')}
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[index] ? `palette-${index}` : undefined}
          />
        </div>
        <ul ref={list} id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-ink-3">{t('Nic nenalezeno.', 'Nothing found.')}</li>
          )}
          {results.map((command, i) => (
            <li key={command.id} id={`palette-${i}`} data-index={i} role="option" aria-selected={i === index}>
              <button
                type="button"
                onPointerMove={() => setIndex(i)}
                onClick={() => run(command)}
                className={cn(
                  'flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm',
                  i === index ? 'bg-surface-2 text-ink' : 'text-ink-2',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{command.title}</span>
                <span className="mono-label shrink-0">{command.hint}</span>
                {i === index && <CornerDownLeft size={13} className="shrink-0 text-ink-3" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
