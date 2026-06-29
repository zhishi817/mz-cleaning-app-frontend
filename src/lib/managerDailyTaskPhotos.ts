import { inspectionExecutionTaskIdsFromTask } from './turnoverDisplay'

export function inspectionPhotoTaskIdsFromTask(task: any) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  return inspectionExecutionTaskIdsFromTask(task)
}
