import 'server-only';
import { eq,desc } from 'drizzle-orm';
import { db } from '@/db';
import { resumeDrafts,resumeOptimizationTasks } from '@/db/schema';
export async function getVersionCopyTargets(){
  return db.select({id:resumeOptimizationTasks.id,targetRole:resumeOptimizationTasks.targetRole,revision:resumeDrafts.revision}).from(resumeOptimizationTasks).leftJoin(resumeDrafts,eq(resumeDrafts.taskId,resumeOptimizationTasks.id)).orderBy(desc(resumeOptimizationTasks.updatedAt)).all();
}
