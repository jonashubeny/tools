import { type GoalId, L } from '@lemma/core';
import {
  type LucideIcon,
  Activity,
  BookOpen,
  Bug,
  FlaskConical,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  Map as MapIcon,
  Network,
  Target,
  Timer,
  Users,
} from 'lucide-react';
import { useGoals } from './queries';

/**
 * The pages of the app, as the sidebar and the command palette list them. Which pages a
 * learner is offered depends on what they are preparing for: the syllabus, the Lab and
 * the road to FIT belong to the school goal; the curriculum map and readiness to an
 * examination goal. The teaching pages appear for whoever teaches somebody.
 */

export interface NavEntry {
  to: string;
  label: L;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  label: L | null;
  items: NavEntry[];
}

export function navGroups(who: { entrance: boolean; students: number }): NavGroup[] {
  const today: NavGroup = {
    label: null,
    items: [{ to: '/', label: L('Dnes', 'Today'), icon: LayoutDashboard, end: true }],
  };
  const teaching: NavGroup[] =
    who.students > 0
      ? [{ label: L('Výuka', 'Teaching'), items: [{ to: '/teach', label: L('Žáci', 'Students'), icon: Users }] }]
      : [];
  if (who.entrance) {
    return [
      today,
      {
        label: L('Učení', 'Learning'),
        items: [
          { to: '/map', label: L('Mapa učiva', 'Curriculum map'), icon: MapIcon },
          { to: '/exams', label: L('Testy nanečisto', 'Practice tests'), icon: Timer },
          { to: '/readiness', label: L('Připravenost', 'Readiness'), icon: Gauge },
        ],
      },
      {
        label: L('Přehled', 'Overview'),
        items: [
          { to: '/errors', label: L('Laboratoř chyb', 'Error Lab'), icon: Bug },
          { to: '/analytics', label: L('Analytika', 'Analytics'), icon: Activity },
        ],
      },
      ...teaching,
    ];
  }
  return [
    today,
    {
      label: L('Učení', 'Learning'),
      items: [
        { to: '/learn', label: L('Osnovy', 'Syllabus'), icon: BookOpen },
        { to: '/tree', label: L('Strom dovedností', 'Skill tree'), icon: Network },
        { to: '/exams', label: L('Zkoušky nanečisto', 'Mock exams'), icon: Timer },
      ],
    },
    {
      label: L('Nástroje', 'Tools'),
      items: [
        { to: '/errors', label: L('Laboratoř chyb', 'Error Lab'), icon: Bug },
        { to: '/lab', label: L('Matematická laboratoř', 'Math Lab'), icon: FlaskConical },
        { to: '/missions', label: L('Mise', 'Missions'), icon: Target },
      ],
    },
    {
      label: L('Přehled', 'Overview'),
      items: [
        { to: '/analytics', label: L('Analytika', 'Analytics'), icon: Activity },
        { to: '/fit', label: L('FIT VUT', 'FIT VUT'), icon: GraduationCap },
      ],
    },
    ...teaching,
  ];
}

/** Is the learner's goal an examination? Until the list of goals has loaded, the id itself answers. */
export function useEntrance(goal: GoalId | undefined): boolean {
  const goals = useGoals();
  if (!goal) return false;
  const found = goals.data?.find((entry) => entry.id === goal);
  return found ? found.kind === 'entrance' : goal.startsWith('jpz-');
}
