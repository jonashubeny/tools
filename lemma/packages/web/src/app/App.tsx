import { useQueryClient } from '@tanstack/react-query';
import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Login } from '../pages/Login';
import { Onboarding } from '../pages/Onboarding';
import { Today } from '../pages/Today';
import { ErrorNote, Loading } from '../ui';
import { onUnauthenticated } from './api';
import { I18nProvider, initialLocale, rememberLocale } from './i18n';
import { useEntrance } from './nav';
import { useMe } from './queries';
import { Shell } from './Shell';
import { applyTheme } from './theme';

const Learn = lazy(() => import('../pages/Learn').then((m) => ({ default: m.Learn })));
const Concept = lazy(() => import('../pages/Concept').then((m) => ({ default: m.Concept })));
const Lesson = lazy(() => import('../pages/Lesson').then((m) => ({ default: m.Lesson })));
const Practice = lazy(() => import('../pages/Practice').then((m) => ({ default: m.Practice })));
const Tree = lazy(() => import('../pages/Tree').then((m) => ({ default: m.Tree })));
const Errors = lazy(() => import('../pages/Errors').then((m) => ({ default: m.Errors })));
const Exams = lazy(() => import('../pages/Exams').then((m) => ({ default: m.Exams })));
const Exam = lazy(() => import('../pages/Exam').then((m) => ({ default: m.Exam })));
const Lab = lazy(() => import('../pages/Lab').then((m) => ({ default: m.Lab })));
const Fit = lazy(() => import('../pages/Fit').then((m) => ({ default: m.Fit })));
const Missions = lazy(() => import('../pages/Missions').then((m) => ({ default: m.Missions })));
const Analytics = lazy(() => import('../pages/Analytics').then((m) => ({ default: m.Analytics })));
const Settings = lazy(() => import('../pages/Settings').then((m) => ({ default: m.Settings })));
const CurriculumMap = lazy(() => import('../pages/Map').then((m) => ({ default: m.CurriculumMap })));
const Diagnostic = lazy(() => import('../pages/Diagnostic').then((m) => ({ default: m.Diagnostic })));
const Readiness = lazy(() => import('../pages/Readiness').then((m) => ({ default: m.Readiness })));
const Teach = lazy(() => import('../pages/Teach').then((m) => ({ default: m.Teach })));
const Student = lazy(() => import('../pages/Student').then((m) => ({ default: m.Student })));
const TeachSession = lazy(() => import('../pages/TeachSession').then((m) => ({ default: m.TeachSession })));

export function App() {
  const me = useMe();
  const client = useQueryClient();

  // Any request that comes back 401 means the session ended: ask who we are again.
  useEffect(() => onUnauthenticated(() => void client.invalidateQueries({ queryKey: ['me'] })), [client]);

  // The syllabus pages describe the school goal; with an examination goal they lead to the map.
  const entrance = useEntrance(me.data?.authenticated ? me.data.settings.goal : undefined);
  const locale = me.data?.authenticated ? me.data.settings.locale : initialLocale();
  const theme = me.data?.authenticated ? me.data.settings.theme : null;
  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);
  useEffect(() => rememberLocale(locale), [locale]);

  return (
    <I18nProvider locale={locale}>
      {me.isPending ? (
        <div className="grid min-h-dvh place-items-center">
          <Loading />
        </div>
      ) : me.isError ? (
        <div className="mx-auto max-w-md px-6 pt-24">
          <ErrorNote error={me.error} retry={() => void me.refetch()} />
        </div>
      ) : !me.data.authenticated ? (
        <Login />
      ) : !me.data.onboarded ? (
        <Onboarding me={me.data} />
      ) : (
        <Shell me={me.data}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/learn" element={entrance ? <Navigate to="/map" replace /> : <Learn />} />
              <Route path="/concept/:id" element={<Concept />} />
              <Route path="/lesson/:id" element={<Lesson />} />
              <Route path="/practice/:runId" element={<Practice />} />
              <Route path="/tree" element={entrance ? <Navigate to="/map" replace /> : <Tree />} />
              <Route path="/map" element={<CurriculumMap />} />
              <Route path="/diagnostic/:id" element={<Diagnostic />} />
              <Route path="/readiness" element={entrance ? <Readiness /> : <Navigate to="/" replace />} />
              <Route path="/teach" element={<Teach />} />
              <Route path="/teach/:student" element={<Student />} />
              <Route path="/teach/:student/session/:id" element={<TeachSession />} />
              <Route path="/errors" element={<Errors />} />
              <Route path="/exams" element={<Exams />} />
              <Route path="/exams/:id" element={<Exam />} />
              <Route path="/lab" element={<Lab />} />
              <Route path="/lab/:tool" element={<Lab />} />
              <Route path="/fit" element={entrance ? <Navigate to="/readiness" replace /> : <Fit />} />
              <Route path="/missions" element={<Missions />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Shell>
      )}
    </I18nProvider>
  );
}
