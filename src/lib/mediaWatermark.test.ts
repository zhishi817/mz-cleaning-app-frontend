import { buildMediaWatermark, mediaOperatorName, melbourneCaptureTime } from './mediaWatermark'

describe('MZ116 capture watermark', () => {
  it('uses Melbourne summer and winter offsets, independent of device timezone', () => {
    expect(melbourneCaptureTime('2026-11-12T04:32:00Z')).toBe('2026-11-12 15:32 Melbourne')
    expect(melbourneCaptureTime('2026-06-12T04:32:00Z')).toBe('2026-06-12 14:32 Melbourne')
  })
  it('never invents a missing operator or timestamp', () => {
    expect(buildMediaWatermark('MSQ6307E', '', null)).toBe('MSQ6307E  操作账号: 未记录\n未记录')
    expect(melbourneCaptureTime('invalid')).toBe('未记录')
    expect(melbourneCaptureTime('2026-11-12T04:32:00')).toBe('未记录')
    expect(mediaOperatorName(null)).toBe('未记录')
  })
  it('uses the operation account and preserves the captured time on retry', () => {
    const user = { username: 'inspector', display_name: 'Inspector B', assignee_name: 'Cleaner A' }
    expect(buildMediaWatermark('MSQ6307E', mediaOperatorName(user), '2026-11-12T04:32:00Z'))
      .toBe('MSQ6307E  操作账号: inspector\n2026-11-12 15:32 Melbourne')
  })
})
