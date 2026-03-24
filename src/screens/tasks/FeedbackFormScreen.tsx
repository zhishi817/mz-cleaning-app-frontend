import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Dimensions, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import { createPropertyFeedback, listPropertyFeedbacks, uploadCleaningMedia, type PropertyFeedback } from '../../lib/api'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { API_BASE_URL } from '../../config/env'

type Props = NativeStackScreenProps<TasksStackParamList, 'FeedbackForm'>

type Kind = 'maintenance' | 'deep_cleaning'

const AREA_OPTIONS = ['入户走廊', '客厅', '厨房', '卧室', '阳台', '浴室', '其他'] as const
const CATEGORY_OPTIONS = ['电器', '家具', '其他'] as const

function fmtTime(s: string) {
  const d = new Date(String(s || ''))
  if (Number.isNaN(d.getTime())) return String(s || '')
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function extractContentText(raw: any) {
  const s0 = String(raw ?? '').trim()
  if (!s0) return ''
  const s = s0.startsWith('{') || s0.startsWith('[') ? s0 : s0.includes('{"content"') ? s0.slice(s0.indexOf('{')) : s0
  if (!(s.startsWith('{') || s.startsWith('['))) return s0
  try {
    const j = JSON.parse(s)
    if (Array.isArray(j)) {
      const lines = j
        .map((x: any) => {
          if (typeof x === 'string') return x.trim()
          const c = x?.content
          return typeof c === 'string' ? c.trim() : ''
        })
        .filter(Boolean)
      if (lines.length) return lines.join('；')
    }
    if (j && typeof j === 'object') {
      const c = (j as any).content
      if (typeof c === 'string' && c.trim()) return c.trim()
    }
  } catch {}
  return s0
}

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
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s0)) return `https://${s0}`
  return s0
}

function normalizeUrls(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((x: any) => {
        if (typeof x === 'string') return toAbsoluteUrl(x)
        const u = x?.url ?? x?.uri ?? x?.photo_url ?? x?.path
        return toAbsoluteUrl(u)
      })
      .map((x) => String(x || '').trim())
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return []
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const j = JSON.parse(s)
        if (Array.isArray(j)) {
          return j
            .map((x: any) => {
              if (typeof x === 'string') return toAbsoluteUrl(x)
              const u = x?.url ?? x?.uri ?? x?.photo_url ?? x?.path
              return toAbsoluteUrl(u)
            })
            .map((x) => String(x || '').trim())
            .filter(Boolean)
        }
      } catch {}
    }
    return [toAbsoluteUrl(s)].filter(Boolean)
  }
  return []
}

