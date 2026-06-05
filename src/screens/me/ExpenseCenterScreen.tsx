import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Dimensions, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect } from '@react-navigation/native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import {
  createMzappExpenseReceipt,
  deleteMyMzappExpenseReceipt,
  getMyMzappExpenseReceipt,
  getMzappExpenseReceiptBootstrap,
  listMyMzappExpenseReceipts,
  type MzappExpenseBootstrap,
  type MzappExpenseCategoryOption,
  type MzappExpensePropertyOption,
  type MzappExpenseReceiptDetail,
  type MzappExpenseReceiptItem,
  type MzappExpenseReceiptRecord,
  type MzappExpenseScope,
  updateMyMzappExpenseReceipt,
  uploadMzappExpenseReceiptImage,
} from '../../lib/api'
import { hasAnyPermission, hasPermission } from '../../lib/roles'
import { hairline, moderateScale } from '../../lib/scale'

type TabKey = 'create' | 'records'

type ReceiptItemForm = {
  local_id: string
  id?: string
  scope: MzappExpenseScope
  property_id: string
  expense_name: string
  amount: string
  category: string
  category_detail: string
  note: string
}

type ReceiptFormState = {
  receipt_date: string
  receipt_total_amount: string
  note: string
  receipt_urls: string[]
  items: ReceiptItemForm[]
}

const COMPANY_PERMS = {
  submit: 'cleaning_app.expense.company.submit',
  view: 'cleaning_app.expense.company.view.self',
  edit: 'cleaning_app.expense.company.edit.self',
  delete: 'cleaning_app.expense.company.delete.self',
}

const PROPERTY_PERMS = {
  submit: 'cleaning_app.expense.property.submit',
  view: 'cleaning_app.expense.property.view.self',
  edit: 'cleaning_app.expense.property.edit.self',
  delete: 'cleaning_app.expense.property.delete.self',
}

function todayYmd() {
  return dateToYmdLocal(new Date())
}

function makeLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function buildEmptyItem(scope: MzappExpenseScope): ReceiptItemForm {
  return {
    local_id: makeLocalId(),
    scope,
    property_id: '',
    expense_name: '',
    amount: '',
    category: '',
    category_detail: '',
    note: '',
  }
}

function buildEmptyForm(scope: MzappExpenseScope): ReceiptFormState {
  return {
    receipt_date: todayYmd(),
    receipt_total_amount: '',
    note: '',
    receipt_urls: [],
    items: [buildEmptyItem(scope)],
  }
}

