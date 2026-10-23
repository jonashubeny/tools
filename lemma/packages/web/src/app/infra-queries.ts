import type {
  AttemptDto,
  AttemptSummaryDto,
  InfraOverviewDto,
  InfraRoadmapDto,
  InfraStudentDto,
  LabAdminDto,
  ResourceDto,
  ScenarioDetailDto,
  StudyGuideDto,
} from '@lemma/core';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

/** Server state of the Linux & Infrastructure mode. */

const enc = encodeURIComponent;

export const useInfraOverview = () =>
  useQuery({ queryKey: ['infra', 'overview'], queryFn: () => api.get<InfraOverviewDto>('/api/infra/overview') });

export const useInfraRoadmap = () =>
  useQuery({ queryKey: ['infra', 'roadmap'], queryFn: () => api.get<InfraRoadmapDto>('/api/infra/roadmap') });

export const useScenario = (id: string | undefined) =>
  useQuery({
    queryKey: ['infra', 'scenario', id],
    queryFn: () => api.get<ScenarioDetailDto>(`/api/infra/scenarios/${enc(id!)}`),
    enabled: Boolean(id),
  });

/** While a lab is being prepared or reset, ask every two seconds. */
export const useAttempt = (id: string | undefined) =>
  useQuery({
    queryKey: ['infra', 'attempt', id],
    queryFn: () => api.get<AttemptDto>(`/api/infra/attempts/${enc(id!)}`),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.lab?.status;
      return status === 'provisioning' || status === 'busy' || status === 'destroying' ? 2_000 : 30_000;
    },
  });

export const useAttempts = () =>
  useQuery({ queryKey: ['infra', 'attempts'], queryFn: () => api.get<AttemptSummaryDto[]>('/api/infra/attempts') });

export const useResources = () =>
  useQuery({ queryKey: ['infra', 'resources'], queryFn: () => api.get<ResourceDto[]>('/api/infra/resources') });

export const useGuide = (query: { skill?: string; scenario?: string }) =>
  useQuery({
    queryKey: ['infra', 'guide', query.skill, query.scenario],
    queryFn: () =>
      api.get<StudyGuideDto>(
        `/api/infra/guide?${query.scenario ? `scenario=${enc(query.scenario)}` : `skill=${enc(query.skill ?? '')}`}`,
      ),
    enabled: Boolean(query.skill || query.scenario),
  });

export const useInfraStudent = (name: string | undefined) =>
  useQuery({
    queryKey: ['infra', 'student', name],
    queryFn: () => api.get<InfraStudentDto>(`/api/teach/students/${enc(name!)}/infra`),
    enabled: Boolean(name),
  });

export const useInfraStudentAttempt = (name: string | undefined, id: string | null) =>
  useQuery({
    queryKey: ['infra', 'student', name, 'attempt', id],
    queryFn: () => api.get<AttemptDto>(`/api/teach/students/${enc(name!)}/infra/attempts/${enc(id!)}`),
    enabled: Boolean(name && id),
  });

export const useLabAdmin = (enabled: boolean) =>
  useQuery({
    queryKey: ['infra', 'admin'],
    queryFn: () => api.get<LabAdminDto>('/api/admin/labs'),
    enabled,
    refetchInterval: 15_000,
  });
