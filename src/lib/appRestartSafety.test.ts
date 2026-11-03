import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  __resetAppRestartSafetyForTests,
  checkAppRestartSafety,
  notifyAppRestartSafetyStateChanged,
  releaseAppRestartReservation,
  reserveAppRestart,
  setAppRestartBlocker,
} from './appRestartSafety'

jest.mock('./inspectionPanelDraftRecovery', () => ({
  listInspectionPanelDraftRecoverySnapshots: jest.fn(async () => []),
}))

beforeEach(async () => {
  __resetAppRestartSafetyForTests()
  await AsyncStorage.clear()
})

test('运行时未保存输入会阻止重启，清除后重新核对即可放行', async () => {
  setAppRestartBlocker('screen:edit', { kind: 'unsaved', message: '有未保存输入' })
  const blocked = await checkAppRestartSafety()
  expect(blocked.safe).toBe(false)
  expect(blocked.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'unsaved' })]))

  setAppRestartBlocker('screen:edit', null)
  expect((await checkAppRestartSafety()).safe).toBe(true)
})

test('未完成上传队列和本地照片草稿会阻止重启，已完成队列不会误拦截', async () => {
  await AsyncStorage.setItem('mzstay.inspection_media_queue.v1', JSON.stringify([
    { upload_status: 'uploaded', business_saved: true },
    { upload_status: 'failed_retryable', business_saved: false },
  ]))
  await AsyncStorage.setItem('mzstay.maintenance_completion_photo_draft.v1:user:task', JSON.stringify({
    photos: [{ media_id: 'photo-1', local_uri: 'file:///draft.jpg' }],
  }))

  const result = await checkAppRestartSafety()
  expect(result.safe).toBe(false)
  expect(result.blockers.map((item) => item.kind)).toEqual(expect.arrayContaining(['uploading', 'unsaved']))

  await AsyncStorage.setItem('mzstay.inspection_media_queue.v1', JSON.stringify([
    { upload_status: 'uploaded', business_saved: true },
  ]))
  await AsyncStorage.removeItem('mzstay.maintenance_completion_photo_draft.v1:user:task')
  notifyAppRestartSafetyStateChanged()
  expect((await checkAppRestartSafety()).safe).toBe(true)
})

test('页面卸载后仍扫描检查提交后的问题照片草稿', async () => {
  await AsyncStorage.setItem('mzstay.inspection_post_submit_issue_draft.v1:inspection-1', JSON.stringify({
    photos: [{ local_uri: 'file:///inspection-issue.jpg' }],
    note: '浴室仍需处理',
  }))

  const result = await checkAppRestartSafety()
  expect(result.safe).toBe(false)
  expect(result.blockers).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'unsaved', message: '有尚未完成的本地表单或照片草稿' }),
  ]))
})

test('损坏的相关队列记录会失败关闭而不是冒险重启', async () => {
  await AsyncStorage.setItem('mzstay.key_upload_queue.v2', '{bad-json')
  const result = await checkAppRestartSafety()
  expect(result.safe).toBe(false)
  expect(result.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'storage_error' })]))
})

test('最终检查后的状态变化会使重启预约失效，且预约不能重复', async () => {
  const safe = await checkAppRestartSafety()
  expect(safe.safe).toBe(true)
  setAppRestartBlocker('late-upload', { kind: 'uploading', message: '上传刚刚开始' })
  expect(reserveAppRestart(safe.generation)).toBeNull()

  setAppRestartBlocker('late-upload', null)
  const refreshed = await checkAppRestartSafety()
  const token = reserveAppRestart(refreshed.generation)
  expect(token).not.toBeNull()
  expect(reserveAppRestart(refreshed.generation)).toBeNull()
  releaseAppRestartReservation(token)
  expect(reserveAppRestart(refreshed.generation)).not.toBeNull()
})
