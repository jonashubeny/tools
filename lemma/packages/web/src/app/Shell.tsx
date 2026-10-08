import type { MeDto } from '@lemma/core';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  BookOpen,
  Bug,
  FlaskConical,
  GraduationCap,
  Languages,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Network,
  Search,
  Settings as SettingsIcon,
  Sun,
  Target,
  Timer,
  X,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { cn } from '../lib/cn';
import { TutorPanel } from '../tutor/TutorPanel';
import { type TutorTarget, TutorContext } from '../tutor/context';
import { IconButton, Kbd } from '../ui';
import { api } from './api';
import { CommandPalette } from './CommandPalette';
import { useT } from './i18n';
import { forgetLearner } from './queries';
import { currentTheme } from './theme';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

export function Shell({ me, children }: { me: MeDto; children: ReactNode }) {
  const t = useT();
  const client = useQueryClient();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorTarget, setTutorTarget] = useState<TutorTarget>({});

  // Navigating closes the mobile menu.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const saveSetting = useCallback(
    async (patch: Record<string, unknown>) => {
      await api.put('/api/settings', patch);
      await client.invalidateQueries({ queryKey: ['me'] });
    },
    [client],
  );

  const tutor = useMemo(
    () => ({
      enabled: me.tutor.enabled,
      isOpen: tutorOpen,
      target: tutorTarget,
      open: (target: TutorTarget = {}) => {
        setTutorTarget(target);
        setTutorOpen(true);
      },
      close: () => setTutorOpen(false),
    }),
    [me.tutor.enabled, tutorOpen, tutorTarget],
  );

  const groups: { label: string | null; items: NavItem[] }[] = [
    { label: null, items: [{ to: '/', label: t('Dnes', 'Today'), icon: <LayoutDashboard size={16} />, end: true }] },
    {
      label: t('Učení', 'Learning'),
      items: [
        { to: '/learn', label: t('Osnovy', 'Syllabus'), icon: <BookOpen size={16} /> },
        { to: '/tree', label: t('Strom dovedností', 'Skill tree'), icon: <Network size={16} /> },
        { to: '/exams', label: t('Zkoušky nanečisto', 'Mock exams'), icon: <Timer size={16} /> },
      ],
    },
    {
      label: t('Nástroje', 'Tools'),
      items: [
        { to: '/errors', label: t('Laboratoř chyb', 'Error Lab'), icon: <Bug size={16} /> },
        { to: '/lab', label: t('Matematická laboratoř', 'Math Lab'), icon: <FlaskConical size={16} /> },
        { to: '/missions', label: t('Mise', 'Missions'), icon: <Target size={16} /> },
      ],
    },
    {
      label: t('Přehled', 'Overview'),
      items: [
        { to: '/analytics', label: t('Analytika', 'Analytics'), icon: <Activity size={16} /> },
        { to: '/fit', label: 'FIT VUT', icon: <GraduationCap size={16} /> },
      ],
    },
  ];

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label={t('Hlavní navigace', 'Main navigation')}>
      <div className="flex items-baseline gap-2 px-4 pt-5 pb-4">
        <span className="text-lg font-semibold tracking-tight">Lemma</span>
        <span className="mono-label">v{me.version}</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {groups.map((group, index) => (
          <div key={index}>
            {group.label && <div className="mono-label px-2 pb-1.5">{group.label}</div>}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex h-8 items-center gap-2.5 rounded-md px-2 text-sm hover:no-underline',
                        isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                      )
                    }
                  >
                    <span className="text-ink-3">{item.icon}</span>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-border p-2">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Search size={16} className="text-ink-3" />
          <span className="flex-1 text-left">{t('Hledat', 'Search')}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        {me.tutor.enabled && (
          <button
            type="button"
            onClick={() => (tutorOpen ? setTutorOpen(false) : tutor.open())}
            className={cn(
              'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-sm hover:bg-surface-2 hover:text-ink',
              tutorOpen ? 'bg-surface-2 text-ink' : 'text-ink-2',
            )}
          >
            <MessageSquare size={16} className="text-ink-3" />
            <span className="flex-1 text-left">{t('Tutor', 'Tutor')}</span>
          </button>
        )}
        {/* Worth saying only where there is more than one account to be signed in to. */}
        {me.hasUsers && me.account && (
          <div
            className="truncate px-2 pt-1 font-mono text-xs text-ink-3"
            title={t('Přihlášený účet', 'Signed-in account')}
          >
            {me.account.username}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'inline-flex h-8 items-center gap-2 rounded-md px-2 text-sm hover:no-underline',
                isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            <SettingsIcon size={16} className="text-ink-3" />
            {t('Nastavení', 'Settings')}
          </NavLink>
          <div className="flex items-center">
            <IconButton
              label={t('Switch to English', 'Přepnout do češtiny')}
              onClick={() => void saveSetting({ locale: t.locale === 'cs' ? 'en' : 'cs' })}
            >
              <Languages size={16} />
            </IconButton>
            <IconButton
              label={currentTheme() === 'dark' ? t('Světlý motiv', 'Light theme') : t('Tmavý motiv', 'Dark theme')}
              onClick={() => void saveSetting({ theme: currentTheme() === 'dark' ? 'light' : 'dark' })}
            >
              {currentTheme() === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
            {me.authRequired && (
              <IconButton
                label={t('Odhlásit se', 'Sign out')}
                onClick={() => {
                  void api.post('/api/auth/logout').then(() => forgetLearner(client));
                }}
              >
                <LogOut size={16} />
              </IconButton>
            )}
          </div>
        </div>
      </div>
    </nav>
  );

  return (
    <TutorContext.Provider value={tutor}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface-1 lg:block">
          {sidebar}
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden />
            <aside className="relative h-full w-64 border-r border-border bg-surface-1">{sidebar}</aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-surface-1 px-3 lg:hidden">
            <IconButton label={t('Nabídka', 'Menu')} onClick={() => setMenuOpen((open) => !open)}>
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </IconButton>
            <span className="font-semibold">Lemma</span>
            <IconButton label={t('Hledat', 'Search')} onClick={() => setPaletteOpen(true)}>
              <Search size={18} />
            </IconButton>
          </div>
          <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>

        {tutorOpen && me.tutor.enabled && (
          <aside
            className="fixed inset-y-0 right-0 z-40 w-full max-w-[440px] border-l border-border bg-surface-1 xl:sticky xl:top-0 xl:z-0 xl:h-dvh xl:w-[420px] xl:shrink-0"
            style={{ boxShadow: 'var(--shadow)' }}
          >
            <TutorPanel model={me.tutor.model} />
          </aside>
        )}
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </TutorContext.Provider>
  );
}
