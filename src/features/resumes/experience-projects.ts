import type { ExperienceProject } from './schema';

export function getExperienceProjects(content: object): ExperienceProject[] {
  return ('projects' in content && Array.isArray(content.projects)) ? content.projects : [];
}

export function formatExperienceProjects(projects: ExperienceProject[]) {
  return projects.map(project => [
    project.name,
    project.content && `项目内容：${project.content}`,
    project.responsibilities && `个人职责：${project.responsibilities}`,
  ].filter(Boolean).join('\n')).join('\n\n');
}
