import type {
  AnalyticsDto,
  AssignmentDto,
  CompareDto,
  ConceptDetailDto,
  CurriculumDto,
  DashboardDto,
  DayDetailDto,
  DiagnosticDto,
  ErrorSummaryDto,
  ExamBlueprint,
  ExamDto,
  ExamListItemDto,
  FitDto,
  ForgeDto,
  GoalDto,
  GraphDto,
  HistoryItemDto,
  LessonDto,
  MeDto,
  MilestoneDef,
  MissionDto,
  PlanDto,
  ReadinessDto,
  RunDto,
  StudentDetailDto,
  StudentSummaryDto,
  TeachBriefDto,
  TeachSessionDto,
  TutorThreadDto,
  UserDto,
  WorkedExampleDto,
} from '@lemma/core';
import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from './api';

/** Server state. Everything is small and local, so it is simply refetched after a change. */

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api.get<MeDto>('/api/me'), staleTime: 60_000 });
export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardDto>('/api/dashboard') });
export const useGraph = () => useQuery({ queryKey: ['graph'], queryFn: () => api.get<GraphDto>('/api/graph') });
export const useConcept = (id: string | undefined) =>
  useQuery({
    queryKey: ['concept', id],
    queryFn: () => api.get<ConceptDetailDto>(`/api/concepts/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
  });
export const useLesson = (id: string | undefined) =>
  useQuery({
    queryKey: ['lesson', id],
    queryFn: () => api.get<LessonDto>(`/api/lessons/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
  });
export const usePlan = () => useQuery({ queryKey: ['plan'], queryFn: () => api.get<PlanDto>('/api/plan') });
export const useRun = (id: string | undefined) =>
  useQuery({
    queryKey: ['run', id],
    queryFn: () => api.get<RunDto>(`/api/runs/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
  });
export const useErrors = () =>
  useQuery({ queryKey: ['errors'], queryFn: () => api.get<ErrorSummaryDto>('/api/errors') });
export const useAnalytics = () =>
  useQuery({ queryKey: ['analytics'], queryFn: () => api.get<AnalyticsDto>('/api/analytics') });
export const useFit = () => useQuery({ queryKey: ['fit'], queryFn: () => api.get<FitDto>('/api/fit') });
export const useMissions = () =>
  useQuery({ queryKey: ['missions'], queryFn: () => api.get<MissionDto[]>('/api/missions') });
export const useForge = () => useQuery({ queryKey: ['forge'], queryFn: () => api.get<ForgeDto>('/api/forge') });
export const useExams = () =>
  useQuery({ queryKey: ['exams'], queryFn: () => api.get<ExamListItemDto[]>('/api/exams') });
/** The tests offered to the learner: they depend on the goal, so they are refetched like anything else. */
export const useBlueprints = () =>
  useQuery({ queryKey: ['blueprints'], queryFn: () => api.get<ExamBlueprint[]>('/api/exam-blueprints') });

// ------------------------------------------------------------------ goals and the path

/** The goals there are to choose from. The same for everybody, and fixed for a version of the app. */
export const useGoals = () =>
  useQuery({ queryKey: ['goals'], queryFn: () => api.get<GoalDto[]>('/api/goals'), staleTime: Infinity });
export const useCurriculum = () =>
  useQuery({ queryKey: ['curriculum'], queryFn: () => api.get<CurriculumDto>('/api/curriculum') });
export const useReadiness = () =>
  useQuery({ queryKey: ['readiness'], queryFn: () => api.get<ReadinessDto>('/api/readiness') });
export const useDiagnostics = () =>
  useQuery({ queryKey: ['diagnostics'], queryFn: () => api.get<DiagnosticDto[]>('/api/diagnostics') });
export const useDiagnostic = (id: string | undefined) =>
  useQuery({
    queryKey: ['diagnostic', id],
    queryFn: () => api.get<DiagnosticDto>(`/api/diagnostics/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
  });
export const useAssignments = () =>
  useQuery({ queryKey: ['assignments'], queryFn: () => api.get<AssignmentDto[]>('/api/assignments') });
/** A solved example of a skill; asking for it counts as having been introduced to the skill. */
export const useExample = (id: string | undefined, n: number, enabled: boolean) =>
  useQuery({
    queryKey: ['example', id, n],
    queryFn: () => api.get<WorkedExampleDto>(`/api/concepts/${encodeURIComponent(id!)}/example?n=${n}`),
    enabled: Boolean(id) && enabled,
    staleTime: Infinity,
  });

// ----------------------------------------------------------------------------- teaching

const student = (name: string): string => `/api/teach/students/${encodeURIComponent(name)}`;

export const useStudents = (enabled = true) =>
  useQuery({
    queryKey: ['teach', 'students'],
    queryFn: () => api.get<StudentSummaryDto[]>('/api/teach/students'),
    enabled,
  });
export const useStudent = (name: string | undefined) =>
  useQuery({
    queryKey: ['teach', 'student', name],
    queryFn: () => api.get<StudentDetailDto>(student(name!)),
    enabled: Boolean(name),
  });
export const useStudentHistory = (name: string | undefined, query: string) =>
  useQuery({
    queryKey: ['teach', 'history', name, query],
    queryFn: () => api.get<HistoryItemDto[]>(`${student(name!)}/history?${query}`),
    enabled: Boolean(name),
  });
export const useStudentConcept = (name: string | undefined, id: string | null) =>
  useQuery({
    queryKey: ['teach', 'concept', name, id],
    queryFn: () => api.get<ConceptDetailDto>(`${student(name!)}/concepts/${encodeURIComponent(id!)}`),
    enabled: Boolean(name) && id !== null,
  });
export const useCompare = (enabled = true) =>
  useQuery({ queryKey: ['teach', 'compare'], queryFn: () => api.get<CompareDto>('/api/teach/compare'), enabled });
export const useBrief = (name: string | undefined) =>
  useQuery({
    queryKey: ['teach', 'brief', name],
    queryFn: () => api.get<TeachBriefDto>(`${student(name!)}/brief`),
    enabled: Boolean(name),
  });
export const useTeachSession = (name: string | undefined, id: string | undefined) =>
  useQuery({
    queryKey: ['teach', 'session', name, id],
    queryFn: () => api.get<TeachSessionDto>(`${student(name!)}/sessions/${encodeURIComponent(id!)}`),
    enabled: Boolean(name) && Boolean(id),
    refetchOnWindowFocus: false,
  });
export const studentUrl = student;
export const useExam = (id: string | undefined) =>
  useQuery({
    queryKey: ['exam', id],
    queryFn: () => api.get<ExamDto>(`/api/exams/${encodeURIComponent(id!)}`),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
  });
export const useDay = (day: string | null) =>
  useQuery({
    queryKey: ['day', day],
    queryFn: () => api.get<DayDetailDto>(`/api/activity/day/${day}`),
    enabled: day !== null,
  });

export type MilestoneDto = MilestoneDef & { achieved: { ref: string; at: number }[] };
export const useMilestones = () =>
  useQuery({ queryKey: ['milestones'], queryFn: () => api.get<MilestoneDto[]>('/api/milestones') });

export const useThreads = (problemId?: string) =>
  useQuery({
    queryKey: ['threads', problemId ?? null],
    queryFn: () =>
      api.get<TutorThreadDto[]>(
        problemId ? `/api/tutor/threads?problemId=${encodeURIComponent(problemId)}` : '/api/tutor/threads',
      ),
  });

/** The accounts of this instance; only the administrator may ask. */
export const useUsers = (enabled: boolean) =>
  useQuery({ queryKey: ['users'], queryFn: () => api.get<UserDto[]>('/api/admin/users'), enabled });

/**
 * Drop everything cached about the signed-in learner and ask again who is signed in.
 * Called whenever the account may have changed, so that what one learner saw never
 * flashes up for the next one in the same browser.
 */
export function forgetLearner(client: QueryClient): Promise<void> {
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' && query.queryKey[0] !== 'goals' });
  return client.invalidateQueries({ queryKey: ['me'] });
}

/** Refetch whatever is on screen: called after anything that changes the learner's state. */
export function useRefresh(): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'goals' });
  }, [client]);
}
