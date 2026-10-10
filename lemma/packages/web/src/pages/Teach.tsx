import { AREAS, type CompareDto, type StudentSummaryDto, type TeachSessionDto } from '@lemma/core';
import { ArrowRight, CircleAlert, Presentation } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../app/api';
import { PathBadge } from '../app/components';
import { useT } from '../app/i18n';
import { AREA_NAMES, READINESS_NAMES } from '../app/labels';
import { studentUrl, useCompare, useMe, useStudents } from '../app/queries';
import { attentionText, displayName, interventionText, weekLine } from '../app/teach-labels';
import { formatDateTime, inDays, pct, plural } from '../lib/format';
import { Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, SectionLabel, Segmented } from '../ui';
import { LevelBar, Sparkline } from '../viz/charts';

/**
 * The learners this account teaches: what each understands, where each is stuck, and what
 * to do about it. Only learners the administrator has assigned are here — and each of
 * them can read in their own Settings that this account sees their work.
 */

export function Teach() {
  const t = useT();
  const me = useMe();
  const students = useStudents();
  if (students.isPending) return <Loading />;
  if (students.isError) return <ErrorNote error={students.error} retry={() => void students.refetch()} />;
  const admin = me.data?.account?.admin ?? false;

  return (
    <div>
      <PageHeader
        title={t('Žáci', 'Students')}
        lead={t(
          'Co kdo umí, kde to drhne a co s tím. Jsou tu jen účty, u kterých je tento účet nastaven jako učitel — a v Nastavení každého z nich je napsáno, kdo jejich práci vidí.',
          'What each understands, where it catches, and what to do about it. Only accounts that have this account set as their teacher are here — and the Settings of each of them say who can see their work.',
        )}
      />
      {students.data.length === 0 ? (
        <Empty title={t('Zatím nikoho neučíš', 'You are not teaching anybody yet')}>
          {admin
            ? t(
                'Účet žáka založíš v Nastavení → Uživatelé. U každého účtu tam pak zvolíš, kdo ho učí.',
                'Create a learner’s account in Settings → Users. For each account you then choose there who teaches it.',
              )
            : t('Kdo koho učí, nastavuje správce.', 'The administrator sets who teaches whom.')}
        </Empty>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {students.data.map((student) => (
              <StudentCard key={student.username} student={student} />
            ))}
          </div>
          {students.data.length >= 2 && <Compare />}
        </>
      )}
    </div>
  );
}

