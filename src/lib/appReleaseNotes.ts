export type AppReleaseNotes = {
  release_key: string
  title: string
  items: string[]
}
/**
 * These notes are compiled into the update they describe. They are only
 * presented as "applied" after expo-updates reports that this bundle's
 * updateId is the one currently running.
 */
export const CURRENT_APP_RELEASE_NOTES: AppReleaseNotes = {
  release_key: 'MZ-083-A',
  title: 'OTA 更新提示',
  items: [
    '下载完成后显示更新提示，并在“我的”中保留查看入口',
    '只有设备实际运行新 updateId 后才显示一次更新完成',
    '“稍后”不会在当前会话主动重启应用',
  ],
}
