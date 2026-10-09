import {
  cleaningTaskTitleSuffix,
  effectiveInspectionMode,
  inspectionModeLabel,
  inspectionScopeLabel,
  isInspectionModeAllowedForTask,
  isPasswordOnlyInspectionTask,
  normalizeInspectionScope,
  shouldUseDeferredInspectionTitle,
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
})