function normalizeAmountInput(raw: string) {
  const cleaned = String(raw || '').replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot < 0) return cleaned
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`
}

function moneyToCents(raw: string | number | null | undefined) {
  const value = typeof raw === 'number' ? raw : Number(String(raw || '').trim() || 0)
  return Math.round(value * 100)
}

function formatCurrency(amount?: number | string | null) {
  const value = typeof amount === 'number' ? amount : Number(String(amount || '').trim() || 0)
  return `$${value.toFixed(2)}`
}

function scopeLabel(scope: MzappExpenseScope) {
  return scope === 'company' ? '公司' : '房源'
}

function isValidYmd(raw: string) {
  const text = String(raw || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const [yearRaw, monthRaw, dayRaw] = text.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!(year >= 2000 && year <= 2100)) return false
  if (!(month >= 1 && month <= 12)) return false
  if (!(day >= 1 && day <= daysInMonth(year, month))) return false
  return true
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function dateToYmdLocal(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseYmdToDate(raw: string) {
  const text = String(raw || '').trim()
  if (!isValidYmd(text)) return new Date()
  const [yearRaw, monthRaw, dayRaw] = text.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  return new Date(year, Math.max(0, month - 1), Math.max(1, day))
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function normalizeDateParts(year: number, month: number, day: number) {
  const safeMonth = Math.min(12, Math.max(1, month))
  const safeDay = Math.min(daysInMonth(year, safeMonth), Math.max(1, day))
  return { year, month: safeMonth, day: safeDay }
}

function ymdFromParts(year: number, month: number, day: number) {
  const normalized = normalizeDateParts(year, month, day)
  return `${normalized.year}-${pad2(normalized.month)}-${pad2(normalized.day)}`
}

function displayDate(raw: string | null | undefined) {
  const text = String(raw || '').trim()
  if (!isValidYmd(text)) return '--'
  const [year, month, day] = text.split('-')
  return `${day}-${month}-${year}`
}

function propertyLine(item: { code?: string | null; region?: string | null; address?: string | null }) {
  const head = [String(item.region || '').trim(), String(item.code || '').trim()].filter(Boolean).join(' · ')
  const address = String(item.address || '').trim()
  return address ? `${head}${head ? ' · ' : ''}${address}` : head || '-'
}

function propertyCodeOnly(item: { code?: string | null; address?: string | null; id?: string | null }) {
  return String(item.code || '').trim() || String(item.address || '').trim() || String(item.id || '').trim() || '-'
}

function findPropertyById(properties: MzappExpensePropertyOption[], propertyId?: string | null) {
  return properties.find((item) => String(item.id || '') === String(propertyId || '')) || null
}

function findCategoryOption(options: MzappExpenseCategoryOption[], value?: string | null) {
  return options.find((item) => String(item.value || '') === String(value || '')) || null
}

function mapDetailToForm(detail: MzappExpenseReceiptDetail): ReceiptFormState {
  const items = Array.isArray(detail.items) ? detail.items : []
  return {
    receipt_date: String(detail.receipt_date || '').slice(0, 10) || todayYmd(),
    receipt_total_amount: String(detail.receipt_total_amount != null ? detail.receipt_total_amount : ''),
    note: String(detail.note || ''),
    receipt_urls: Array.isArray(detail.images) ? detail.images.map((item) => String(item.url || '').trim()).filter(Boolean) : [],
    items: items.length
      ? items.map((item) => ({
          local_id: makeLocalId(),
          id: String(item.id || '').trim() || undefined,
          scope: item.scope === 'property' ? 'property' : 'company',
          property_id: String(item.property_id || ''),
          expense_name: String(item.expense_name || ''),
          amount: String(item.amount != null ? item.amount : ''),
          category: String(item.category || ''),
          category_detail: String(item.category_detail || ''),
          note: String(item.note || ''),
        }))
      : [buildEmptyItem('company')],
  }
}

function detailTitle(detail: MzappExpenseReceiptDetail | null) {
  if (!detail) return '支出详情'
  return `${String(detail.scope_summary || '支出')} · ${formatCurrency(detail.receipt_total_amount)}`
}

export default function ExpenseCenterScreen() {
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [activeTab, setActiveTab] = useState<TabKey>('create')
  const [bootstrap, setBootstrap] = useState<MzappExpenseBootstrap | null>(null)
  const [bootstrapLoading, setBootstrapLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [records, setRecords] = useState<MzappExpenseReceiptRecord[]>([])
  const [form, setForm] = useState<ReceiptFormState>(() => buildEmptyForm('company'))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<MzappExpenseReceiptDetail | null>(null)
  const [propertyPickerTarget, setPropertyPickerTarget] = useState<number | null>(null)
  const [propertyQuery, setPropertyQuery] = useState('')
  const [categoryPickerTarget, setCategoryPickerTarget] = useState<number | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteChecked, setDeleteChecked] = useState(false)
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null)
  const [imageViewerSize, setImageViewerSize] = useState<{ width: number; height: number } | null>(null)
  const [imageViewerSession, setImageViewerSession] = useState(0)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [dateDraft, setDateDraft] = useState(() => {
    const date = parseYmdToDate(todayYmd())
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    }
  })

  const canUseExpenses = useMemo(
    () =>
      hasAnyPermission(user, [
        COMPANY_PERMS.submit,
        COMPANY_PERMS.view,
        COMPANY_PERMS.edit,
        COMPANY_PERMS.delete,
        PROPERTY_PERMS.submit,
        PROPERTY_PERMS.view,
        PROPERTY_PERMS.edit,
        PROPERTY_PERMS.delete,
      ]),
    [user],
  )

  const allowedScopes = useMemo(() => {
    const scopes = Array.isArray(bootstrap?.scopes) ? bootstrap?.scopes || [] : []
    return scopes.filter((scope) => scope === 'company' || scope === 'property')
  }, [bootstrap])

  const canSubmitScope = useCallback(
    (scope: MzappExpenseScope) => hasPermission(user, scope === 'company' ? COMPANY_PERMS.submit : PROPERTY_PERMS.submit),
    [user],
  )

  const canViewScope = useCallback(
    (scope: MzappExpenseScope) => hasPermission(user, scope === 'company' ? COMPANY_PERMS.view : PROPERTY_PERMS.view),
    [user],
  )

  const canEditScope = useCallback(
    (scope: MzappExpenseScope) => hasPermission(user, scope === 'company' ? COMPANY_PERMS.edit : PROPERTY_PERMS.edit),
    [user],
  )

  const canDeleteScope = useCallback(
    (scope: MzappExpenseScope) => hasPermission(user, scope === 'company' ? COMPANY_PERMS.delete : PROPERTY_PERMS.delete),
    [user],
  )

  const createScopes = useMemo(() => allowedScopes.filter((scope) => canSubmitScope(scope)), [allowedScopes, canSubmitScope])
  const editableScopes = useMemo(
    () => allowedScopes.filter((scope) => canSubmitScope(scope) || canEditScope(scope)),
    [allowedScopes, canEditScope, canSubmitScope],
  )

  const propertyOptions = useMemo(() => bootstrap?.properties || [], [bootstrap])

  const filteredProperties = useMemo(() => {
    const q = String(propertyQuery || '').trim().toLowerCase()
    if (!q) return propertyOptions
    return propertyOptions.filter((item) => `${item.region || ''} ${item.code || ''} ${item.address || ''}`.toLowerCase().includes(q))
  }, [propertyOptions, propertyQuery])

  const currentItemForPropertyPicker = propertyPickerTarget == null ? null : form.items[propertyPickerTarget] || null
  const currentItemForCategoryPicker = categoryPickerTarget == null ? null : form.items[categoryPickerTarget] || null
  const currentCategoryOptions = useMemo(() => {
    const scope = currentItemForCategoryPicker?.scope
    if (!scope) return []
    return (bootstrap?.categories?.[scope] || []).filter((item) => String(item?.value || '').trim())
  }, [bootstrap, currentItemForCategoryPicker?.scope])

  const canCreateAny = createScopes.length > 0
  const canViewAny = allowedScopes.some((scope) => canViewScope(scope))

  const lineTotalCents = useMemo(() => form.items.reduce((sum, item) => sum + moneyToCents(item.amount), 0), [form.items])
  const receiptTotalCents = useMemo(() => moneyToCents(form.receipt_total_amount), [form.receipt_total_amount])
  const diffCents = receiptTotalCents - lineTotalCents

  const canEditCurrentDetail = useMemo(() => {
    if (!detail) return false
    const scopes = Array.from(new Set((detail.items || []).map((item) => item.scope)))
    return scopes.length > 0 && scopes.every((scope) => canEditScope(scope))
  }, [canEditScope, detail])

  const canDeleteCurrentDetail = useMemo(() => {
    if (!detail) return false
    const scopes = Array.from(new Set((detail.items || []).map((item) => item.scope)))
    return scopes.length > 0 && scopes.every((scope) => canDeleteScope(scope))
  }, [canDeleteScope, detail])

  const resetForm = useCallback(
    (scope?: MzappExpenseScope) => {
      const baseScope = scope || createScopes[0] || allowedScopes[0] || 'company'
      setEditingId(null)
      setForm(buildEmptyForm(baseScope))
    },
    [allowedScopes, createScopes],
  )

  useEffect(() => {
    if (!canCreateAny && canViewAny && activeTab === 'create') setActiveTab('records')
  }, [activeTab, canCreateAny, canViewAny])

  useEffect(() => {
    if (!allowedScopes.length) return
    setForm((prev) => {
      let changed = false
      const nextItems = prev.items.map((item, index) => {
        if (editableScopes.includes(item.scope)) return item
        changed = true
        const fallbackScope = editingId ? editableScopes[0] || item.scope : createScopes[0] || editableScopes[0] || item.scope
        return {
          ...item,
          scope: fallbackScope,
          property_id: fallbackScope === 'property' ? item.property_id : '',
          category: '',
          category_detail: '',
        }
      })
      if (!changed) return prev
      return { ...prev, items: nextItems.length ? nextItems : [buildEmptyItem(createScopes[0] || editableScopes[0] || 'company')] }
    })
  }, [allowedScopes, createScopes, editableScopes, editingId])

  const loadBootstrap = useCallback(async () => {
    if (!token || !canUseExpenses) return
    setBootstrapLoading(true)
    try {
      const data = await getMzappExpenseReceiptBootstrap(token)
      setBootstrap(data)
    } catch (e: any) {
      Alert.alert('加载失败', String(e?.message || '初始化失败'))
    } finally {
      setBootstrapLoading(false)
    }
  }, [canUseExpenses, token])

  const loadRecords = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !canUseExpenses) return
      if (!opts?.silent) setRecordsLoading(true)
      try {
        const data = await listMyMzappExpenseReceipts(token, { limit: 100 })
        setRecords(Array.isArray(data?.items) ? data.items : [])
      } catch (e: any) {
        if (!opts?.silent) Alert.alert('加载失败', String(e?.message || '记录加载失败'))
      } finally {
        if (!opts?.silent) setRecordsLoading(false)
      }
    },
    [canUseExpenses, token],
  )

  useFocusEffect(
    useCallback(() => {
      let alive = true
      ;(async () => {
        if (!token || !canUseExpenses) return
        await loadBootstrap()
        if (!alive) return
        await loadRecords()
      })()
      return () => {
        alive = false
      }
    }, [canUseExpenses, loadBootstrap, loadRecords, token]),
  )

  const onRefresh = useCallback(async () => {
    if (!token || !canUseExpenses) return
    setRefreshing(true)
    try {
      await loadBootstrap()
      await loadRecords({ silent: true })
    } finally {
      setRefreshing(false)
    }
  }, [canUseExpenses, loadBootstrap, loadRecords, token])

  const patchForm = useCallback((patch: Partial<ReceiptFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const closeImageViewer = useCallback(() => {
    setImageViewerUrl(null)
    setImageViewerSize(null)
    setImageViewerSession((prev) => prev + 1)
  }, [])

  const openImageViewer = useCallback((url: string) => {
    const nextUrl = String(url || '').trim()
    if (!nextUrl) return
    Image.prefetch(nextUrl).catch(() => undefined)
    setImageViewerSize(null)
    setImageViewerSession((prev) => prev + 1)
    setImageViewerUrl(nextUrl)
  }, [])

  const patchItem = useCallback((index: number, patch: Partial<ReceiptItemForm>) => {
    setForm((prev) => {
      const nextItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const next = { ...item, ...patch }
        if (patch.scope && patch.scope !== item.scope) {
          next.property_id = patch.scope === 'property' ? next.property_id : ''
          next.category = ''
          next.category_detail = ''
        }
        if (patch.category && patch.category !== 'other') next.category_detail = ''
        return next
      })
      return { ...prev, items: nextItems }
    })
  }, [])

  const addItem = useCallback(() => {
    const baseScope = editingId ? editableScopes[0] || createScopes[0] || 'company' : createScopes[0] || editableScopes[0] || 'company'
    setForm((prev) => ({ ...prev, items: [...prev.items, buildEmptyItem(baseScope)] }))
  }, [createScopes, editableScopes, editingId])

  const removeItem = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.items.length <= 1) return prev
      return { ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }
    })
  }, [])

  const pickReceiptPhoto = useCallback(async () => {
    if (uploading || !token) return
    try {
      if (form.receipt_urls.length >= 5) {
        Alert.alert('最多 5 张', '一张发票最多上传 5 张图片。')
        return
      }
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('需要相机权限', '请允许相机权限后再拍照上传。')
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      const uri = String(asset.uri || '').trim()
      if (!uri) return
      setUploading(true)
      const uploaded = await uploadMzappExpenseReceiptImage(token, {
        uri,
        name: asset.fileName || `receipt-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      })
      setForm((prev) => ({ ...prev, receipt_urls: [...prev.receipt_urls, String(uploaded.url || '').trim()].filter(Boolean).slice(0, 5) }))
    } catch (e: any) {
      Alert.alert('上传失败', String(e?.message || '发票照片上传失败'))
    } finally {
      setUploading(false)
    }
  }, [form.receipt_urls.length, token, uploading])

  const pickReceiptPhotoFromLibrary = useCallback(async () => {
    if (uploading || !token) return
    try {
      if (form.receipt_urls.length >= 5) {
        Alert.alert('最多 5 张', '一张发票最多上传 5 张图片。')
        return
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('需要相册权限', '请允许相册权限后再选择图片。')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      })
      if (result.canceled || !result.assets?.length) return
      const asset = result.assets[0]
      const uri = String(asset.uri || '').trim()
      if (!uri) return
      setUploading(true)
      const uploaded = await uploadMzappExpenseReceiptImage(token, {
        uri,
        name: asset.fileName || `receipt-${Date.now()}.jpg`,
        mimeType: asset.mimeType || 'image/jpeg',
      })
      setForm((prev) => ({ ...prev, receipt_urls: [...prev.receipt_urls, String(uploaded.url || '').trim()].filter(Boolean).slice(0, 5) }))
    } catch (e: any) {
      Alert.alert('上传失败', String(e?.message || '发票照片上传失败'))
    } finally {
      setUploading(false)
    }
  }, [form.receipt_urls.length, token, uploading])

  const removeReceiptPhoto = useCallback((url: string) => {
    setForm((prev) => ({ ...prev, receipt_urls: prev.receipt_urls.filter((item) => item !== url) }))
  }, [])

  const validateAndBuildPayload = useCallback(() => {
    if (!isValidYmd(form.receipt_date)) throw new Error('请选择正确的发票日期')
    if (!form.receipt_urls.length) throw new Error('请至少上传 1 张发票照片')
    if (!form.items.length) throw new Error('请至少添加 1 条明细')
    const total = Number(form.receipt_total_amount || 0)
    if (!(total > 0)) throw new Error('请填写发票总金额')
    const payloadItems = form.items.map((item) => {
      const amount = Number(item.amount || 0)
      if (!String(item.expense_name || '').trim()) throw new Error('请填写每条明细的支出名称')
      if (!(amount > 0)) throw new Error('请填写每条明细的金额')
      if (!String(item.category || '').trim()) throw new Error('请为每条明细选择类别')
      if (item.scope === 'property' && !String(item.property_id || '').trim()) throw new Error('房源支出必须选择房源')
      if (item.scope === 'company' && String(item.property_id || '').trim()) throw new Error('公司支出不能绑定房源')
      if (item.category === 'other' && !String(item.category_detail || '').trim()) throw new Error('“其他”类别需要填写说明')
      return {
        ...(item.id ? { id: item.id } : {}),
        scope: item.scope,
        property_id: item.scope === 'property' ? String(item.property_id || '').trim() : undefined,
        expense_name: String(item.expense_name || '').trim(),
        amount: Number(amount.toFixed(2)),
        category: String(item.category || '').trim(),
        category_detail: item.category === 'other' ? String(item.category_detail || '').trim() : undefined,
        note: String(item.note || '').trim() || undefined,
      }
    })
    const itemTotalCents = payloadItems.reduce((sum, item) => sum + moneyToCents(item.amount), 0)
    if (itemTotalCents !== moneyToCents(total)) throw new Error('明细金额合计必须等于发票总金额')
    return {
      receipt_date: String(form.receipt_date || '').trim(),
      receipt_total_amount: Number(total.toFixed(2)),
      note: String(form.note || '').trim() || undefined,
      receipt_urls: form.receipt_urls,
      items: payloadItems,
    }
  }, [form])

  const submit = useCallback(async () => {
    if (!token || saving) return
    if (!canCreateAny && !editingId) {
      Alert.alert('权限不足', '你当前没有可提交的支出权限。')
      return
    }
    try {
      const payload = validateAndBuildPayload()
      setSaving(true)
      if (editingId) {
        await updateMyMzappExpenseReceipt(token, editingId, payload)
        Alert.alert('已保存', '发票和明细已更新。')
      } else {
        await createMzappExpenseReceipt(token, payload)
        Alert.alert('已提交', '支出发票已保存。')
      }
      resetForm()
      setActiveTab('records')
      await loadRecords({ silent: true })
    } catch (e: any) {
      Alert.alert('提交失败', String(e?.message || '提交失败'))
    } finally {
      setSaving(false)
    }
  }, [canCreateAny, editingId, loadRecords, resetForm, saving, token, validateAndBuildPayload])

  const openDetail = useCallback(
    async (record: MzappExpenseReceiptRecord) => {
      if (!token) return
      try {
        setDetailLoading(true)
        setDetailOpen(true)
        const data = await getMyMzappExpenseReceipt(token, record.id)
        setDetail(data)
      } catch (e: any) {
        setDetailOpen(false)
        Alert.alert('加载失败', String(e?.message || '详情加载失败'))
      } finally {
        setDetailLoading(false)
      }
    },
    [token],
  )

  const startEdit = useCallback(
    (receipt: MzappExpenseReceiptDetail) => {
      setDetailOpen(false)
      setDetail(null)
      setEditingId(receipt.id)
      setForm(mapDetailToForm(receipt))
      setActiveTab('create')
    },
    [],
  )

  const confirmDelete = useCallback(async () => {
    if (!token || !detail || deleting) return
    if (!deleteChecked) {
      Alert.alert('请先确认', '请先勾选确认后再删除。')
      return
    }
    try {
      setDeleting(true)
      await deleteMyMzappExpenseReceipt(token, detail.id)
      setDeleteConfirmOpen(false)
      setDeleteChecked(false)
      setDetailOpen(false)
      setDetail(null)
      await loadRecords({ silent: true })
      Alert.alert('已删除', '这张发票及其明细已从 App 中移除。')
    } catch (e: any) {
      Alert.alert('删除失败', String(e?.message || '删除失败'))
    } finally {
      setDeleting(false)
    }
  }, [deleteChecked, deleting, detail, loadRecords, token])

  useEffect(() => {
    if (!imageViewerUrl) {
      setImageViewerSize(null)
      return
    }
    let cancelled = false
    Image.getSize(
      imageViewerUrl,
      (width, height) => {
        if (cancelled) return
        setImageViewerSize({ width, height })
      },
      () => {
        if (cancelled) return
        setImageViewerSize(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [imageViewerUrl])

  useEffect(() => {
    const urls = Array.isArray(detail?.images) ? detail.images.map((item) => String(item?.url || '').trim()).filter(Boolean) : []
    if (!urls.length) return
    urls.forEach((url) => {
      Image.prefetch(url).catch(() => undefined)
    })
  }, [detail])

  const viewerLayout = useMemo(() => {
    const win = Dimensions.get('window')
    const frameWidth = Math.max(220, win.width - moderateScale(24))
    const frameHeight = Math.max(280, win.height - moderateScale(170))
    if (!imageViewerSize?.width || !imageViewerSize?.height) {
      return {
        frameWidth,
        frameHeight,
        imageWidth: frameWidth,
        imageHeight: frameHeight,
      }
    }
    const ratio = imageViewerSize.width / imageViewerSize.height
    let baseWidth = frameWidth
    let baseHeight = baseWidth / ratio
    if (baseHeight > frameHeight) {
      baseHeight = frameHeight
      baseWidth = baseHeight * ratio
    }
    return {
      frameWidth,
      frameHeight,
      imageWidth: baseWidth,
      imageHeight: baseHeight,
    }
  }, [imageViewerSize])

  const datePickerYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 13 }, (_, index) => currentYear - 10 + index)
  }, [])

  const datePickerDays = useMemo(
    () => Array.from({ length: daysInMonth(dateDraft.year, dateDraft.month) }, (_, index) => index + 1),
    [dateDraft.month, dateDraft.year],
  )

  if (!canUseExpenses) {
    return (
      <View style={styles.centerState}>
        <Ionicons name="lock-closed-outline" size={32} color="#6b7280" />
        <Text style={styles.stateTitle}>没有可用权限</Text>
        <Text style={styles.stateText}>当前账号没有支出录入相关权限。</Text>
      </View>
    )
  }

  const renderItemCard = (item: ReceiptItemForm, index: number) => {
    const property = findPropertyById(propertyOptions, item.property_id)
    const categoryOptions = (bootstrap?.categories?.[item.scope] || []).filter((entry) => String(entry?.value || '').trim())
    const selectedCategory = findCategoryOption(categoryOptions, item.category)
    const allowedLineScopes = editingId ? editableScopes : createScopes
    const showScopeSelector = allowedLineScopes.length > 1
    return (
      <View key={item.local_id} style={styles.lineCard}>
        <View style={styles.lineHeader}>
          <Text style={styles.lineTitle}>明细 {index + 1}</Text>
          {form.items.length > 1 ? (
            <Pressable onPress={() => removeItem(index)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color="#dc2626" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>支出名称</Text>
          <TextInput
            value={item.expense_name}
            onChangeText={(value) => patchItem(index, { expense_name: value })}
            placeholder="例如：清洁用品"
            style={styles.input}
          />
        </View>
        <View style={styles.fieldRow}>
          <View style={[styles.fieldBlock, styles.fieldHalf]}>
            <Text style={styles.label}>金额</Text>
            <TextInput
              value={item.amount}
              onChangeText={(value) => patchItem(index, { amount: normalizeAmountInput(value) })}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={[styles.fieldBlock, styles.fieldHalf]}>
            <Text style={styles.label}>支出类型</Text>
            {showScopeSelector ? (
              <View style={styles.scopeSelectorRow}>
                {allowedLineScopes.map((scope) => {
                  const selected = item.scope === scope
                  return (
                    <Pressable
                      key={`${item.local_id}_${scope}`}
                      onPress={() => patchItem(index, { scope })}
                      style={[styles.scopePill, selected ? styles.scopePillActive : null]}
                    >
                      <Text style={[styles.scopePillText, selected ? styles.scopePillTextActive : null]}>{scopeLabel(scope)}</Text>
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              <View style={styles.readonlySelector}>
                <Text style={styles.readonlySelectorText}>{scopeLabel(item.scope)}</Text>
              </View>
            )}
          </View>
        </View>
        {item.scope === 'property' ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>房源</Text>
            <Pressable onPress={() => { setPropertyQuery(''); setPropertyPickerTarget(index) }} style={styles.selector}>
              <Text style={property ? styles.selectorText : styles.selectorPlaceholder}>{property ? propertyCodeOnly(property) : '选择房号'}</Text>
              <Ionicons name="chevron-down" size={18} color="#6b7280" />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>类别</Text>
          <Pressable onPress={() => setCategoryPickerTarget(index)} style={styles.selector}>
            <Text style={selectedCategory ? styles.selectorText : styles.selectorPlaceholder}>{selectedCategory ? selectedCategory.label : '选择类别'}</Text>
            <Ionicons name="chevron-down" size={18} color="#6b7280" />
          </Pressable>
        </View>
        {item.category === 'other' ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>其他类别说明</Text>
            <TextInput
              value={item.category_detail}
              onChangeText={(value) => patchItem(index, { category_detail: value })}
              placeholder="填写说明"
              style={styles.input}
            />
          </View>
        ) : null}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>备注</Text>
          <TextInput
            value={item.note}
            onChangeText={(value) => patchItem(index, { note: value })}
            placeholder="可选"
            multiline
            style={[styles.input, styles.multilineInput]}
          />
        </View>
      </View>
    )
  }

  const renderCreateTab = () => (
    <View style={styles.sectionStack}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>发票信息</Text>
          {editingId ? <Text style={styles.sectionHint}>正在编辑已有记录</Text> : null}
        </View>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>发票照片</Text>
          <View style={styles.photoActionRow}>
            <Pressable onPress={pickReceiptPhoto} style={styles.primaryAction} disabled={uploading}>
              <Ionicons name="camera-outline" size={16} color="#fff" />
              <Text style={styles.primaryActionText}>{uploading ? '上传中...' : '拍照上传'}</Text>
            </Pressable>
            <Pressable onPress={pickReceiptPhotoFromLibrary} style={styles.secondaryAction} disabled={uploading}>
              <Ionicons name="images-outline" size={16} color="#1d4ed8" />
              <Text style={styles.secondaryActionText}>从相册选择</Text>
            </Pressable>
          </View>
          {form.receipt_urls.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
              {form.receipt_urls.map((url) => (
                <View key={url} style={styles.photoCard}>
                  <Pressable onPressIn={() => openImageViewer(url)} hitSlop={8}>
                    <Image source={{ uri: url }} style={styles.photoThumb as any} />
                  </Pressable>
                  <Pressable onPress={() => removeReceiptPhoto(url)} style={styles.photoRemove}>
                    <Ionicons name="close-circle" size={20} color="#dc2626" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.helperText}>最多 5 张，点击缩略图可放大查看。</Text>
          )}
          <Text style={styles.helperText}>仅上传照片不会进入“我的记录”，提交整张发票后才会显示。</Text>
        </View>
        <View style={styles.fieldRow}>
          <View style={[styles.fieldBlock, styles.fieldHalf]}>
            <Text style={styles.label}>发票日期</Text>
            <Pressable
              onPress={() => {
                const date = parseYmdToDate(form.receipt_date)
                setDateDraft({
                  year: date.getFullYear(),
                  month: date.getMonth() + 1,
                  day: date.getDate(),
                })
                setDatePickerOpen(true)
              }}
              style={styles.selector}
            >
              <Text style={styles.selectorText}>{displayDate(form.receipt_date)}</Text>
              <Ionicons name="calendar-outline" size={18} color="#6b7280" />
            </Pressable>
          </View>
          <View style={[styles.fieldBlock, styles.fieldHalf]}>
            <Text style={styles.label}>发票总金额</Text>
            <TextInput
              value={form.receipt_total_amount}
              onChangeText={(value) => patchForm({ receipt_total_amount: normalizeAmountInput(value) })}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>备注</Text>
          <TextInput
            value={form.note}
            onChangeText={(value) => patchForm({ note: value })}
            placeholder="发票整体备注，可选"
            multiline
            style={[styles.input, styles.multilineInput]}
          />
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>明细列表</Text>
          <Pressable onPress={addItem} style={styles.inlineAction}>
            <Ionicons name="add-circle-outline" size={16} color="#1d4ed8" />
            <Text style={styles.inlineActionText}>新增明细</Text>
          </Pressable>
        </View>
        {form.items.map(renderItemCard)}
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>提交校验</Text>
          <Text style={[styles.summaryPill, diffCents === 0 ? styles.summaryBalanced : styles.summaryPending]}>
            {diffCents === 0 ? '已对平' : '未对平'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>明细合计</Text>
          <Text style={styles.summaryValue}>{formatCurrency(lineTotalCents / 100)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>发票总金额</Text>
          <Text style={styles.summaryValue}>{formatCurrency(receiptTotalCents / 100)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>未分配金额</Text>
          <Text style={[styles.summaryValue, diffCents === 0 ? styles.goodText : styles.warnText]}>{formatCurrency(diffCents / 100)}</Text>
        </View>
        <Text style={styles.helperText}>只有当明细金额合计等于发票总金额时，才允许提交。</Text>
        <View style={styles.footerActions}>
          <Pressable onPress={() => resetForm()} style={styles.secondaryWideAction}>
            <Text style={styles.secondaryWideActionText}>重置</Text>
          </Pressable>
          <Pressable onPress={submit} style={[styles.primaryWideAction, saving ? styles.actionDisabled : null]} disabled={saving}>
            <Text style={styles.primaryWideActionText}>{saving ? '保存中...' : editingId ? '保存修改' : '提交发票'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )

  const renderRecordsTab = () => {
    if (recordsLoading && !records.length) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#1d4ed8" />
          <Text style={styles.stateText}>正在加载记录...</Text>
        </View>
      )
    }
    if (!records.length) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="receipt-outline" size={32} color="#6b7280" />
          <Text style={styles.stateTitle}>还没有发票记录</Text>
          <Text style={styles.stateText}>上传第一张发票后，就会在这里看到拆分后的记录。</Text>
        </View>
      )
    }
    return (
      <View style={styles.sectionStack}>
        {records.map((record) => (
          <Pressable key={record.id} onPress={() => openDetail(record)} style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View style={styles.recordHeaderMain}>
                <Text style={styles.recordAmount}>{formatCurrency(record.receipt_total_amount)}</Text>
                <Text style={styles.recordScope}>{record.scope_summary || '支出'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </View>
            <View style={styles.recordMetaRow}>
              <Text style={styles.recordMeta}>日期 {displayDate(record.receipt_date)}</Text>
              <Text style={styles.recordMeta}>明细 {Number(record.item_count || 0)} 条</Text>
            </View>
            {record.first_image_url ? <Image source={{ uri: record.first_image_url }} style={styles.recordImage as any} /> : null}
            {record.note ? <Text style={styles.recordNote}>{record.note}</Text> : null}
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1d4ed8" />}
      >
        <View style={styles.tabRow}>
          {canCreateAny ? (
            <Pressable onPress={() => setActiveTab('create')} style={[styles.tabPill, activeTab === 'create' ? styles.tabPillActive : null]}>
              <Text style={[styles.tabPillText, activeTab === 'create' ? styles.tabPillTextActive : null]}>{editingId ? '编辑支出' : '新建支出'}</Text>
            </Pressable>
          ) : null}
          {canViewAny ? (
            <Pressable onPress={() => setActiveTab('records')} style={[styles.tabPill, activeTab === 'records' ? styles.tabPillActive : null]}>
              <Text style={[styles.tabPillText, activeTab === 'records' ? styles.tabPillTextActive : null]}>我的记录</Text>
            </Pressable>
          ) : null}
        </View>

        {bootstrapLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.stateText}>正在加载支出配置...</Text>
          </View>
        ) : activeTab === 'create' ? (
          canCreateAny ? renderCreateTab() : (
            <View style={styles.centerState}>
              <Ionicons name="lock-closed-outline" size={32} color="#6b7280" />
              <Text style={styles.stateTitle}>没有提交权限</Text>
              <Text style={styles.stateText}>当前账号只能查看自己记录，不能新增支出。</Text>
            </View>
          )
        ) : renderRecordsTab()}
      </ScrollView>

      <Modal visible={propertyPickerTarget != null} animationType="slide" onRequestClose={() => setPropertyPickerTarget(null)}>
        <SafeAreaView style={styles.modalPage} edges={['left', 'right', 'bottom']}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, moderateScale(12)) }]}>
            <Text style={styles.modalTitle}>选择房源</Text>
            <Pressable onPress={() => setPropertyPickerTarget(null)} hitSlop={12} style={styles.modalCloseButton}>
              <Ionicons name="close" size={22} color="#111827" />
            </Pressable>
          </View>
          <TextInput
            value={propertyQuery}
            onChangeText={setPropertyQuery}
            placeholder="搜索区域、房号或地址"
            style={styles.searchInput}
          />
          <ScrollView contentContainerStyle={styles.modalList}>
            {filteredProperties.map((property) => {
              const selected = String(currentItemForPropertyPicker?.property_id || '') === String(property.id || '')
              return (
                <Pressable
                  key={property.id}
                  onPress={() => {
                    if (propertyPickerTarget != null) patchItem(propertyPickerTarget, { property_id: property.id })
                    setPropertyPickerTarget(null)
                  }}
                  style={[styles.modalOption, selected ? styles.modalOptionActive : null]}
                >
                  <Text style={[styles.modalOptionTitle, selected ? styles.modalOptionTitleActive : null]}>{property.code || property.id}</Text>
                </Pressable>
              )
            })}
            {!filteredProperties.length ? <Text style={styles.emptyInlineText}>没有匹配的房源。</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal transparent visible={categoryPickerTarget != null} animationType="fade" onRequestClose={() => setCategoryPickerTarget(null)}>
        <Pressable style={[styles.overlay, styles.overlayBottom]} onPress={() => setCategoryPickerTarget(null)}>
          <Pressable style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, moderateScale(22)) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>选择类别</Text>
              <Pressable onPress={() => setCategoryPickerTarget(null)} hitSlop={12} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color="#111827" />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
              {currentCategoryOptions.map((option) => {
                const selected = String(currentItemForCategoryPicker?.category || '') === String(option.value || '')
                return (
                  <Pressable
                    key={`${currentItemForCategoryPicker?.local_id || 'item'}_${option.value}`}
                    onPress={() => {
                      if (categoryPickerTarget != null) patchItem(categoryPickerTarget, { category: option.value })
                      setCategoryPickerTarget(null)
                    }}
                    style={[styles.sheetOption, selected ? styles.sheetOptionActive : null]}
                  >
                    <Text style={[styles.sheetOptionTitle, selected ? styles.sheetOptionTitleActive : null]}>{option.label}</Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            <Pressable onPress={() => setCategoryPickerTarget(null)} style={styles.sheetFooterButton}>
              <Text style={styles.sheetFooterButtonText}>关闭</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={datePickerOpen} animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
        <Pressable style={[styles.overlay, styles.overlayBottom]} onPress={() => setDatePickerOpen(false)}>
          <Pressable style={[styles.datePickerCard, { paddingBottom: Math.max(insets.bottom, moderateScale(22)) }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.datePickerHeader}>
              <Text style={styles.datePickerTitle}>选择发票日期</Text>
              <Text style={styles.datePickerValue}>{displayDate(ymdFromParts(dateDraft.year, dateDraft.month, dateDraft.day))}</Text>
            </View>
            <View style={styles.datePickerColumns}>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>日</Text>
                <ScrollView style={styles.datePickerScroll} contentContainerStyle={styles.datePickerList} showsVerticalScrollIndicator={false}>
                  {datePickerDays.map((day) => {
                    const selected = dateDraft.day === day
                    return (
                      <Pressable
                        key={`day_${day}`}
                        onPress={() => setDateDraft((prev) => ({ ...prev, day }))}
                        style={[styles.datePickerOption, selected ? styles.datePickerOptionActive : null]}
                      >
                        <Text style={[styles.datePickerOptionText, selected ? styles.datePickerOptionTextActive : null]}>{pad2(day)}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>月</Text>
                <ScrollView style={styles.datePickerScroll} contentContainerStyle={styles.datePickerList} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
                    const selected = dateDraft.month === month
                    return (
                      <Pressable
                        key={`month_${month}`}
                        onPress={() =>
                          setDateDraft((prev) => normalizeDateParts(prev.year, month, prev.day))
                        }
                        style={[styles.datePickerOption, selected ? styles.datePickerOptionActive : null]}
                      >
                        <Text style={[styles.datePickerOptionText, selected ? styles.datePickerOptionTextActive : null]}>{pad2(month)}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
              <View style={styles.datePickerColumn}>
                <Text style={styles.datePickerLabel}>年</Text>
                <ScrollView style={styles.datePickerScroll} contentContainerStyle={styles.datePickerList} showsVerticalScrollIndicator={false}>
                  {datePickerYears.map((year) => {
                    const selected = dateDraft.year === year
                    return (
                      <Pressable
                        key={`year_${year}`}
                        onPress={() =>
                          setDateDraft((prev) => normalizeDateParts(year, prev.month, prev.day))
                        }
                        style={[styles.datePickerOption, selected ? styles.datePickerOptionActive : null]}
                      >
                        <Text style={[styles.datePickerOptionText, selected ? styles.datePickerOptionTextActive : null]}>{year}</Text>
                      </Pressable>
                    )
                  })}
                </ScrollView>
              </View>
            </View>
            <View style={styles.datePickerActions}>
              <Pressable onPress={() => setDatePickerOpen(false)} style={styles.confirmCancel}>
                <Text style={styles.confirmCancelText}>取消</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  patchForm({ receipt_date: ymdFromParts(dateDraft.year, dateDraft.month, dateDraft.day) })
                  setDatePickerOpen(false)
                }}
                style={styles.primaryFooterAction}
              >
                <Text style={styles.primaryFooterActionText}>确认</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={detailOpen} animationType="slide" onRequestClose={() => { setDetailOpen(false); setDetail(null) }}>
        <SafeAreaView style={styles.modalPage} edges={['left', 'right', 'bottom']}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, moderateScale(12)) }]}>
            <Text style={styles.modalTitle} numberOfLines={1}>{detailTitle(detail)}</Text>
            <Pressable onPress={() => { setDetailOpen(false); setDetail(null) }} hitSlop={12} style={styles.modalCloseButton}>
              <Ionicons name="close" size={22} color="#111827" />
            </Pressable>
          </View>
          {detailLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="small" color="#1d4ed8" />
              <Text style={styles.stateText}>正在加载详情...</Text>
            </View>
          ) : detail ? (
            <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: moderateScale(16) + insets.bottom }]}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>发票信息</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>发票日期</Text>
                  <Text style={styles.summaryValue}>{displayDate(detail.receipt_date)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>总金额</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(detail.receipt_total_amount)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>支出范围</Text>
                  <Text style={styles.summaryValue}>{detail.scope_summary || '-'}</Text>
                </View>
                {detail.note ? (
                  <View style={styles.detailNoteBlock}>
                    <Text style={styles.label}>备注</Text>
                    <Text style={styles.detailNoteText}>{detail.note}</Text>
                  </View>
                ) : null}
                {detail.images?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
                    {detail.images.map((image) => (
                      <Pressable key={image.id} onPressIn={() => openImageViewer(String(image.url || ''))} hitSlop={8}>
                        <Image source={{ uri: image.url }} style={styles.photoThumb as any} />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
                {detail.images?.length ? <Text style={styles.helperText}>点击发票缩略图可放大查看。</Text> : null}
              </View>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>明细拆分</Text>
                {(detail.items || []).map((item, index) => {
                  const property = findPropertyById(propertyOptions, item.property_id)
                  const category = findCategoryOption((bootstrap?.categories?.[item.scope] || []).filter((entry) => String(entry?.value || '').trim()), item.category)
                  return (
                    <View key={item.id || `detail_item_${index}`} style={styles.detailLineCard}>
                      <View style={styles.detailLineHeader}>
                        <Text style={styles.lineTitle}>明细 {index + 1}</Text>
                        <Text style={styles.detailLineAmount}>{formatCurrency(item.amount)}</Text>
                      </View>
                      <Text style={styles.detailLineName}>{item.expense_name}</Text>
                      <Text style={styles.detailLineMeta}>{scopeLabel(item.scope)}</Text>
                      {item.scope === 'property' ? <Text style={styles.detailLineMeta}>{property ? propertyCodeOnly(property) : propertyCodeOnly({ code: item.property_code, address: item.property_address })}</Text> : null}
                      <Text style={styles.detailLineMeta}>{category ? category.label : item.category}</Text>
                      {item.category === 'other' && item.category_detail ? <Text style={styles.detailLineMeta}>说明：{item.category_detail}</Text> : null}
                      {item.note ? <Text style={styles.detailLineMeta}>备注：{item.note}</Text> : null}
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          ) : null}
          {detail && !detailLoading ? (
            <View style={[styles.detailFooter, { paddingBottom: Math.max(insets.bottom, moderateScale(16)) }]}>
              {canDeleteCurrentDetail ? (
                <Pressable onPress={() => { setDeleteChecked(false); setDeleteConfirmOpen(true) }} style={styles.dangerFooterAction}>
                  <Text style={styles.dangerFooterActionText}>删除记录</Text>
                </Pressable>
              ) : null}
              {canEditCurrentDetail ? (
                <Pressable onPress={() => startEdit(detail)} style={styles.primaryFooterAction}>
                  <Text style={styles.primaryFooterActionText}>编辑记录</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {detailOpen && imageViewerUrl ? (
            <View style={styles.overlayAbsolute}>
              <Pressable style={styles.overlayBackdrop} onPress={closeImageViewer} />
              <View style={styles.viewerShell}>
                <Pressable style={[styles.viewerClose, { top: insets.top + moderateScale(10) }]} onPress={closeImageViewer}>
                  <Ionicons name="close" size={22} color="#fff" />
                </Pressable>
                <ScrollView
                  key={`detail_viewer_${imageViewerSession}_${imageViewerUrl}`}
                  style={[styles.viewerFrame, { width: viewerLayout.frameWidth, height: viewerLayout.frameHeight }]}
                  contentContainerStyle={[styles.viewerFrameContent, { minWidth: viewerLayout.frameWidth, minHeight: viewerLayout.frameHeight }]}
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  bouncesZoom
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.viewerZoomContent}>
                    <Image
                      source={{ uri: imageViewerUrl }}
                      style={[
                        styles.viewerImage as any,
                        { width: viewerLayout.imageWidth, height: viewerLayout.imageHeight },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                </ScrollView>
                <Text style={styles.viewerHint}>双指捏合可放大缩小，放大后拖动画面查看局部。</Text>
              </View>
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>

      <Modal transparent visible={deleteConfirmOpen} animationType="fade" onRequestClose={() => setDeleteConfirmOpen(false)}>
        <Pressable style={[styles.overlay, styles.overlayCentered, { paddingTop: Math.max(insets.top, moderateScale(18)), paddingBottom: Math.max(insets.bottom, moderateScale(18)) }]} onPress={() => setDeleteConfirmOpen(false)}>
          <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.confirmTitle}>确认永久删除</Text>
            {detail ? (
              <>
                <Text style={styles.confirmBody}>{detail.scope_summary || '支出'} · {displayDate(detail.receipt_date)} · {formatCurrency(detail.receipt_total_amount)}</Text>
                <Text style={styles.confirmBody}>{Number(detail.item_count || 0)} 条明细</Text>
              </>
            ) : null}
            <Pressable onPress={() => setDeleteChecked((prev) => !prev)} style={styles.confirmCheckRow}>
              <Ionicons name={deleteChecked ? 'checkbox' : 'square-outline'} size={20} color={deleteChecked ? '#dc2626' : '#6b7280'} />
              <Text style={styles.confirmCheckText}>我确认删除后将无法在 App 中恢复</Text>
            </Pressable>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setDeleteConfirmOpen(false)} style={styles.confirmCancel}>
                <Text style={styles.confirmCancelText}>取消</Text>
              </Pressable>
              <Pressable onPress={confirmDelete} style={[styles.confirmDelete, (!deleteChecked || deleting) ? styles.actionDisabled : null]} disabled={!deleteChecked || deleting}>
                <Text style={styles.confirmDeleteText}>{deleting ? '删除中...' : '永久删除'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={!!imageViewerUrl && !detailOpen} animationType="fade" onRequestClose={closeImageViewer}>
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBackdrop} onPress={closeImageViewer} />
          <View style={styles.viewerShell}>
            <Pressable style={[styles.viewerClose, { top: insets.top + moderateScale(10) }]} onPress={closeImageViewer}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            {imageViewerUrl ? (
              <>
                <ScrollView
                  key={`viewer_${imageViewerSession}_${imageViewerUrl}`}
                  style={[styles.viewerFrame, { width: viewerLayout.frameWidth, height: viewerLayout.frameHeight }]}
                  contentContainerStyle={[styles.viewerFrameContent, { minWidth: viewerLayout.frameWidth, minHeight: viewerLayout.frameHeight }]}
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  bouncesZoom
                  centerContent
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.viewerZoomContent}>
                    <Image
                        source={{ uri: imageViewerUrl }}
                        style={[
                          styles.viewerImage as any,
                          { width: viewerLayout.imageWidth, height: viewerLayout.imageHeight },
                        ]}
                        resizeMode="contain"
                      />
                  </View>
                </ScrollView>
                <Text style={styles.viewerHint}>双指捏合可放大缩小，放大后拖动画面查看局部。</Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  contentContainer: {
    padding: moderateScale(16),
    paddingBottom: moderateScale(28),
    gap: moderateScale(14),
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(40),
    gap: moderateScale(10),
  },
  stateTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#111827',
  },
  stateText: {
    fontSize: moderateScale(13),
    color: '#6b7280',
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
  },
  tabPill: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
    borderRadius: moderateScale(999),
    borderWidth: hairline(),
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  tabPillActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  tabPillText: {
    color: '#374151',
    fontSize: moderateScale(13),
    fontWeight: '600',
    textAlign: 'center',
  },
  tabPillTextActive: {
    color: '#1d4ed8',
  },
  sectionStack: {
    gap: moderateScale(14),
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(18),
    padding: moderateScale(16),
    gap: moderateScale(12),
    borderWidth: hairline(),
    borderColor: '#e5e7eb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: moderateScale(12),
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#111827',
  },
  sectionHint: {
    fontSize: moderateScale(12),
    color: '#1d4ed8',
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
  },
  fieldHalf: {
    flex: 1,
    minWidth: moderateScale(130),
  },
  fieldBlock: {
    gap: moderateScale(6),
  },
  label: {
    fontSize: moderateScale(12),
    color: '#4b5563',
    fontWeight: '600',
  },
  input: {
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    borderWidth: hairline(),
    borderColor: '#d1d5db',
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(10),
    backgroundColor: '#fff',
    fontSize: moderateScale(14),
    color: '#111827',
  },
  multilineInput: {
    minHeight: moderateScale(80),
    textAlignVertical: 'top',
  },
  selector: {
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    borderWidth: hairline(),
    borderColor: '#d1d5db',
    paddingHorizontal: moderateScale(12),
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: moderateScale(10),
  },
  selectorText: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(14),
    color: '#111827',
  },
  selectorPlaceholder: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(14),
    color: '#9ca3af',
  },
  readonlySelector: {
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: hairline(),
    borderColor: '#bfdbfe',
  },
  readonlySelectorText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#1d4ed8',
  },
  helperText: {
    fontSize: moderateScale(12),
    color: '#6b7280',
    lineHeight: moderateScale(18),
  },
  photoActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    minHeight: moderateScale(42),
    minWidth: moderateScale(128),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(11),
    borderRadius: moderateScale(12),
    backgroundColor: '#1d4ed8',
  },
  primaryActionText: {
    color: '#fff',
    fontSize: moderateScale(13),
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    minHeight: moderateScale(42),
    minWidth: moderateScale(128),
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(11),
    borderRadius: moderateScale(12),
    borderWidth: hairline(),
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  secondaryActionText: {
    color: '#1d4ed8',
    fontSize: moderateScale(13),
    fontWeight: '700',
    textAlign: 'center',
  },
  photoList: {
    gap: moderateScale(10),
  },
  photoCard: {
    position: 'relative',
  },
  photoThumb: {
    width: moderateScale(88),
    height: moderateScale(88),
    borderRadius: moderateScale(12),
    backgroundColor: '#e5e7eb',
  },
  photoRemove: {
    position: 'absolute',
    top: moderateScale(-6),
    right: moderateScale(-6),
    backgroundColor: '#fff',
    borderRadius: moderateScale(999),
  },
  lineCard: {
    gap: moderateScale(10),
    padding: moderateScale(14),
    borderWidth: hairline(),
    borderColor: '#e5e7eb',
    borderRadius: moderateScale(14),
    backgroundColor: '#fcfcfd',
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: moderateScale(10),
  },
  lineTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#111827',
  },
  scopeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(8),
  },
  scopePill: {
    flex: 1,
    minWidth: moderateScale(92),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(9),
    borderRadius: moderateScale(999),
    borderWidth: hairline(),
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  scopePillActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  scopePillText: {
    fontSize: moderateScale(12),
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  scopePillTextActive: {
    color: '#1d4ed8',
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
  },
  inlineActionText: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: '#1d4ed8',
  },
  summaryPill: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: moderateScale(999),
    overflow: 'hidden',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  summaryBalanced: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  summaryPending: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: moderateScale(12),
  },
  summaryLabel: {
    fontSize: moderateScale(13),
    color: '#4b5563',
  },
  summaryValue: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#111827',
  },
  goodText: {
    color: '#166534',
  },
  warnText: {
    color: '#b45309',
  },
  footerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
  },
  secondaryWideAction: {
    flex: 1,
    minWidth: moderateScale(128),
    minHeight: moderateScale(46),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline(),
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  secondaryWideActionText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  primaryWideAction: {
    flex: 1.4,
    minWidth: moderateScale(150),
    minHeight: moderateScale(46),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d4ed8',
  },
  primaryWideActionText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  actionDisabled: {
    opacity: 0.55,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(18),
    padding: moderateScale(16),
    gap: moderateScale(10),
    borderWidth: hairline(),
    borderColor: '#e5e7eb',
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: moderateScale(10),
  },
  recordHeaderMain: {
    flex: 1,
    minWidth: 0,
    gap: moderateScale(4),
  },
  recordAmount: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: '#111827',
  },
  recordScope: {
    fontSize: moderateScale(12),
    color: '#1d4ed8',
    fontWeight: '700',
  },
  recordMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: moderateScale(12),
  },
  recordMeta: {
    fontSize: moderateScale(12),
    color: '#6b7280',
  },
  recordImage: {
    width: '100%',
    height: moderateScale(160),
    borderRadius: moderateScale(14),
    backgroundColor: '#e5e7eb',
  },
  recordNote: {
    fontSize: moderateScale(13),
    color: '#4b5563',
    lineHeight: moderateScale(18),
  },
  modalPage: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    borderBottomWidth: hairline(),
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: moderateScale(10),
  },
  modalTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    minWidth: 0,
    paddingRight: moderateScale(12),
  },
  modalCloseButton: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: moderateScale(-6),
  },
  searchInput: {
    margin: moderateScale(16),
    marginBottom: moderateScale(8),
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    borderWidth: hairline(),
    borderColor: '#d1d5db',
    paddingHorizontal: moderateScale(12),
    backgroundColor: '#fff',
    fontSize: moderateScale(14),
    color: '#111827',
  },
  modalList: {
    padding: moderateScale(16),
    gap: moderateScale(10),
  },
  modalOption: {
    padding: moderateScale(14),
    borderRadius: moderateScale(14),
    borderWidth: hairline(),
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    gap: moderateScale(4),
  },
  modalOptionActive: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  modalOptionTitle: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#111827',
  },
  modalOptionTitleActive: {
    color: '#1d4ed8',
  },
  modalOptionDesc: {
    fontSize: moderateScale(12),
    color: '#6b7280',
    lineHeight: moderateScale(18),
  },
  emptyInlineText: {
    fontSize: moderateScale(13),
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: moderateScale(18),
  },
  detailContent: {
    padding: moderateScale(16),
    gap: moderateScale(14),
  },
  detailNoteBlock: {
    gap: moderateScale(6),
  },
  detailNoteText: {
    fontSize: moderateScale(13),
    color: '#374151',
    lineHeight: moderateScale(18),
  },
  detailLineCard: {
    padding: moderateScale(14),
    borderRadius: moderateScale(14),
    backgroundColor: '#fcfcfd',
    borderWidth: hairline(),
    borderColor: '#e5e7eb',
    gap: moderateScale(4),
  },
  detailLineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: moderateScale(12),
  },
  detailLineAmount: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: '#111827',
  },
  detailLineName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#111827',
  },
  detailLineMeta: {
    fontSize: moderateScale(12),
    color: '#6b7280',
    lineHeight: moderateScale(18),
  },
  detailFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
    padding: moderateScale(16),
    borderTopWidth: hairline(),
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  dangerFooterAction: {
    flex: 1,
    minWidth: moderateScale(128),
    minHeight: moderateScale(46),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: hairline(),
    borderColor: '#fecaca',
  },
  dangerFooterActionText: {
    color: '#dc2626',
    fontSize: moderateScale(14),
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryFooterAction: {
    flex: 1.2,
    minWidth: moderateScale(150),
    minHeight: moderateScale(46),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d4ed8',
  },
  primaryFooterActionText: {
    color: '#fff',
    fontSize: moderateScale(14),
    fontWeight: '700',
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    position: 'relative',
  },
  overlayAbsolute: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  overlayCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: moderateScale(18),
  },
  overlayBottom: {
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,24,39,0.72)',
  },
  sheetCard: {
    width: '100%',
    maxHeight: '62%',
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(22),
    gap: moderateScale(12),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: moderateScale(12),
  },
  sheetTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#111827',
  },
  sheetScroll: {
    maxHeight: moderateScale(320),
  },
  sheetList: {
    gap: moderateScale(10),
    paddingBottom: moderateScale(8),
  },
  sheetOption: {
    minHeight: moderateScale(52),
    borderRadius: moderateScale(14),
    borderWidth: hairline(),
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingHorizontal: moderateScale(16),
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sheetOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  sheetOptionTitle: {
    fontSize: moderateScale(15),
    fontWeight: '700',
    color: '#111827',
  },
  sheetOptionTitleActive: {
    color: '#1d4ed8',
  },
  sheetFooterButton: {
    minHeight: moderateScale(46),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  sheetFooterButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#374151',
  },
  datePickerCard: {
    width: '100%',
    maxHeight: '72%',
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(22),
    gap: moderateScale(14),
  },
  datePickerHeader: {
    gap: moderateScale(6),
  },
  datePickerTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#111827',
  },
  datePickerValue: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#1d4ed8',
  },
  datePickerColumns: {
    flexDirection: 'row',
    gap: moderateScale(10),
  },
  datePickerColumn: {
    flex: 1,
    gap: moderateScale(8),
  },
  datePickerScroll: {
    maxHeight: moderateScale(280),
  },
  datePickerLabel: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#6b7280',
    textAlign: 'center',
  },
  datePickerList: {
    gap: moderateScale(8),
    paddingVertical: moderateScale(2),
  },
  datePickerOption: {
    minHeight: moderateScale(42),
    borderRadius: moderateScale(12),
    borderWidth: hairline(),
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: moderateScale(10),
  },
  datePickerOptionActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  datePickerOptionText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#374151',
  },
  datePickerOptionTextActive: {
    color: '#1d4ed8',
  },
  datePickerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
    marginTop: moderateScale(4),
  },
  confirmCard: {
    width: '100%',
    maxWidth: moderateScale(360),
    backgroundColor: '#fff',
    borderRadius: moderateScale(18),
    padding: moderateScale(18),
    gap: moderateScale(12),
  },
  confirmTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: '#111827',
  },
  confirmBody: {
    fontSize: moderateScale(13),
    color: '#4b5563',
    lineHeight: moderateScale(18),
  },
  confirmCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(10),
  },
  confirmCheckText: {
    flex: 1,
    fontSize: moderateScale(13),
    color: '#374151',
    lineHeight: moderateScale(18),
  },
  confirmActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(10),
    marginTop: moderateScale(4),
  },
  confirmCancel: {
    flex: 1,
    minWidth: moderateScale(120),
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline(),
    borderColor: '#d1d5db',
  },
  confirmCancelText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  confirmDelete: {
    flex: 1,
    minWidth: moderateScale(120),
    minHeight: moderateScale(44),
    borderRadius: moderateScale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  confirmDeleteText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  viewerShell: {
    flex: 1,
    width: '100%',
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerFrame: {
    overflow: 'hidden',
  },
  viewerFrameContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerZoomContent: {
    minWidth: '100%',
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: moderateScale(32),
    right: moderateScale(24),
    zIndex: 2,
    padding: moderateScale(8),
  },
  viewerImage: {
    backgroundColor: 'transparent',
  },
  viewerHint: {
    marginTop: moderateScale(14),
    fontSize: moderateScale(12),
    color: '#e5e7eb',
    textAlign: 'center',
  },
})
