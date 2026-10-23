'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { JdTaskView, ResumeEntryView } from '../queries';
import type { ApplicationJdContext } from '@/features/applications/jd-context';
import { resolveJdImportState } from '../jd-import';
import { JdTaskEditor, type OptimizationPanel } from './jd-task-editor';

export function JdMatchingWorkspace({entries, tasks, applicationContext=null, applicationContextError}: {
  entries: ResumeEntryView[]; tasks: JdTaskView[]; applicationContext?: ApplicationJdContext | null; applicationContextError?: string;
}) {
  const imported = resolveJdImportState(tasks, applicationContext);
  const [activeId, setActiveId] = useState<number | null>(applicationContext ? imported.activeTaskId : tasks[0]?.id ?? null);
  const [panel, setPanel] = useState<OptimizationPanel>('prepare');
  const [dirty, setDirty] = useState(false);
  const task = tasks.find(item => item.id === activeId) ?? null;
  function selectTask(id: number | null) {
    if (dirty && !window.confirm('有未保存的岗位或选材，确认切换？')) return;
    setActiveId(id); setPanel('prepare'); setDirty(false);
  }
  const taskSelector = <div className="flex min-w-0 items-center gap-2">
    <label htmlFor="optimization-task" className="sr-only">目标岗位</label>
    <Select id="optimization-task" className="h-10 min-w-0 max-w-[180px] rounded-xl text-base sm:max-w-[250px]" value={activeId ?? 'new'} onChange={event => selectTask(event.target.value === 'new' ? null : Number(event.target.value))}><option value="new">新建岗位</option>{tasks.map(item => <option key={item.id} value={item.id}>{item.targetRole}</option>)}</Select>
    <Button className="shrink-0 rounded-xl" size="icon" variant="outline" onClick={() => selectTask(null)} aria-label="新建岗位"><Plus className="h-4 w-4" /></Button>
  </div>;
  return <JdTaskEditor key={`${activeId ?? 'new'}:${task?.inputRevision ?? 1}`} task={task} entries={entries} context={applicationContext} contextError={applicationContextError} onSaved={setActiveId} panel={panel} onPanelChange={setPanel} onDirtyChange={setDirty} taskSelector={taskSelector}/>;
}
