"use client";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ExperienceProject } from '../schema';

export function ExperienceProjectFields({ projects, onChange }: {
  projects: ExperienceProject[];
  onChange: (projects: ExperienceProject[]) => void;
}) {
  function update(index: number, key: keyof ExperienceProject, value: string) {
    onChange(projects.map((project, row) => row === index ? { ...project, [key]: value } : project));
  }
  return <fieldset className="space-y-3">
    <legend className="text-sm font-medium">负责项目</legend>
    {projects.map((project, index) => <div key={index} className="space-y-3 rounded-md border p-3">
      <label className="block space-y-1 text-sm"><span>项目 {index + 1} 名称</span>
        <Input value={project.name} required maxLength={120} onChange={event => update(index, 'name', event.target.value)} />
      </label>
      <label className="block space-y-1 text-sm"><span>项目内容</span>
        <Textarea value={project.content} maxLength={4000} rows={3} onChange={event => update(index, 'content', event.target.value)} />
      </label>
      <label className="block space-y-1 text-sm"><span>个人职责</span>
        <Textarea value={project.responsibilities} maxLength={4000} rows={3} onChange={event => update(index, 'responsibilities', event.target.value)} />
      </label>
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange(projects.filter((_, row) => row !== index))}>移除项目 {index + 1}</Button>
    </div>)}
    <Button type="button" size="sm" variant="outline" disabled={projects.length >= 20} onClick={() => onChange([...projects, { name: '', content: '', responsibilities: '' }])}>新增负责项目</Button>
  </fieldset>;
}