export default function FeedbackFormScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()

  const [kind, setKind] = useState<Kind>('maintenance')
  const [area, setArea] = useState<(typeof AREA_OPTIONS)[number] | null>(null)
  const [areas, setAreas] = useState<Array<(typeof AREA_OPTIONS)[number]>>([])
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number] | null>(null)
  const [detail, setDetail] = useState('')
  const [media, setMedia] = useState<string[]>([])

  const [loadingList, setLoadingList] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<PropertyFeedback[]>([])
  const [pendingError, setPendingError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [detailItem, setDetailItem] = useState<PropertyFeedback | null>(null)
  const [detailImgRemote, setDetailImgRemote] = useState<string | null>(null)
  const [detailImgViewUri, setDetailImgViewUri] = useState<string | null>(null)
  const [detailImgLoading, setDetailImgLoading] = useState(false)
  const [detailImgError, setDetailImgError] = useState<string | null>(null)

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const propertyId = String(task?.property_id || task?.property?.id || '').trim()
  const propertyCode = String(task?.property?.code || '').trim()

  useEffect(() => {
    props.navigation.setOptions({ title: t('tasks_btn_repair') })
  }, [props.navigation, t])

  async function refreshPending() {
    if (!token) return
    if (!propertyId && !propertyCode) return
    try {
      setLoadingList(true)
      setPendingError(null)
      const list = await listPropertyFeedbacks(token, { property_id: propertyId || undefined, property_code: propertyCode || undefined, status: ['open', 'in_progress'], limit: 20 })
      setPending(Array.isArray(list) ? list : [])
    } catch (e: any) {
      setPendingError(String(e?.message || '加载失败'))
      setPending([])
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    refreshPending()
  }, [token, propertyId, propertyCode])

  function resetForm(nextKind: Kind) {
    setKind(nextKind)
    setArea(null)
    setAreas([])
    setCategory(null)
    setDetail('')
    setMedia([])
  }

  async function ensureCameraPerm() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      return !!perm.granted
    } catch {
      return false
    }
  }

  async function onTakePhoto() {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    const ok = await ensureCameraPerm()
    if (!ok) {
      Alert.alert('需要相机权限', '请在系统设置中允许相机权限后再拍照')
      return
    }
    try {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `fb-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadCleaningMedia(token, { uri, name, mimeType })
      setMedia(prev => [...prev, up.url])
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '拍照失败'))
    }
  }

  function toggleArea(a: (typeof AREA_OPTIONS)[number]) {
    setAreas(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]))
  }

  const canSubmit = useMemo(() => {
    if (!propertyId) return false
    const d = detail.trim()
    if (!d) return false
    if (kind === 'maintenance') {
      return !!area && !!category
    }
    return areas.length > 0 && media.length > 0
  }, [area, areas.length, category, detail, kind, media.length, propertyId])

  async function onSubmit() {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (!propertyId) {
      Alert.alert(t('common_error'), '缺少房源信息')
      return
    }
    const d = detail.trim()
    if (!d) {
      Alert.alert(t('common_error'), '请填写详情')
      return
    }
    if (kind === 'maintenance') {
      if (!area) return Alert.alert(t('common_error'), '请选择问题区域')
      if (!category) return Alert.alert(t('common_error'), '请选择问题类型')
    } else {
      if (!areas.length) return Alert.alert(t('common_error'), '请选择需要清洁的区域')
      if (!media.length) return Alert.alert(t('common_error'), '请拍照上传')
    }

    try {
      setSubmitting(true)
      await createPropertyFeedback(token, {
        kind,
        property_id: propertyId,
        source_task_id: task?.id ? String(task.id) : undefined,
        area: kind === 'maintenance' ? String(area) : undefined,
        areas: kind === 'deep_cleaning' ? areas : undefined,
        category: kind === 'maintenance' ? String(category) : undefined,
        detail: d,
        media_urls: media,
      })
      Alert.alert(t('common_ok'), '提交成功')
      resetForm(kind)
      await refreshPending()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = useMemo(() => {
    const m = pending.filter(x => String(x.kind || '') === 'maintenance')
    const d = pending.filter(x => String(x.kind || '') === 'deep_cleaning')
    return { m, d }
  }, [pending])

  const screen = useMemo(() => Dimensions.get('window'), [])
  const detailMedia = useMemo(() => normalizeUrls((detailItem as any)?.media_urls), [detailItem])
  const detailText = useMemo(() => extractContentText((detailItem as any)?.detail), [detailItem])

  const apiHost = useMemo(() => {
    try {
      const base = normalizeBase(API_BASE_URL)
      if (!base) return ''
      return new URL(base).host
    } catch {
      return ''
    }
  }, [])

  async function openDetailImage(url: string) {
    const u = toAbsoluteUrl(url)
    if (!u) return
    setDetailImgRemote(u)
    setDetailImgViewUri(null)
    setDetailImgError(null)
    setDetailImgLoading(true)
    setDetailItem(null)
    try {
      const base = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}feedback-preview/` : null
      if (!base) throw new Error('no cache directory')
      try {
        await FileSystem.makeDirectoryAsync(base, { intermediates: true })
      } catch {}
      const lower = u.toLowerCase()
      const ext = lower.includes('.png') ? '.png' : lower.includes('.webp') ? '.webp' : '.jpg'
      const target = `${base}${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      let sameHost = false
      try {
        const host = new URL(u).host
        sameHost = !!apiHost && host === apiHost
      } catch {}
      const headers = token && sameHost ? { Authorization: `Bearer ${token}` } : undefined
      const dl: any = await FileSystem.downloadAsync(u, target, headers ? { headers } : undefined)
      const status = Number(dl?.status || 0)
      const contentType = String(dl?.headers?.['Content-Type'] || dl?.headers?.['content-type'] || '').trim().toLowerCase()
      if (status && status >= 400) throw new Error(`下载失败 (${status})`)
      if (contentType && !contentType.startsWith('image/')) throw new Error(`不是图片 (${contentType || 'unknown'})`)
      const localUri = String(dl?.uri || target || '').trim()
      setDetailImgViewUri(localUri || u)
    } catch (e: any) {
      setDetailImgError(String(e?.message || '图片加载失败'))
      setDetailImgViewUri(u)
    } finally {
      setDetailImgLoading(false)
    }
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!task ? (
        <Text style={styles.muted}>{t('common_loading')}</Text>
      ) : (
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>问题反馈</Text>
            <View style={styles.badge}>
              <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
              <Text style={styles.badgeText}>{task.title}</Text>
            </View>
          </View>
          {task.property?.address ? <Text style={styles.sub}>{task.property.address}</Text> : null}

          <View style={styles.segmentRow}>
            <Pressable
              onPress={() => resetForm('maintenance')}
              style={({ pressed }) => [styles.segment, kind === 'maintenance' ? styles.segmentActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.segmentText, kind === 'maintenance' ? styles.segmentTextActive : null]}>房源维修</Text>
            </Pressable>
            <Pressable
              onPress={() => resetForm('deep_cleaning')}
              style={({ pressed }) => [styles.segment, kind === 'deep_cleaning' ? styles.segmentActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.segmentText, kind === 'deep_cleaning' ? styles.segmentTextActive : null]}>深度清洁</Text>
            </Pressable>
          </View>

          {kind === 'maintenance' ? (
            <>
              <Text style={styles.label}>问题区域</Text>
              <View style={styles.chipsRow}>
                {AREA_OPTIONS.map(a => (
                  <Pressable
                    key={a}
                    onPress={() => setArea(a)}
                    style={({ pressed }) => [styles.chip, area === a ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, area === a ? styles.chipTextActive : null]}>{a}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>问题类型</Text>
              <View style={styles.chipsRow}>
                {CATEGORY_OPTIONS.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={({ pressed }) => [styles.chip, category === c ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, category === c ? styles.chipTextActive : null]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>需要清洁的区域</Text>
              <View style={styles.chipsRow}>
                {AREA_OPTIONS.map(a => (
                  <Pressable
                    key={a}
                    onPress={() => toggleArea(a)}
                    style={({ pressed }) => [styles.chip, areas.includes(a) ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, areas.includes(a) ? styles.chipTextActive : null]}>{a}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>{kind === 'maintenance' ? '问题详情' : '说明（可选）'}</Text>
          <TextInput
            value={detail}
            onChangeText={v => (v.length <= 800 ? setDetail(v) : setDetail(v.slice(0, 800)))}
            style={[styles.input, styles.textarea]}
            placeholder={kind === 'maintenance' ? '请详细描述问题' : '请描述需要深清的内容'}
            placeholderTextColor="#9CA3AF"
            multiline
          />

          <Text style={styles.label}>{kind === 'maintenance' ? '上传附件（拍照）' : '上传照片（必填）'}</Text>
          <View style={styles.row}>
            <Pressable onPress={onTakePhoto} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
              <Text style={styles.photoBtnText}>拍照上传</Text>
            </Pressable>
            <Text style={styles.photoHint}>{media.length ? `已上传 ${media.length} 张` : '仅支持相机拍摄'}</Text>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={submitting || !canSubmit}
            style={({ pressed }) => [styles.submitBtn, submitting || !canSubmit ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.submitText}>{submitting ? t('common_loading') : '提交'}</Text>
          </Pressable>

          <View style={styles.divider} />

          <View style={styles.pendingHead}>
            <Text style={styles.pendingTitle}>本房源待解决</Text>
            <Pressable onPress={() => setExpanded(v => !v)} style={({ pressed }) => [styles.pendingToggle, pressed ? styles.pressed : null]}>
              <Text style={styles.pendingToggleText}>{expanded ? '收起' : '展开'}</Text>
            </Pressable>
          </View>

          {loadingList ? (
            <Text style={styles.muted}>{t('common_loading')}</Text>
          ) : pendingError ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.muted}>{`加载失败：${pendingError}`}</Text>
              <Pressable onPress={refreshPending} style={({ pressed }) => [styles.pendingToggle, { alignSelf: 'flex-start', marginTop: 10 }, pressed ? styles.pressed : null]}>
                <Text style={styles.pendingToggleText}>重试</Text>
              </Pressable>
            </View>
          ) : !pending.length ? (
            <Text style={styles.muted}>暂无待解决记录</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.groupTitle}>{`维修 (${grouped.m.length})`}</Text>
              {(expanded ? grouped.m : grouped.m.slice(0, 3)).map(x => (
                <Pressable key={String(x.id)} onPress={() => setDetailItem(x)} style={({ pressed }) => [styles.pendingItem, pressed ? styles.pressed : null]}>
                  <Text style={styles.pendingLine} numberOfLines={2}>
                    {`${String((x as any).area || '').trim() ? `[${String((x as any).area || '').trim()}] ` : ''}${extractContentText((x as any).detail)}`}
                  </Text>
                  {normalizeUrls((x as any).media_urls).length ? <Text style={styles.pendingHint}>查看照片</Text> : null}
                  <Text style={styles.pendingMeta}>{`${String(x.created_by_name || '').trim() || 'unknown'}  ${fmtTime(String(x.created_at || ''))}`}</Text>
                </Pressable>
              ))}
              <Text style={[styles.groupTitle, { marginTop: 10 }]}>{`深清 (${grouped.d.length})`}</Text>
              {(expanded ? grouped.d : grouped.d.slice(0, 3)).map(x => (
                <Pressable key={String(x.id)} onPress={() => setDetailItem(x)} style={({ pressed }) => [styles.pendingItem, pressed ? styles.pressed : null]}>
                  <Text style={styles.pendingLine} numberOfLines={2}>
                    {`${Array.isArray((x as any).areas) && (x as any).areas.length ? `[${(x as any).areas.join('、')}] ` : ''}${extractContentText((x as any).detail)}`}
                  </Text>
                  {normalizeUrls((x as any).media_urls).length ? <Text style={styles.pendingHint}>查看照片</Text> : null}
                  <Text style={styles.pendingMeta}>{`${String(x.created_by_name || '').trim() || 'unknown'}  ${fmtTime(String(x.created_at || ''))}`}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      </ScrollView>
      <Modal visible={!!detailItem} transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailCard}>
            <View style={styles.detailTopRow}>
              <Text style={styles.detailTitle}>详情</Text>
              <Pressable onPress={() => setDetailItem(null)} style={({ pressed }) => [styles.detailCloseBtn, pressed ? styles.pressed : null]}>
                <Text style={styles.detailCloseText}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.detailText}>{detailText || '-'}</Text>
              {detailMedia.length ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.detailSubTitle}>{`照片 (${detailMedia.length})`}</Text>
                  <View style={styles.thumbRow}>
                    {detailMedia.map(u => (
                      <Pressable key={u} onPress={() => openDetailImage(u)} style={({ pressed }) => [styles.thumbWrap, pressed ? styles.pressed : null]}>
                        <Image source={{ uri: u }} style={styles.thumb} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!detailImgRemote}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => {
          setDetailImgRemote(null)
          setDetailImgViewUri(null)
          setDetailImgError(null)
          setDetailImgLoading(false)
        }}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewCard}>
            <View style={[styles.previewTopRow, { paddingTop: Math.max(10, insets.top) }]}>
              <Pressable
                onPress={() => {
                  setDetailImgRemote(null)
                  setDetailImgViewUri(null)
                  setDetailImgError(null)
                  setDetailImgLoading(false)
                }}
                style={({ pressed }) => [styles.previewCloseBtn, pressed ? styles.pressed : null]}
              >
                <Text style={styles.previewCloseText}>关闭</Text>
              </Pressable>
            </View>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.previewScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bounces={false}
              centerContent
            >
              {detailImgLoading ? <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>加载中…</Text> : null}
              {detailImgError ? <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{detailImgError}</Text> : null}
              {detailImgRemote ? (
                <Image
                  source={{ uri: detailImgViewUri || detailImgRemote }}
                  style={{ width: screen.width, height: Math.max(240, screen.height - 120) }}
                  resizeMode="contain"
                  onError={() => setDetailImgError('图片加载失败')}
                />
              ) : null}
              {detailImgRemote ? (
                <Text style={{ color: 'rgba(255,255,255,0.72)', fontWeight: '700', fontSize: 12, marginTop: 12 }} numberOfLines={2}>
                  {detailImgRemote}
                </Text>
              ) : null}
              {detailImgRemote ? (
                <Pressable
                  onPress={async () => {
                    try {
                      await Linking.openURL(detailImgRemote)
                    } catch {
                      Alert.alert(t('common_error'), '打开失败')
                    }
                  }}
                  style={({ pressed }) => [
                    styles.pendingToggle,
                    { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.22)' },
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text style={[styles.pendingToggleText, { color: '#FFFFFF' }]}>在浏览器打开</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%' },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  segmentRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  segment: { flex: 1, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  segmentText: { fontWeight: '900', color: '#374151' },
  segmentTextActive: { color: '#FFFFFF' },
  label: { marginTop: 14, marginBottom: 8, color: '#111827', fontWeight: '900' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  input: { borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  textarea: { height: 120, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoBtn: { height: 38, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  photoBtnText: { fontWeight: '900', color: '#111827' },
  photoHint: { color: '#6B7280', fontWeight: '700' },
  submitBtn: { marginTop: 14, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  divider: { marginTop: 14, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  pendingHead: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pendingTitle: { fontWeight: '900', color: '#111827' },
  pendingToggle: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB' },
  pendingToggleText: { fontWeight: '900', color: '#111827', fontSize: 12 },
  groupTitle: { marginTop: 6, fontWeight: '900', color: '#374151' },
  pendingItem: { marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6' },
  pendingLine: { fontWeight: '800', color: '#111827' },
  pendingHint: { marginTop: 6, color: '#2563EB', fontWeight: '900', fontSize: 12 },
  pendingMeta: { marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  muted: { color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
  detailBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', padding: 14, justifyContent: 'center' },
  detailCard: { width: '100%', flex: 1, maxHeight: '85%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6' },
  detailTopRow: { height: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: hairline(), borderBottomColor: '#EEF0F6' },
  detailTitle: { fontWeight: '900', color: '#111827' },
  detailCloseBtn: { height: 32, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  detailCloseText: { fontWeight: '900', color: '#111827' },
  detailText: { fontWeight: '800', color: '#111827', lineHeight: 20 },
  detailSubTitle: { fontWeight: '900', color: '#111827' },
  thumbRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  thumb: { width: '100%', height: '100%' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', padding: 12, justifyContent: 'center' },
  previewCard: { flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000' },
  previewTopRow: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', paddingHorizontal: 10 },
  previewCloseBtn: { height: 32, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  previewCloseText: { color: '#FFFFFF', fontWeight: '900' },
  previewScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
})
