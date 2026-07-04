import { inspectionExecutionTaskIdsFromTask, uniqueTextList } from './turnoverDisplay'

export function inspectionPhotoTaskIdsFromTask(task: any) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  return uniqueTextList([
    ...inspectionExecutionTaskIdsFromTask(task),
    ...(Array.isArray(task?.inspection_task_ids) ? task.inspection_task_ids : []),
    ...(Array.isArray(task?.cleaning_task_ids) ? task.cleaning_task_ids : []),
    ...(Array.isArray(task?.source_ids) ? task.source_ids : []),
    task?.source_id,
  ])
}
