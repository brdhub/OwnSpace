import { Command } from '@langchain/langgraph';
import type { OptimizationPromptInput } from '../prompts';
import { createResumableGraph, RESUME_WORKFLOW_VERSION } from './resumable-graph';

type RunInput = {id:string;inputJson:string|null;targetMaterialId:number|null};

// Kept independent of Server Actions so restart/interrupt reconciliation is testable.
export async function invokeRecoveryGraph(
  graph:ReturnType<typeof createResumableGraph>,run:RunInput,resuming:boolean,facts?:string,
) {
  const config={configurable:{thread_id:run.id},durability:'sync' as const,recursionLimit:16};
  const snapshot=resuming?await graph.getState(config):null;
  if(snapshot?.values?.workflowVersion&&snapshot.values.workflowVersion!==RESUME_WORKFLOW_VERSION) throw new Error('流程版本已变化，请重新优化。');
  if(snapshot?.tasks.some(task=>task.interrupts?.length)&&facts===undefined) return {waiting:true as const};
  const initial={input:JSON.parse(run.inputJson!) as OptimizationPromptInput,workflowVersion:RESUME_WORKFLOW_VERSION,needsFacts:run.targetMaterialId!==null};
  const interrupted=snapshot?.tasks.some(task=>task.interrupts?.length);
  // Whitespace represents explicit skip; LangGraph does not accept a falsy resume value.
  const output=await graph.invoke(snapshot?.values?.input
    ? interrupted?new Command({resume:facts?.trim()||' '}):null
    :initial,config);
  const current=await graph.getState(config);
  if(current.tasks.some(task=>task.interrupts?.length)) return {waiting:true as const};
  return {waiting:false as const,output};
}
