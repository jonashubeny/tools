import { AREAS, type Area, type SkillDto, ancestorsOf, layoutGraph } from '@lemma/core';
import { Clock, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '../app/i18n';
import { AREA_NAMES, LEVEL_MEANING, LEVEL_NAMES, TRACK_NAMES, TRACK_NOTES } from '../app/labels';
import { useGraph } from '../app/queries';
import { cn } from '../lib/cn';
import { RichText } from '../lib/Math';
import { Badge, Card, ErrorNote, IconButton, LinkButton, Loading, PageHeader, Segmented } from '../ui';
import { LevelBar } from '../viz/charts';

const NODE_W = 158;
const NODE_H = 60;
/** One node per line in a lane: the tree grows downwards, which a page can scroll. */
const OPTIONS = {
  nodeWidth: NODE_W,
  nodeHeight: NODE_H,
  gapX: 12,
  gapY: 34,
  rowGap: 8,
  laneGap: 22,
  laneOrder: AREAS,
  maxPerRow: 1,
};
const HEADER = 30;

type Scope = 'school' | 'with-foundations' | 'all';

/**
 * The knowledge graph: what stands on what. Prerequisites sit above the things that need
 * them; columns are areas of mathematics. Selecting a node lights up everything it rests on.
 */
export function Tree() {
  const t = useT();
  const graph = useGraph();
  const [scope, setScope] = useState<Scope>('with-foundations');
  const [selected, setSelected] = useState<string | null>(null);

  const skills = useMemo(() => {
    const all = graph.data?.skills ?? [];
    if (scope === 'all') return all;
    if (scope === 'school') return all.filter((skill) => skill.track === 'school');
    return all.filter((skill) => skill.track === 'school' || skill.track === 'foundation');
  }, [graph.data, scope]);

  const layout = useMemo(
    () =>
      layoutGraph(
        skills.map((skill) => ({ id: skill.id, prereqs: skill.prereqs, lane: skill.area })),
        OPTIONS,
      ),
    [skills],
  );
  const byId = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const position = useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout]);

  // Draw the graph's transitive reduction: an arrow A → C says nothing new when A → B → C
  // is already drawn, and leaving it out is what keeps the picture legible.
  const edges = useMemo(() => {
    const nodes = skills.map((skill) => ({ id: skill.id, prereqs: skill.prereqs.filter((id) => byId.has(id)) }));
    const above = new Map(nodes.map((node) => [node.id, ancestorsOf(nodes, node.id)]));
    return nodes.flatMap((node) =>
      node.prereqs
        .filter((pre) => !node.prereqs.some((other) => other !== pre && above.get(other)?.has(pre)))
        .map((pre) => ({ from: pre, to: node.id })),
    );
  }, [skills, byId]);

  const lit = useMemo(() => {
    if (!selected) return null;
    const up = ancestorsOf(
      skills.map((skill) => ({ id: skill.id, prereqs: skill.prereqs })),
      selected,
    );
    const down = new Set(skills.filter((skill) => skill.prereqs.includes(selected)).map((skill) => skill.id));
    return { up, down };
  }, [selected, skills]);

  if (graph.isPending) return <Loading />;
  if (graph.isError) return <ErrorNote error={graph.error} retry={() => void graph.refetch()} />;

  const current = selected ? byId.get(selected) : undefined;
  const isLit = (id: string): boolean => !lit || id === selected || lit.up.has(id) || lit.down.has(id);
  // Ready: everything it stands on is at least familiar, and it has not been started.
  const isReady = (skill: SkillDto): boolean =>
    skill.level === 0 && skill.hasProblems && skill.prereqs.every((id) => (byId.get(id)?.level ?? 3) >= 3);

  return (
    <div>
      <PageHeader
        title={t('Strom dovedností', 'Skill tree')}
        lead={t(
          'Co na čem stojí. Nahoře základy, pod nimi to, co je potřebuje; sloupce jsou oblasti matematiky. Kliknutím na pojem se zvýrazní všechno, o co se opírá.',
          'What stands on what. Foundations on top, what needs them below; the columns are areas of mathematics. Click a concept to light up everything it rests on.',
        )}
        actions={
          <Segmented
            label={t('Rozsah', 'Scope')}
            value={scope}
            onChange={(next) => {
              setScope(next);
              setSelected(null);
            }}
            options={[
              { value: 'school', label: t('Jen osnovy', 'Syllabus only') },
              { value: 'with-foundations', label: t('+ základy', '+ foundations') },
              { value: 'all', label: t('+ rozšíření', '+ enrichment') },
            ]}
          />
        }
      />

      <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {([0, 1, 2, 3, 4, 5] as const).map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <LevelBar level={level} size="sm" />
            {t(LEVEL_NAMES[level])}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-6 rounded border border-dashed border-border-strong" aria-hidden />
          {t('zatím bez úloh', 'no problems yet')}
        </li>
        <li className="flex items-center gap-1.5">
          <Clock size={12} aria-hidden />
          {t('čas na opakování', 'time to review')}
        </li>
        <li>
          <span className="font-mono text-ink-3">3</span> = {t('kapitola osnov', 'syllabus chapter')}
        </li>
      </ul>

      <Card className="mb-4 flex min-h-[76px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        {current ? (
          <>
            <div className="min-w-0 flex-1 basis-72">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{t(current.title)}</span>
                <Badge tone={current.track === 'school' ? 'accent' : 'outline'} title={t(TRACK_NOTES[current.track])}>
                  {t(TRACK_NAMES[current.track])}
                </Badge>
              </div>
              <div className="mt-0.5 text-sm text-ink-2">
                <RichText text={t(current.summary)} inlineOnly />
              </div>
            </div>
            <div className="shrink-0 text-[13px] text-ink-2">
              <LevelBar level={current.level} showName />
              <div className="mt-0.5 max-w-64 text-xs text-ink-3">{t(LEVEL_MEANING[current.level])}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <LinkButton to={`/concept/${current.id}`} variant="primary" size="sm">
                {t('Otevřít pojem', 'Open the concept')}
              </LinkButton>
              <IconButton label={t('Zrušit výběr', 'Clear the selection')} onClick={() => setSelected(null)}>
                <X size={15} />
              </IconButton>
            </div>
          </>
        ) : (
          <span className="text-sm text-ink-3">
            {t(
              'Vyber pojem ve stromu: uvidíš, na čem stojí a co na něm stojí dál.',
              'Pick a concept in the tree to see what it stands on and what builds on it.',
            )}
          </span>
        )}
      </Card>

      <Card className="overflow-x-auto p-4">
        <div className="relative mx-auto" style={{ width: layout.width, height: layout.height + HEADER }}>
          {layout.lanes.map((lane) => (
            <div
              key={lane.id}
              className="mono-label absolute top-0 truncate text-center"
              style={{ left: lane.x, width: lane.width }}
              title={t(AREA_NAMES[lane.id as Area])}
            >
              {t(AREA_NAMES[lane.id as Area])}
            </div>
          ))}
          <svg
            width={layout.width}
            height={layout.height}
            className="absolute left-0"
            style={{ top: HEADER }}
            aria-hidden
          >
            {edges.map((edge) => {
              const from = position.get(edge.from);
              const to = position.get(edge.to);
              if (!from || !to) return null;
              const x1 = from.x + NODE_W / 2;
              const y1 = from.y + NODE_H;
              const x2 = to.x + NODE_W / 2;
              const y2 = to.y;
              const bend = Math.max(18, (y2 - y1) / 2);
              const on =
                lit !== null &&
                (((edge.to === selected || lit.up.has(edge.to)) && lit.up.has(edge.from)) ||
                  (edge.from === selected && lit.down.has(edge.to)));
              return (
                <path
                  key={`${edge.from}>${edge.to}`}
                  d={`M${x1},${y1}C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`}
                  fill="none"
                  stroke={on ? 'var(--accent)' : 'var(--axis)'}
                  strokeWidth={on ? 2 : 1}
                  opacity={lit ? (on ? 1 : 0.18) : 0.75}
                />
              );
            })}
          </svg>
          {layout.nodes.map((node) => {
            const skill = byId.get(node.id)!;
            const active = node.id === selected;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelected(active ? null : node.id)}
                aria-pressed={active}
                title={t(skill.title)}
                aria-label={`${t(skill.title)}, ${t('úroveň', 'level')} ${skill.level}/5 ${t(LEVEL_NAMES[skill.level])}${skill.prereqs.length > 0 ? `; ${t('stojí na', 'stands on')}: ${skill.prereqs.map((id) => (byId.get(id) ? t(byId.get(id)!.title) : id)).join(', ')}` : ''}`}
                style={{ left: node.x, top: node.y + HEADER, width: NODE_W, height: NODE_H }}
                className={cn(
                  'absolute flex flex-col justify-between rounded-lg border bg-surface-2 px-2.5 py-1.5 text-left transition-opacity',
                  active
                    ? 'border-accent ring-1 ring-accent'
                    : skill.hasProblems
                      ? 'border-border-strong hover:border-accent'
                      : 'border-dashed border-border-strong hover:border-accent',
                  !isLit(node.id) && 'opacity-30',
                )}
              >
                <span className="line-clamp-2 text-xs leading-[1.2] font-medium">{t(skill.title)}</span>
                <span className="flex items-center justify-between gap-2">
                  <LevelBar level={skill.level} size="sm" />
                  <span className="flex items-center gap-1 text-[10.5px] text-ink-3">
                    {(skill.due || skill.fading) && <Clock size={10} aria-label={t('k opakování', 'due for review')} />}
                    {isReady(skill) && <span>{t('připraveno', 'ready')}</span>}
                    {skill.topic !== null && <span className="font-mono">{skill.topic}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>
      <p className="mt-3 text-xs text-ink-3">
        {t(
          '„Připraveno“ znamená, že všechny předpoklady jsou aspoň na úrovni „známá“ a pojem jsi ještě nezačal. Čáry ukazují jen přímé návaznosti: co už plyne z jiné cesty, se nekreslí znovu.',
          '“Ready” means every prerequisite is at least “familiar” and you have not started the concept yet. Lines show direct dependencies only: what already follows along another path is not drawn again.',
        )}
      </p>
    </div>
  );
}