function StudentCard({ student }: { student: StudentSummaryDto }) {
  const t = useT();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const next = interventionText(student.intervention, t);
  const session = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const started = await api.post<TeachSessionDto>(`${studentUrl(student.username)}/sessions`);
      navigate(`/teach/${student.username}/session/${started.id}`);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/teach/${student.username}`} className="text-lg font-semibold text-ink">
            {displayName(student)}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="font-mono">{student.username}</span>
            <Badge>{t(student.goal.short)}</Badge>
            {student.examDay && student.daysLeft !== null && (
              <span>
                {t('zkouška', 'exam')} {inDays(student.daysLeft, t.locale)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-ink-3">
          {student.lastActiveAt === null
            ? t('zatím žádná úloha', 'no problem yet')
            : `${t('naposledy', 'last active')} ${formatDateTime(student.lastActiveAt, t.locale)}`}
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-ink-3">{t('Tento týden', 'This week')}</dt>
          <dd className="min-w-0 flex-1">{weekLine(student.week, t)}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-ink-3">{t('Předtím', 'The week before')}</dt>
          <dd className="min-w-0 flex-1 text-ink-2">{weekLine(student.previousWeek, t)}</dd>
        </div>
        {student.readiness && (
          <div className="flex gap-3">
            <dt className="w-24 shrink-0 text-ink-3">{t('Připravenost', 'Readiness')}</dt>
            <dd className="min-w-0 flex-1">
              {t(READINESS_NAMES[student.readiness.verdict])}
              {student.readiness.coverage.value !== null && (
                <span className="text-ink-3">
                  {' · '}
                  {t('pokryto', 'covered')} {pct(student.readiness.coverage.value, t.locale)}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {student.attention.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-border pt-3 text-[13px] text-ink-2">
          {student.attention.slice(0, 4).map((flag, index) => (
            <li key={index} className="flex gap-2">
              <CircleAlert size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
              <span>{attentionText(flag, t)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
        <div className="mono-label">{t('Co teď udělat', 'What to do next')}</div>
        <div className="mt-1 text-sm font-medium">{next.title}</div>
        <div className="mt-0.5 text-[13px] text-ink-2">{next.why}</div>
      </div>

      {error !== null && (
        <div className="mt-3">
          <ErrorNote error={error} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => navigate(`/teach/${student.username}`)}>
          {t('Otevřít', 'Open')}
          <ArrowRight size={14} />
        </Button>
        <Button busy={busy} onClick={() => void session()}>
          <Presentation size={14} />
          {t('Doučování', 'Tutoring session')}
        </Button>
        {student.openAssignments > 0 && (
          <span className="self-center text-xs text-ink-3">
            {plural(
              student.openAssignments,
              t.locale,
              ['zadaná práce', 'zadané práce', 'zadaných prací'],
              ['open assignment', 'open assignments'],
            )}
          </span>
        )}
      </div>
    </Card>
  );
}

/** Students side by side, skill by skill. No total and no order: there is none worth giving. */
function Compare() {
  const t = useT();
  const compare = useCompare();
  const [only, setOnly] = useState<'all' | 'different'>('different');
  if (compare.isPending) return <Loading />;
  if (compare.isError) return <ErrorNote error={compare.error} />;
  const data: CompareDto = compare.data;
  const names = data.students.map((student) => student.username);
  const differs = (row: CompareDto['skills'][number]): boolean => {
    const levels = names.map((name) => row.cells[name]?.level ?? -1);
    return Math.max(...levels) - Math.min(...levels) >= 2 || levels.includes(-1);
  };
  const rows = data.skills.filter((row) => only === 'all' || differs(row));
  const areas = AREAS.map((area) => ({ area, rows: rows.filter((row) => row.area === area) })).filter(
    (group) => group.rows.length > 0,
  );

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionLabel>{t('Vedle sebe', 'Side by side')}</SectionLabel>
        <Segmented
          label={t('Co zobrazit', 'What to show')}
          size="sm"
          value={only}
          onChange={setOnly}
          options={[
            { value: 'different', label: t('kde se liší', 'where they differ') },
            { value: 'all', label: t('vše', 'all') },
          ]}
        />
      </div>
      <p className="mt-2 text-[13px] text-ink-2">
        {t(
          'Dovednost po dovednosti, bez pořadí a bez celkového čísla: každý má jiný výchozí bod a jiný cíl. Hodí se k tomu, co komu vysvětlit — ne ke srovnávání lidí.',
          'Skill by skill, with no ranking and no overall number: each has a different starting point and a different goal. It serves deciding what to explain to whom — not comparing people.',
        )}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th className="pb-2 font-normal">{t('Dovednost', 'Skill')}</th>
              {data.students.map((student) => (
                <th key={student.username} className="pb-2 pl-4 font-normal">
                  <Link to={`/teach/${student.username}`} className="font-medium text-ink">
                    {displayName(student)}
                  </Link>
                  <div className="flex items-center gap-2">
                    {t(student.goal.short)}
                    <Sparkline
                      values={(data.weekly[student.username] ?? []).map((week) => week.problems)}
                      width={72}
                      height={18}
                      label={t('Úlohy za týden, posledních osm týdnů', 'Problems per week, the last eight weeks')}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((group) => (
              <AreaRows key={group.area} title={t(AREA_NAMES[group.area])} rows={group.rows} names={names} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={names.length + 1} className="py-3 text-ink-3">
                  {t('Žádný výrazný rozdíl.', 'No marked difference.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AreaRows({ title, rows, names }: { title: string; rows: CompareDto['skills']; names: string[] }) {
  const t = useT();
  return (
    <>
      <tr>
        <td colSpan={names.length + 1} className="pt-3 pb-1">
          <span className="mono-label">{title}</span>
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.id} className="border-t border-border">
          <td className="py-1.5 pr-3">{t(row.title)}</td>
          {names.map((name) => {
            const cell = row.cells[name];
            return (
              <td key={name} className="py-1.5 pl-4">
                {cell ? (
                  <span className="flex items-center gap-2.5">
                    <LevelBar level={cell.level} size="sm" />
                    <PathBadge state={cell.path} className="text-xs" />
                  </span>
                ) : (
                  <span className="text-xs text-ink-3">{t('není v cíli', 'not in the goal')}</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
