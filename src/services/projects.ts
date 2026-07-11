import { apiFetch } from '@/lib/api'

export interface Project {
  id: string
  name: string
  token: string
  baseUrl: string
  framework: string
  language: string
  user: string
  owner: string
  lastScannedAt: string
  created: string
  updated: string
}

export const getProjects = async (): Promise<Project[]> => {
  return await apiFetch<Project[]>('/api/projects')
}

export const getProject = async (id: string): Promise<Project> => {
  return await apiFetch<Project>(`/api/projects/${id}`)
}

export const createProject = async (data: Partial<Project>): Promise<Project> => {
  return await apiFetch<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export const updateProject = async (id: string, data: Partial<Project>): Promise<Project> => {
  return await apiFetch<Project>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export const deleteProject = async (id: string): Promise<void> => {
  await apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE' })
}
