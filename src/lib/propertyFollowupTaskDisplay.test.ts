import {
  isPropertyFollowupTask,
  propertyFollowupTaskDetail,
  propertyFollowupTaskTitle,
} from './propertyFollowupTaskDisplay'

test('daily necessity task exposes item name and keeps quantity', () => {
  const task = {
    source_type: 'property_daily_necessities',
    title: '毛巾',
    summary: '数量 2',
    property: { code: 'A101' },
  }
  expect(isPropertyFollowupTask(task)).toBe(true)
  expect(propertyFollowupTaskTitle(task)).toBe('补日用品：毛巾')
  expect(propertyFollowupTaskDetail(task, task.summary)).toBe('补日用品：毛巾，数量 2')
})

test('generic daily necessity title remains readable', () => {
  const task = {
    source_type: 'property_daily_necessities',
    title: '日用品更换',
    summary: '数量 1',
    property: { code: 'A101' },
  }
  expect(propertyFollowupTaskTitle(task)).toBe('补日用品')
  expect(propertyFollowupTaskDetail(task, task.summary)).toBe('补日用品，数量 1')
})

test('maintenance and deep-cleaning tasks retain their existing detail', () => {
  expect(propertyFollowupTaskDetail({ source_type: 'property_maintenance' }, '更换水龙头')).toBe('更换水龙头')
  expect(propertyFollowupTaskDetail({ source_type: 'property_deep_cleaning' }, '蒸汽清洁床垫')).toBe('蒸汽清洁床垫')
})
