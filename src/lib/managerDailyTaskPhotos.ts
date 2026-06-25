function cleanText(value: any) {
  return String(value || '').trim()
}

function uniqueTextList(values: any[]) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)))
}

export function inspectionPhotoTaskIdsFromTask(task: any) {
  if (!task || task.source_type !== 'cleaning_tasks') return []
  return uniqueTextList([
    ...(Array.isArray(task.inspection_task_ids) ? task.inspection_task_ids : []),
    ...(Array.isArray(task.cleaning_task_ids) ? task.cleaning_task_ids : []),
    ...(Array.isArray(task.source_ids) ? task.source_ids : []),
    task.source_id,
  ])
}
