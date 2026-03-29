import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { ResizeMode, Video } from 'expo-av'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { getInspectionPhotos, markGuestCheckedOutBulk, updateCleaningTaskManagerFields } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'ManagerDailyTask'>

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function toAbsoluteUrl(rawUrl: any) {
  const s0 = String(rawUrl ?? '').trim()
  if (!s0) return ''
  if (/^https?:\/\//i.test(s0)) return s0
  if (s0.startsWith('//')) return `https:${s0}`
  const base = normalizeBase(API_BASE_URL)
  const stripAuth = base.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const root = stripApi || stripAuth || base
  if (!root) return s0
  if (s0.startsWith('/')) return `${root}${s0}`
  return s0
}

const AREA_LABEL: Record<string, string> = {
  unclean: '清洁问题',
  toilet: '马桶',
  living: '客厅',
  sofa: '沙发',
  bedroom: '卧室',
  kitchen: '厨房',
}

export default function ManagerDailyTaskScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState(false)

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const isCustomerService = String(user?.role || '') === 'customer_service'
  const canSeeUnclean = String(user?.role || '') === 'admin' || String(user?.role || '') === 'offline_manager'

  const [checkoutTime, setCheckoutTime] = useState('')
  const [checkinTime, setCheckinTime] = useState('')
  const [oldCode, setOldCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [guestNote, setGuestNote] = useState('')
  const [keysRequired, setKeysRequired] = useState(1)

  const [photosLoading, setPhotosLoading] = useState(false)
  const [inspectionItems, setInspectionItems] = useState<Array<{ area: string; url: string; note?: string | null }>>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  useEffect(() => {
    setCheckoutTime(String((task as any)?.start_time || (task as any)?.checkout_time || '').trim())
    setCheckinTime(String((task as any)?.end_time || (task as any)?.checkin_time || '').trim())
    setOldCode(String((task as any)?.old_code || '').trim())
    setNewCode(String((task as any)?.new_code || '').trim())
    setGuestNote(String((task as any)?.guest_special_request || '').trim())
    const k = Number((task as any)?.keys_required ?? 1)
    setKeysRequired(Number.isFinite(k) && k >= 2 ? 2 : 1)
  }, [task])

  const inspectionTaskId = useMemo(() => {
    const ids = (task as any)?.inspection_task_ids
    const id0 = Array.isArray(ids) && ids.length ? String(ids[0] || '').trim() : ''
    if (id0) return id0
    const source = String((task as any)?.source_id || '').trim()
    return source
  }, [task])

  useEffect(() => {
    const nav: any = props.navigation as any
    if (!nav || typeof nav.addListener !== 'function') return
    const unsub = nav.addListener('focus', () => {
      if (!token) return
      if (!inspectionTaskId) return
      setPhotosLoading(true)
      getInspectionPhotos(token, inspectionTaskId)
        .then((r) => {
          const items = Array.isArray(r?.items) ? r.items : []
          setInspectionItems(items.map((x) => ({ area: String(x.area || '').trim(), url: String(x.url || '').trim(), note: x.note ?? null })).filter((x) => !!x.url))
        })
        .catch(() => setInspectionItems([]))
        .finally(() => setPhotosLoading(false))
    })
    return unsub
  }, [inspectionTaskId, props.navigation, token])

  async function onSave() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!task) return
    if (!isCustomerService) return
    const ids = Array.isArray((task as any)?.source_ids) && (task as any).source_ids.length ? (task as any).source_ids : [String((task as any)?.source_id || '')]
    const taskIds = ids.map((x: any) => String(x || '').trim()).filter(Boolean)
    if (!taskIds.length) return Alert.alert(t('common_error'), '缺少任务ID')
    try {
      setSaving(true)
      const norm = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim()
      const toNull = (v: any) => {
        const s = norm(v)
        return s ? s : null
      }
      const prevCheckout = toNull((task as any)?.start_time || (task as any)?.checkout_time)
      const prevCheckin = toNull((task as any)?.end_time || (task as any)?.checkin_time)
      const prevOldCode = toNull((task as any)?.old_code)
      const prevNewCode = toNull((task as any)?.new_code)
      const prevGuest = toNull((task as any)?.guest_special_request)
      const prevKeys = Number((task as any)?.keys_required ?? 1)

      const nextCheckout = toNull(checkoutTime)
      const nextCheckin = toNull(checkinTime)
      const nextOldCode = toNull(oldCode)
      const nextNewCode = toNull(newCode)
      const nextGuest = toNull(guestNote)
      const nextKeys = keysRequired

      const payload: any = { task_ids: taskIds }
      if (norm(nextCheckout) !== norm(prevCheckout)) payload.checkout_time = nextCheckout
      if (norm(nextCheckin) !== norm(prevCheckin)) payload.checkin_time = nextCheckin
      if (norm(nextOldCode) !== norm(prevOldCode)) payload.old_code = nextOldCode
      if (norm(nextNewCode) !== norm(prevNewCode)) payload.new_code = nextNewCode
      if (norm(nextGuest) !== norm(prevGuest)) payload.guest_special_request = nextGuest
      if (Number.isFinite(nextKeys) && nextKeys !== prevKeys) payload.keys_required = nextKeys

      const keys = Object.keys(payload).filter((k) => k !== 'task_ids')
      if (keys.length) await updateCleaningTaskManagerFields(token, payload)
      Alert.alert(t('common_ok'), '已保存')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_loading')}</Text>
      </View>
    )
  }

  const property = task.property
  const status = String(task.status || '')
  const cleaningStatus = String((task as any)?.cleaning_status || '')
  const inspectionStatus = String((task as any)?.inspection_status || '')
  const checkedOutAt = String((task as any)?.checked_out_at || '').trim()
  const hasKeyPhoto = !!String((task as any)?.key_photo_url || '').trim()
  const lockboxUrl = String((task as any)?.lockbox_video_url || '').trim()
  const inspectorAssigned = String((task as any)?.inspector_id || '').trim()
  const taskType = String((task as any)?.task_type || '').trim().toLowerCase()
  const isCheckoutLike = taskType === 'checkout_clean' || taskType === 'turnover' || !!String((task as any)?.start_time || '').trim()
  const isSelfComplete = isCheckoutLike && !inspectorAssigned

  const uncleanPhotos = inspectionItems.filter((x) => x.area === 'unclean')
  const roomPhotosByArea = (['toilet', 'living', 'sofa', 'bedroom', 'kitchen'] as const).map((a) => ({ area: a, items: inspectionItems.filter((x) => x.area === a) }))

  async function onToggleCheckedOut() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!isCustomerService) return
    const ids = Array.isArray((task as any)?.source_ids) && (task as any).source_ids.length ? (task as any).source_ids : [String((task as any)?.source_id || '')]
    const taskIds = ids.map((x: any) => String(x || '').trim()).filter(Boolean)
    if (!taskIds.length) return Alert.alert(t('common_error'), '缺少任务ID')
    try {
      setMarking(true)
      if (!checkedOutAt) {
        const prevKeys = Number((task as any)?.keys_required ?? 1)
        if (Number.isFinite(keysRequired) && keysRequired !== prevKeys) {
          await updateCleaningTaskManagerFields(token, { task_ids: taskIds, keys_required: keysRequired })
        }
      }
      await markGuestCheckedOutBulk(token, { task_ids: taskIds, action: checkedOutAt ? 'unset' : 'set' })
      Alert.alert(t('common_ok'), checkedOutAt ? '已取消退房' : '已标记退房，已通知清洁人员')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '操作失败'))
    } finally {
      setMarking(false)
    }
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: Math.max(16, insets.bottom) + 10 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>每日清洁</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isSelfComplete ? (
                <View style={[styles.pill, { backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE' }]}>
                  <Text style={[styles.pillText, { color: '#2563EB' }]}>自完成</Text>
                </View>
              ) : null}
              <View style={styles.pill}>
                <Text style={styles.pillText}>{status || '-'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
            <Text style={styles.metaText} numberOfLines={2}>
              {property?.code || task.title}
            </Text>
          </View>
          {property?.address ? <Text style={styles.addr}>{property.address}</Text> : null}
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>清洁状态</Text>
            <Text style={styles.kvValue}>{cleaningStatus || '-'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>检查状态</Text>
            <Text style={styles.kvValue}>{inspectionStatus || '-'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>执行人员</Text>
            <Text style={styles.kvValue}>{`${String((task as any)?.cleaner_name || '-')}`}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>检查人员</Text>
            <Text style={styles.kvValue}>{`${isSelfComplete ? '无' : String((task as any)?.inspector_name || '-')}`}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>客服信息</Text>
            {!isCustomerService ? <Text style={styles.mutedSmall}>仅客服可编辑</Text> : null}
          </View>
          {isCustomerService ? (
            <Pressable
              onPress={onToggleCheckedOut}
              disabled={marking}
              style={({ pressed }) => [styles.checkoutBtn, pressed ? styles.pressed : null, marking ? styles.checkoutBtnDisabled : null]}
            >
              <Text style={styles.checkoutText}>{marking ? t('common_loading') : checkedOutAt ? '取消已退房' : '标记已退房'}</Text>
            </Pressable>
          ) : null}
          <View style={styles.field}>
            <Text style={styles.label}>退房时间</Text>
            <TextInput value={checkoutTime} onChangeText={setCheckoutTime} editable={isCustomerService && !saving} style={styles.input} placeholder="例如 10am" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>入住时间</Text>
            <TextInput value={checkinTime} onChangeText={setCheckinTime} editable={isCustomerService && !saving} style={styles.input} placeholder="例如 3pm" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>需挂钥匙套数</Text>
            <View style={styles.pillsRow}>
              <Pressable
                onPress={() => setKeysRequired(1)}
                disabled={!isCustomerService || saving}
                style={({ pressed }) => [styles.pillBtn, keysRequired === 1 ? styles.pillBtnOn : null, pressed ? styles.pressed : null]}
              >
                <Text style={[styles.pillBtnText, keysRequired === 1 ? styles.pillBtnTextOn : null]}>1 套</Text>
              </Pressable>
              <Pressable
                onPress={() => setKeysRequired(2)}
                disabled={!isCustomerService || saving}
                style={({ pressed }) => [styles.pillBtn, keysRequired === 2 ? styles.pillBtnOn : null, pressed ? styles.pressed : null]}
              >
                <Text style={[styles.pillBtnText, keysRequired === 2 ? styles.pillBtnTextOn : null]}>2 套</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>旧密码</Text>
              <TextInput value={oldCode} onChangeText={setOldCode} editable={isCustomerService && !saving} style={styles.input} placeholder="旧密码" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>新密码</Text>
              <TextInput value={newCode} onChangeText={setNewCode} editable={isCustomerService && !saving} style={styles.input} placeholder="新密码" placeholderTextColor="#9CA3AF" />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>客人特殊需求</Text>
            <TextInput
              value={guestNote}
              onChangeText={(v) => setGuestNote(v.slice(0, 1500))}
              editable={isCustomerService && !saving}
              style={[styles.input, styles.textarea]}
              placeholder="备注（可选）"
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>
          <Pressable
            onPress={onSave}
            disabled={!isCustomerService || saving}
            style={({ pressed }) => [styles.primaryBtnFull, !isCustomerService || saving ? styles.primaryBtnDisabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.primaryText}>{saving ? t('common_loading') : '保存修改'}</Text>
          </Pressable>
          <Pressable
            onPress={() => props.navigation.navigate('FeedbackForm', { taskId: task.id })}
            style={({ pressed }) => [styles.grayBtnFull, pressed ? styles.pressed : null]}
          >
            <Text style={styles.grayText}>房源问题反馈</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>钥匙与挂钥匙视频</Text>
          <Text style={styles.mutedSmall}>这里展示已上传的钥匙照片、挂钥匙视频（如有）。</Text>
          {hasKeyPhoto ? (
            <Pressable
              onPress={() => {
                setViewerUrl(String((task as any)?.key_photo_url))
                setViewerOpen(true)
              }}
              style={({ pressed }) => [styles.mediaThumbWrap, pressed ? styles.pressed : null]}
            >
              <Image source={{ uri: toAbsoluteUrl((task as any)?.key_photo_url) }} style={styles.mediaThumb} />
              <Text style={styles.mediaLabel}>钥匙照片</Text>
            </Pressable>
          ) : null}
          {lockboxUrl ? (
            <View style={styles.videoWrap}>
              <Video source={{ uri: toAbsoluteUrl(lockboxUrl) }} style={styles.video} resizeMode={ResizeMode.CONTAIN} shouldPlay={false} useNativeControls />
              <Text style={styles.mediaLabel}>挂钥匙视频</Text>
            </View>
          ) : null}
          {!hasKeyPhoto && !lockboxUrl ? <Text style={styles.mutedSmall}>暂无钥匙照片或挂钥匙视频</Text> : null}
        </View>

        {canSeeUnclean ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>清洁问题照片（检查员拍摄）</Text>
            {photosLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
            {uncleanPhotos.length ? (
              <View style={styles.grid}>
                {uncleanPhotos.map((x, idx) => (
                  <Pressable
                    key={`${x.url}-${idx}`}
                    onPress={() => {
                      setViewerUrl(x.url)
                      setViewerOpen(true)
                    }}
                    style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                  >
                    <Image source={{ uri: toAbsoluteUrl(x.url) }} style={styles.gridImg} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.mutedSmall}>暂无</Text>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>房间检查照片</Text>
          {photosLoading ? <Text style={styles.mutedSmall}>{t('common_loading')}</Text> : null}
          {roomPhotosByArea.map((g) => (
            <View key={g.area} style={styles.group}>
              <Text style={styles.groupTitle}>{AREA_LABEL[g.area] || g.area}</Text>
              {g.items.length ? (
                <View style={styles.grid}>
                  {g.items.map((x, idx) => (
                    <Pressable
                      key={`${x.url}-${idx}`}
                      onPress={() => {
                        setViewerUrl(x.url)
                        setViewerOpen(true)
                      }}
                      style={({ pressed }) => [styles.gridItem, pressed ? styles.pressed : null]}
                    >
                      <Image source={{ uri: toAbsoluteUrl(x.url) }} style={styles.gridImg} />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.mutedSmall}>暂无</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setViewerOpen(false)
          setViewerUrl(null)
        }}
      >
        <Pressable
          style={styles.viewerMask}
          onPress={() => {
            setViewerOpen(false)
            setViewerUrl(null)
          }}
        >
          <View style={styles.viewerTopRow} pointerEvents="none">
            <Text style={styles.viewerCloseText}>点击任意位置关闭</Text>
          </View>
          {viewerUrl ? (
            <View style={{ flex: 1 }} pointerEvents="none">
              <Image source={{ uri: toAbsoluteUrl(viewerUrl) }} style={styles.viewerImg} resizeMode="contain" />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  pill: { height: 28, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  pillText: { color: '#2563EB', fontWeight: '900', fontSize: 12 },
  metaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { color: '#111827', fontWeight: '900', flexShrink: 1 },
  addr: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  kvRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kvLabel: { color: '#6B7280', fontWeight: '800' },
  kvValue: { color: '#111827', fontWeight: '900', flexShrink: 1 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#111827', fontWeight: '900' },
  muted: { color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  field: { marginTop: 10 },
  label: { color: '#111827', fontWeight: '900', marginBottom: 8 },
  input: { height: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '800', color: '#111827' },
  textarea: { height: 84, paddingTop: 12, textAlignVertical: 'top' },
  row2: { marginTop: 10, flexDirection: 'row', gap: 10 },
  pillsRow: { flexDirection: 'row', gap: 10 },
  pillBtn: { flex: 1, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  pillBtnOn: { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' },
  pillBtnText: { color: '#6B7280', fontWeight: '900' },
  pillBtnTextOn: { color: '#2563EB' },

  checkoutBtn: { marginTop: 10, height: 40, borderRadius: 12, backgroundColor: '#E0F2FE', borderWidth: hairline(), borderColor: '#BAE6FD', alignItems: 'center', justifyContent: 'center' },
  checkoutBtnDisabled: { backgroundColor: '#BAE6FD' },
  checkoutText: { color: '#0369A1', fontWeight: '900' },

  grayBtnFull: { marginTop: 10, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  grayText: { color: '#111827', fontWeight: '900' },
  primaryBtnFull: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryBtnDisabled: { backgroundColor: '#93C5FD' },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.92 },

  mediaThumbWrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  mediaThumb: { width: '100%', height: 180 },
  mediaLabel: { marginTop: 8, color: '#6B7280', fontWeight: '800' },
  videoWrap: { marginTop: 10, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#0B0F17', paddingBottom: 10 },
  video: { width: '100%', height: 220, backgroundColor: '#0B0F17' },

  group: { marginTop: 12, paddingTop: 12, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  groupTitle: { color: '#111827', fontWeight: '900' },
  grid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  gridImg: { width: '100%', height: 160, backgroundColor: '#F3F4F6' },

  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
})
