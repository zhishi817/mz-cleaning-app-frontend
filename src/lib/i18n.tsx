import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getJson, setJson } from './storage'

export type Locale = 'zh' | 'en'

export const LOCALE_STORAGE_KEY = 'mzstay.settings.locale'

const dictionary = {
  zh: {
    tabs_tasks: '任务',
    tabs_notices: '公告',
    tabs_contacts: '通讯录',
    tabs_me: '我',
    notices_title: '公告',
    notices_unread: '未读',
    notices_all: '全部',
    notices_type_system: '系统通知',
    notices_type_update: '更新消息',
    notices_type_key: '钥匙密码',
    contacts_title: '通讯录',
    contacts_search: '搜索姓名',
    me_title: '我',
    me_language: '语言',
    me_profile: '个人信息',
    me_account: '账号管理',
    me_logout: '退出登录',
    profile_edit: '编辑资料',
    profile_name: '姓名',
    profile_phone: '手机号',
    profile_dept: '部门',
    profile_title: '职位',
    profile_save: '保存',
    profile_avatar: '头像',
    account_manage: '账号管理',
    account_clear: '清除本地数据',
    common_cancel: '取消',
    common_confirm: '确认',
    common_loading: '加载中…',
    common_error: '出错了',
    common_retry: '重试',
    common_ok: '确定',
    common_saved: '已保存',
    profile_invalid_name: '姓名不能为空且不超过 40 个字符',
    profile_invalid_phone: '手机号格式不正确（澳洲手机号）',
    profile_no_permission: '未获得相册权限',
    profile_pick_failed: '无法选择图片',
    profile_save_failed: '保存失败',
    tasks_greeting: '你好,',
    tasks_period_today: '今天',
    tasks_period_week: '本周',
    tasks_period_month: '本月',
    tasks_section_today: '今日任务',
    tasks_tasks_suffix: '个任务',
    tasks_status_cleaning: '清洁中',
    tasks_tag_priority: '早入住 · 优先',
    tasks_route_order: '路线顺序',
    tasks_route_rank: '第1',
    tasks_checkout: '客人退房',
    tasks_next_checkin: '下位入住',
    tasks_old_code: '旧密码',
    tasks_master_code: '万能码',
    tasks_new_code: '新密码',
    tasks_view_guide: '查看指南',
    tasks_no_tasks: '暂无任务',
    tasks_view_detail: '查看任务详情',
    task_detail_title: '任务详情',
    task_key_photo: '客人钥匙照片',
    task_take_photo: '拍照上传',
    task_pick_photo: '从相册选择',
    task_uploading: '上传中…',
    task_uploaded: '上传成功',
    task_status_pending_key: '待上传钥匙',
    task_web_hint: 'Web 端不支持直接调用相机，可使用相册选择。',
    task_status_completed: '已完成',
    tasks_btn_upload_key: '上传钥匙',
    tasks_btn_repair: '房源报修',
    tasks_btn_complete: '完成任务',
    repair_title: '房源报修',
    repair_field_type: '报修类型',
    repair_field_desc: '问题描述',
    repair_field_urgency: '紧急程度',
    repair_field_contact: '联系方式',
    repair_placeholder_desc: '请描述问题（最多 500 字）',
    repair_placeholder_contact: '手机号/微信/邮箱等',
    repair_submit: '提交报修',
    repair_success: '报修已提交',
    repair_failed: '提交失败',
    repair_error_type: '请选择报修类型',
    repair_error_desc: '请填写问题描述',
    repair_error_contact: '请填写联系方式',
    repair_type_plumbing: '水电/管道',
    repair_type_electrical: '电路/照明',
    repair_type_appliance: '家电',
    repair_type_internet: '网络',
    repair_type_other: '其他',
    repair_urgency_low: '不急',
    repair_urgency_medium: '一般',
    repair_urgency_high: '紧急',
    complete_title: '确认完成任务',
    complete_supplies: '消耗品补充',
    complete_note: '备注',
    complete_note_placeholder: '填写备注（最多 500 字）',
    complete_submit: '确认完成',
    complete_success: '任务已完成',
    complete_failed: '完成失败',
    complete_error_required: '请至少选择一个消耗品或填写备注',
    supplies_shampoo: '洗发水',
    supplies_bodywash: '沐浴露',
    supplies_conditioner: '护发素',
    supplies_handsoap: '洗手液',
    supplies_tissue: '纸巾',
    supplies_toiletpaper: '厕纸',
    supplies_detergent: '洗衣液',
    supplies_trashbag: '垃圾袋',
  },
  en: {
    tabs_tasks: 'Tasks',
    tabs_notices: 'Notices',
    tabs_contacts: 'Contacts',
    tabs_me: 'Me',
    notices_title: 'Notices',
    notices_unread: 'Unread',
    notices_all: 'All',
    notices_type_system: 'System',
    notices_type_update: 'Updates',
    notices_type_key: 'Key Codes',
    contacts_title: 'Contacts',
    contacts_search: 'Search name',
    me_title: 'Me',
    me_language: 'Language',
    me_profile: 'Profile',
    me_account: 'Account',
    me_logout: 'Sign out',
    profile_edit: 'Edit Profile',
    profile_name: 'Name',
    profile_phone: 'Mobile',
    profile_dept: 'Department',
    profile_title: 'Title',
    profile_save: 'Save',
    profile_avatar: 'Avatar',
    account_manage: 'Account',
    account_clear: 'Clear Local Data',
    common_cancel: 'Cancel',
    common_confirm: 'Confirm',
    common_loading: 'Loading…',
    common_error: 'Something went wrong',
    common_retry: 'Retry',
    common_ok: 'OK',
    common_saved: 'Saved',
    profile_invalid_name: 'Name is required (1–40 chars)',
    profile_invalid_phone: 'Invalid AU mobile format',
    profile_no_permission: 'Photo permission denied',
    profile_pick_failed: 'Unable to pick image',
    profile_save_failed: 'Save failed',
    tasks_greeting: 'Hello,',
    tasks_period_today: 'Today',
    tasks_period_week: 'This week',
    tasks_period_month: 'This month',
    tasks_section_today: "Today's Tasks",
    tasks_tasks_suffix: 'tasks',
    tasks_status_cleaning: 'Cleaning',
    tasks_tag_priority: 'Early check-in · Priority',
    tasks_route_order: 'Route order',
    tasks_route_rank: 'No.1',
    tasks_checkout: 'Check-out',
    tasks_next_checkin: 'Next check-in',
    tasks_old_code: 'Old code',
    tasks_master_code: 'Master code',
    tasks_new_code: 'New code',
    tasks_view_guide: 'View guide',
    tasks_no_tasks: 'No tasks',
    tasks_view_detail: 'View task details',
    task_detail_title: 'Task Detail',
    task_key_photo: 'Guest key photo',
    task_take_photo: 'Take photo',
    task_pick_photo: 'Choose photo',
    task_uploading: 'Uploading…',
    task_uploaded: 'Uploaded',
    task_status_pending_key: 'Need key photo',
    task_web_hint: 'Camera is not available on web. Please choose from library.',
    task_status_completed: 'Completed',
    tasks_btn_upload_key: 'Upload key',
    tasks_btn_repair: 'Report issue',
    tasks_btn_complete: 'Complete',
    repair_title: 'Report Issue',
    repair_field_type: 'Issue type',
    repair_field_desc: 'Description',
    repair_field_urgency: 'Urgency',
    repair_field_contact: 'Contact',
    repair_placeholder_desc: 'Describe the issue (max 500 chars)',
    repair_placeholder_contact: 'Phone / WeChat / Email',
    repair_submit: 'Submit',
    repair_success: 'Submitted',
    repair_failed: 'Submit failed',
    repair_error_type: 'Please choose issue type',
    repair_error_desc: 'Please enter description',
    repair_error_contact: 'Please enter contact',
    repair_type_plumbing: 'Plumbing',
    repair_type_electrical: 'Electrical',
    repair_type_appliance: 'Appliance',
    repair_type_internet: 'Internet',
    repair_type_other: 'Other',
    repair_urgency_low: 'Low',
    repair_urgency_medium: 'Medium',
    repair_urgency_high: 'High',
    complete_title: 'Complete Task',
    complete_supplies: 'Supplies refill',
    complete_note: 'Notes',
    complete_note_placeholder: 'Notes (max 500 chars)',
    complete_submit: 'Confirm',
    complete_success: 'Completed',
    complete_failed: 'Complete failed',
    complete_error_required: 'Select at least one item or enter notes',
    supplies_shampoo: 'Shampoo',
    supplies_bodywash: 'Body wash',
    supplies_conditioner: 'Conditioner',
    supplies_handsoap: 'Hand soap',
    supplies_tissue: 'Tissues',
    supplies_toiletpaper: 'Toilet paper',
    supplies_detergent: 'Detergent',
    supplies_trashbag: 'Trash bags',
  },
} as const

type Key = keyof typeof dictionary.zh

type I18nContextValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: Key) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider(props: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh')

  useEffect(() => {
    ;(async () => {
      const saved = await getJson<Locale>(LOCALE_STORAGE_KEY)
      if (saved === 'zh' || saved === 'en') setLocaleState(saved)
    })()
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    setJson(LOCALE_STORAGE_KEY, l).catch(() => {})
  }, [])

  const t = useCallback(
    (key: Key) => {
      const table = dictionary[locale] || dictionary.zh
      return table[key] || dictionary.zh[key] || key
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
