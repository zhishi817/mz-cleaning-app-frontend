import {
  cleaningTaskTitleSuffix,
  effectiveInspectionMode,
  inspectionModeLabel,
  inspectionScopeLabel,
  isCheckinSiteExecutionTask,
  isInspectionModeAllowedForTask,
  isPasswordOnlyInspectionTask,
  normalizeInspectionScope,
  shouldUseDeferredInspectionTitle,
  taskPersonnelPresentation,
  unlinkedDeferredInspectionDisplayIdentity,
} from './cleaningInspection'

describe('cleaningInspection display helpers', () => {
  test('uses deferred inspection suffix for deferred inspection tasks', () => {
    const task = {
      source_type: 'cleaning_tasks',
      task_kind: 'inspection',
      inspection_mode: 'deferred',
      start_time: '10am',
    }
    expect(shouldUseDeferredInspectionTitle(task)).toBe(true)
    expect(cleaningTaskTitleSuffix(task)).toBe('延期检查')
    expect(unlinkedDeferredInspectionDisplayIdentity({ ...task, source_id: 'historical-source' })).toBe('deferred:historical-source')
    expect(unlinkedDeferredInspectionDisplayIdentity({
      ...task,
      source_id: 'linked-source',
      inspection_original_checkout_date: '2026-10-11',
    })).toBeNull()
  })

  test('keeps checkout and checkin suffixes for non-deferred tasks', () => {
    expect(cleaningTaskTitleSuffix({
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      task_type: 'checkout_clean',
      start_time: '10am',
    })).toBe('退房')
    expect(cleaningTaskTitleSuffix({
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      task_type: 'checkin_clean',
      end_time: '3pm',
    })).toBe('入住')
  })

  test('a deferred-inspection merge shows only the work that occurs on the display day', () => {
    expect(cleaningTaskTitleSuffix({
      source_type: 'cleaning_tasks',
      task_kind: 'inspection',
      task_type: 'checkin_clean',
      inspection_mode: 'deferred',
      start_time: '10am',
      end_time: '3pm',
      deferred_inspection_merged: true,
      deferred_inspection_current_day_checkout: false,
    })).toBe('入住')
    expect(cleaningTaskTitleSuffix({
      source_type: 'cleaning_tasks',
      task_kind: 'inspection',
      task_type: 'turnover',
      inspection_mode: 'deferred',
      start_time: '10am',
      end_time: '3pm',
      deferred_inspection_merged: true,
      deferred_inspection_current_day_checkout: true,
    })).toBe('退房 入住')
    expect(cleaningTaskTitleSuffix({
      source_type: 'cleaning_tasks',
      task_kind: 'inspection',
      task_type: 'turnover',
      start_time: '10am',
      end_time: '3pm',
      deferred_inspection_merged: true,
    })).toBe('退房 入住')
    expect(cleaningTaskTitleSuffix({
      source_type: 'cleaning_tasks',
      task_kind: 'inspection',
      task_type: 'turnover',
      inspection_mode: 'deferred',
      start_time: '10am',
      end_time: '3pm',
      deferred_inspection_merged: true,
    })).toBe('延期检查')
  })

  test('marks password-only inspection tasks distinctly', () => {
    expect(normalizeInspectionScope('password_only')).toBe('password_only')
    expect(inspectionScopeLabel(null)).toBe('检查后挂钥匙')
    expect(inspectionModeLabel('checked_done')).toBe('已检查')
    expect(isPasswordOnlyInspectionTask({
      source_type: 'cleaning_tasks',
      task_kind: 'inspection',
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
    })).toBe(true)
    expect(isPasswordOnlyInspectionTask({
      source_type: 'cleaning_tasks',
      task_kind: 'inspection',
      task_type: 'checkin_clean',
      inspection_scope: null,
    })).toBe(false)
    expect(isInspectionModeAllowedForTask({
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
      inspection_mode: 'checked_done',
    })).toBe(false)
    expect(effectiveInspectionMode({
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
      inspection_mode: 'checked_done',
    })).toBe('same_day')
  })

  test('treats legacy password-only check-in cleaning projections as site execution only', () => {
    expect(isPasswordOnlyInspectionTask({
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      task_type: 'checkin_clean',
      inspection_scope: 'password_only',
    })).toBe(true)
    expect(isPasswordOnlyInspectionTask({
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      task_type: 'checkin_clean',
      inspection_scope: 'inspect_and_hang',
    })).toBe(false)
    expect(isPasswordOnlyInspectionTask({
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      task_type: 'checkout_clean',
      inspection_scope: 'password_only',
    })).toBe(false)
  })

  test('trusts inspect-and-hang execution semantics ahead of a stale cleaning task kind', () => {
    const task = {
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      task_type: 'checkin_clean',
      inspection_scope: 'inspect_and_hang',
      execution_semantics: 'checkin_inspection',
      assignee_id: 'oscar-id',
      assignee_name: 'Oscar',
      cleaner_id: null,
      cleaner_name: 'Oscar',
    }

    expect(isCheckinSiteExecutionTask(task)).toBe(true)
    expect(taskPersonnelPresentation(task)).toEqual({
      mode: 'execution',
      executorName: 'Oscar',
      cleanerName: 'Oscar',
      inspectorName: '',
    })
  })

  test('never backfills a cleaning role from the generic assignee', () => {
    expect(taskPersonnelPresentation({
      source_type: 'cleaning_tasks',
      task_kind: 'cleaning',
      task_type: 'checkout_clean',
      execution_semantics: 'cleaning_execution',
      assignee_id: 'generic-id',
      assignee_name: 'Generic Person',
      cleaner_id: null,
      cleaner_name: null,
      inspector_id: 'inspector-id',
      inspector_name: 'Inspector',
    })).toEqual({
      mode: 'cleaning_inspection',
      executorName: '',
      cleanerName: '',
      inspectorName: 'Inspector',
    })
  })
})
