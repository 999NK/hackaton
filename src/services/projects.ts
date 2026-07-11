import pb from '@/lib/pocketbase/client'

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
  return await pb.collection('projects').getFullList({ sort: '-created' })
}

export const getProject = async (id: string): Promise<Project> => {
  return await pb.collection('projects').getOne(id)
}

export const createProject = async (data: Partial<Project>): Promise<Project> => {
  return await pb.collection('projects').create(data)
}

export const updateProject = async (id: string, data: Partial<Project>): Promise<Project> => {
  return await pb.collection('projects').update(id, data)
}

export const deleteProject = async (id: string): Promise<void> => {
  await pb.collection('projects').delete(id)
}
