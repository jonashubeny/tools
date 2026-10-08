import type {
  AnalyticsDto,
  ConceptDetailDto,
  DashboardDto,
  DayDetailDto,
  ErrorSummaryDto,
  ExamBlueprint,
  ExamDto,
  ExamListItemDto,
  FitDto,
  ForgeDto,
  GraphDto,
  LessonDto,
  MeDto,
  MilestoneDef,
  MissionDto,
  PlanDto,
  RunDto,
  TutorThreadDto,
} from '@lemma/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
export const useBlueprints = () =>
  useQuery({
    queryKey: ['blueprints'],
    queryFn: () => api.get<ExamBlueprint[]>('/api/exam-blueprints'),
    staleTime: Infinity,
  });
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

/** Refetch whatever is on screen: called after anything that changes the learner's state. */
export function useRefresh(): () => void {
  const client = useQueryClient();
  return useCallback(() => {
    void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'blueprints' });
  }, [client]);
}
