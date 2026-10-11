import type { WorkTask } from './api'
import { isDailyTaskExecutionVisible } from './dailyTaskExecutionVisibility'

/** Count only the server-authorized execution set and dedupe merged turnover
 * cards with the stable keys supplied by Root. Search text never participates
 * in this calculation. */
export function dailyTaskGroupCounts(tasks: WorkTask[]) {
  const turnover = new Set<string>()
  const offline = new Set<string>()
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!isDailyTaskExecutionVisible(task)) continue
    const group = task.daily_stats_group
    const key = String(task.daily_stats_key || '').trim()
    if (!key) continue
    if (group === 'turnover') turnover.add(key)
    if (group === 'offline') offline.add(key)
  }
  return { turnover: turnover.size, offline: offline.size }
}
