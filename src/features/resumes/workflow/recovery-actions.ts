'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import type { ResumeActionState } from '../actions';
import { DeepSeekError, getDeepSeekConfig, requestOptimizationOnce } from '../deepseek-core';
import { createResumableGraph } from './resumable-graph';
import { getCheckpointStore } from './checkpoint-store';
import { createRecoveryService, type RecoveryRun } from './recovery-service';
import { invokeRecoveryGraph } from './recovery-runner';

const service=createRecoveryService(db);
const startSchema=z.object({taskId:z.coerce.number().int().positive(),inputRevision:z.coerce.number().int().positive(),materialId:z.coerce.number().int().positive().optional()});
const resumeSchema=z.object({runId:z.string().uuid(),facts:z.string().trim().max(4000).optional()});
function refresh(){revalidatePath('/resumes','layout');}
function failure(error:unknown):ResumeActionState {
  return {success:false,message:error instanceof z.ZodError?'提交内容无效，请检查后重试。':error instanceof Error?error.message:'处理失败，请稍后重试。'};
}

async function execute(run:RecoveryRun,resuming:boolean,facts?:string):Promise<ResumeActionState> {
  try {
    const graph=createResumableGraph({
      checkpointer:getCheckpointStore(),
      beforeCall:async()=>{service.reserveCall(run);},
      onStage:async stage=>{service.stage(run,stage);},
      generate:async(input,feedback)=>{
        const started=Date.now();
        const response=await requestOptimizationOnce(input,feedback);
        service.recordUsage(run,response,Date.now()-started);
        return response;
      },
    });
    const result=await invokeRecoveryGraph(graph,run,resuming,facts);
    if(result.waiting) {
      service.waitForFacts(run);
      return {success:true,taskId:run.taskId!,message:'已保存等待进度，请补充这条经历的真实信息，或跳过补充。'};
    }
    const {output}=result;
    const saved=service.complete(run,output.suggestions,output.fallbackMaterialIds.length);
    return {success:saved,taskId:run.taskId!,message:saved?output.fallbackMaterialIds.length?`处理完成，${output.fallbackMaterialIds.length} 条未通过校验，已保留原文。请审阅。`:'优化完成，请逐条审阅。':'输入或运行已变化，结果未应用。'};
  } catch(error) {
    service.fail(run,error instanceof DeepSeekError?error.code:'workflow_error');
    return failure(error);
  } finally {refresh();}
}

export async function startResumableOptimizationAction(_previous:ResumeActionState,formData:FormData):Promise<ResumeActionState> {
  try {
    const input=startSchema.parse(Object.fromEntries(formData));
    const run=service.start(input.taskId,input.inputRevision,getDeepSeekConfig().model,input.materialId);
    return await execute(run,false);
  } catch(error){refresh();return failure(error);}
}

export async function resumeOptimizationAction(_previous:ResumeActionState,formData:FormData):Promise<ResumeActionState> {
  try {
    const input=resumeSchema.parse(Object.fromEntries(formData));
    // Verify config before taking the execution lease; secrets are never checkpointed.
    if(getDeepSeekConfig().model!==service.get(input.runId).model) throw new Error('模型配置已变化，请重新发起优化。');
    const run=service.resume(input.runId);
    return await execute(run,true,input.facts);
  } catch(error){refresh();return failure(error);}
}

export async function clearOptimizationCheckpointAction(_previous:ResumeActionState,formData:FormData):Promise<ResumeActionState> {
  try {
    const {runId}=resumeSchema.parse(Object.fromEntries(formData));
    service.prepareClear(runId);
    await getCheckpointStore().deleteThread(runId);
    service.markCleared(runId);
    refresh();
    return {success:true,message:'执行存档已清理，简历建议、草稿和版本仍保留。'};
  } catch(error){return failure(error);}
}
