import assert from 'node:assert/strict';
import test from 'node:test';
import { openCheckpointStore } from '../../src/features/resumes/workflow/checkpoint-store';
import { createResumableGraph } from '../../src/features/resumes/workflow/resumable-graph';
import { invokeRecoveryGraph } from '../../src/features/resumes/workflow/recovery-runner';

const input={targetRole:'后端',jdText:'接口开发',materials:[{materialId:1,type:'project' as const,title:'项目',tags:[],content:{projectCategory:'后端',techStack:[],content:'开发接口'}}]};

test('runner restores unanswered interrupt without treating recovery as consent to skip',async()=>{
  const store=openCheckpointStore(':memory:');let calls=0;
  try {
    const graph=createResumableGraph({checkpointer:store,generate:async()=>{calls++;return {output:{suggestions:[{materialId:1,proposedContent:input.materials[0].content,rationale:'保留事实'}]},inputTokens:1,outputTokens:1};}});
    const run={id:'runner',inputJson:JSON.stringify(input),targetMaterialId:1};
    assert.equal((await invokeRecoveryGraph(graph,run,false)).waiting,true);
    assert.equal((await invokeRecoveryGraph(graph,run,true)).waiting,true);
    assert.equal(calls,0);
    assert.equal((await invokeRecoveryGraph(graph,run,true,'')).waiting,false);
    assert.equal(calls,1);
    assert.equal((await invokeRecoveryGraph(graph,run,true)).waiting,false);
    assert.equal(calls,1);
  } finally {store.db.close();}
});

test('runner can restart from input snapshot when crash preceded first checkpoint',async()=>{
  const store=openCheckpointStore(':memory:');
  try {
    const graph=createResumableGraph({checkpointer:store,generate:async()=>({output:{suggestions:[{materialId:1,proposedContent:input.materials[0].content,rationale:'保留事实'}]},inputTokens:null,outputTokens:null})});
    const result=await invokeRecoveryGraph(graph,{id:'new',inputJson:JSON.stringify(input),targetMaterialId:null},true);
    assert.equal(result.waiting,false);
    if(!result.waiting)assert.equal(result.output.suggestions.length,1);
  } finally {store.db.close();}
});
