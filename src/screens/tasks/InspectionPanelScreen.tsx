import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { API_BASE_URL } from '../../config/env'
import { getInspectionPhotos, getRestockProof, listChecklistItems, saveInspectionPhotos, saveRestockProof, uploadCleaningMedia, type ChecklistItem, type InspectionPhotoArea } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'InspectionPanel'>

type RestockState = {
  item_id: string
  label: string
  qty: number | null
  status: 'restocked' | 'unavailable' | null
  proof_url: string | null
  note: string
  origin: 'task' | 'manual'
}

type UncleanPhoto = { url: string; note: string }

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

function sectionTitle(icon: any, title: string) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={moderateScale(16)} color="#111827" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

export default function InspectionPanelScreen(props: Props) {
  const { t } = useI18n()
  const { token, user } = useAuth()
  const insets = useSafeAreaInsets()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [restockUploadingIdx, setRestockUploadingIdx] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<{ restock: boolean; cleaningIssue: boolean; propertyIssue: boolean; photos: boolean }>({
    restock: true,
    cleaningIssue: true,
    propertyIssue: false,
    photos: true,
  })

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const cleaningTaskId = String(task?.source_id || '').trim()
  const propertyCode = String(task?.property?.code || '').trim()
  const propertyAddr = String(task?.property?.address || '').trim()

  const initialRestockItems = useMemo(() => {
    const list = Array.isArray((task as any)?.restock_items) ? ((task as any).restock_items as any[]) : []
    return list
      .map((x) => {
        const item_id = String(x?.item_id || '').trim()
        if (!item_id) return null
        const label = String(x?.label || item_id).trim()
        const qty0 = x?.qty == null ? null : Number(x.qty)
        const qty = Number.isFinite(qty0 as any) ? (qty0 as number) : null
        return { item_id, label, qty }
      })
      .filter(Boolean) as Array<{ item_id: string; label: string; qty: number | null }>
  }, [task])

  const [restock, setRestock] = useState<RestockState[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [restockPickerOpen, setRestockPickerOpen] = useState(false)
  const [restockPickerQuery, setRestockPickerQuery] = useState('')
  const areaLimits: Record<Exclude<InspectionPhotoArea, 'unclean'>, number> = useMemo(
    () => ({ toilet: 9, shower_drain: 3, living: 3, sofa: 2, bedroom: 8, kitchen: 2 }),
    [],
  )
  const [roomPhotos, setRoomPhotos] = useState<Record<Exclude<InspectionPhotoArea, 'unclean'>, string[]>>({
    toilet: [],
    living: [],
    sofa: [],
    bedroom: [],
    kitchen: [],
    shower_drain: [],
  })
  const [cleaningIssue, setCleaningIssue] = useState<UncleanPhoto[]>([])
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const viewerCloseRef = useRef<any>(null)
  const propertyIssueVisitedRef = useRef(false)
  const guestSpecialRequest = String((task as any)?.guest_special_request || '').trim()
  const [guestNeedDone, setGuestNeedDone] = useState(false)

  useEffect(() => {
    const nav: any = props.navigation as any
    if (!nav || typeof nav.addListener !== 'function') return
    const unsub = nav.addListener('focus', () => {
      if (!propertyIssueVisitedRef.current) return
      propertyIssueVisitedRef.current = false
      setExpanded((p) => ({ ...p, propertyIssue: false, photos: true }))
    })
    return unsub
  }, [props.navigation])

  useEffect(() => {
    const mapped: RestockState[] = initialRestockItems.map((x) => ({
      item_id: x.item_id,
      label: x.label,
      qty: x.qty,
      status: null,
      proof_url: null,
      note: '',
      origin: 'task',
    }))
    setRestock(mapped)
  }, [initialRestockItems])

  useEffect(() => {
    if (!restockPickerOpen) return
    let cancelled = false
    ;(async () => {
      if (!token) return
      if (checklist.length) return
      try {
        setLoading(true)
        const list = await listChecklistItems(token)
        if (cancelled) return
        setChecklist(list || [])
      } catch (e: any) {
        if (!cancelled) Alert.alert(t('common_error'), String(e?.message || '加载失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [checklist.length, restockPickerOpen, t, token])

  const restockPickerItems = useMemo(() => {
    const q = restockPickerQuery.trim().toLowerCase()
    const base = (checklist || []).filter((x) => String(x.kind || '').trim() === 'consumable')
    if (!q) return base
    return base.filter((x) => String(x.label || '').toLowerCase().includes(q) || String(x.id || '').toLowerCase().includes(q))
  }, [checklist, restockPickerQuery])

  function addManualRestockItem(it: ChecklistItem) {
    const id = String(it.id || '').trim()
    if (!id) return
    if (restock.some((x) => x.item_id === id)) {
      Alert.alert(t('common_error'), '该补充项已存在')
      return
    }
    const label = String(it.label || id).trim()
    setRestock((prev) => [...prev, { item_id: id, label, qty: null, status: null, proof_url: null, note: '', origin: 'manual' }])
    setRestockPickerOpen(false)
    setRestockPickerQuery('')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) return
      if (!cleaningTaskId) return
      try {
        setLoading(true)
        const [r1, r2] = await Promise.all([getInspectionPhotos(token, cleaningTaskId).catch(() => null), getRestockProof(token, cleaningTaskId).catch(() => null)])
        if (cancelled) return
        if (r1?.items?.length) {
          const nextRoom: Record<Exclude<InspectionPhotoArea, 'unclean'>, string[]> = { toilet: [], living: [], sofa: [], bedroom: [], kitchen: [], shower_drain: [] }
          const uncleanList: UncleanPhoto[] = []
          for (const it of r1.items) {
            const area = String(it.area || '').trim() as any
            const url = String(it.url || '').trim()
            const note = String(it.note || '').trim()
            if (!url) continue
            if (area === 'unclean') uncleanList.push({ url, note })
            else if (area in nextRoom) nextRoom[area as Exclude<InspectionPhotoArea, 'unclean'>].push(url)
          }
          setRoomPhotos(nextRoom)
          setCleaningIssue(uncleanList.slice(0, 12))
        }
        if (r2?.items?.length) {
          setRestock((prev) => {
            const next = prev.map((x) => {
              const hit = r2.items.find((y) => String(y.item_id || '').trim() === x.item_id) || null
              if (!hit) return x
              const st = String(hit.status || '').trim().toLowerCase()
              const status = st === 'restocked' || st === 'unavailable' ? (st as any) : null
              return {
                ...x,
                status,
                proof_url: String(hit.proof_url || '').trim() || null,
                qty: hit.qty == null ? x.qty : Number(hit.qty),
                note: String(hit.note || '').trim(),
              }
            })
            const existing = new Set(next.map((x) => x.item_id))
            for (const hit of r2.items) {
              const id = String(hit.item_id || '').trim()
              if (!id || existing.has(id)) continue
              const st = String(hit.status || '').trim().toLowerCase()
              const status = st === 'restocked' || st === 'unavailable' ? (st as any) : null
              next.push({
                item_id: id,
                label: id,
                qty: hit.qty == null ? null : Number(hit.qty),
                status,
                proof_url: String(hit.proof_url || '').trim() || null,
                note: String(hit.note || '').trim(),
                origin: 'manual',
              })
            }
            return next
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cleaningTaskId, token])

  async function ensureCameraPerm() {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      return !!perm.granted
    } catch {
      return false
    }
  }

  async function takePhotoAndUpload(purpose: 'inspection_photo' | 'restock_proof', area?: InspectionPhotoArea) {
    if (!token) throw new Error('请先登录')
    const ok = await ensureCameraPerm()
    if (!ok) throw new Error('需要相机权限')
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: true, aspect: [4, 3] })
    if (res.canceled || !res.assets?.length) return null
    const a = res.assets[0] as any
    const uri = String(a.uri || '').trim()
    if (!uri) return null
    const name = String(a.fileName || uri.split('/').pop() || `${purpose}-${Date.now()}.jpg`)
    const mimeType = String(a.mimeType || 'image/jpeg')
    const capturedAt = new Date().toISOString()
    const up = await uploadCleaningMedia(token, { uri, name, mimeType }, { purpose, area: area || undefined, watermark: '1', property_code: propertyCode || undefined, captured_at: capturedAt })
    return { url: up.url, captured_at: capturedAt }
  }

  async function persistInspectionMedia(nextRoom: Record<Exclude<InspectionPhotoArea, 'unclean'>, string[]>, nextUnclean: UncleanPhoto[]) {
    await saveInspectionPhotos(token as string, cleaningTaskId, {
      items: [
        ...(['toilet', 'living', 'sofa', 'bedroom', 'kitchen', 'shower_drain'] as const).flatMap((a) => nextRoom[a].map((u) => ({ area: a, url: u, note: null }))),
        ...nextUnclean.map((x) => ({ area: 'unclean' as const, url: x.url, note: x.note || null })),
      ],
    })
  }

  async function onAddRoomPhoto(area: Exclude<InspectionPhotoArea, 'unclean'>) {
    const limit = areaLimits[area]
    if ((roomPhotos[area] || []).length >= limit) return
    try {
      setSaving(true)
      const up = await takePhotoAndUpload('inspection_photo', area)
      if (!up) return
      const nextRoom = { ...roomPhotos, [area]: [...(roomPhotos[area] || []), up.url] }
      setRoomPhotos(nextRoom)
      await persistInspectionMedia(nextRoom, cleaningIssue)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setSaving(false)
    }
  }

  function onRemoveRoomPhoto(area: Exclude<InspectionPhotoArea, 'unclean'>, idx: number) {
    Alert.alert('删除照片', '确认删除这张照片？', [
      { text: '取消', style: 'cancel' as any },
      {
        text: '删除',
        style: 'destructive' as any,
        onPress: async () => {
          const next = { ...roomPhotos, [area]: (roomPhotos[area] || []).filter((_, i) => i !== idx) }
          setRoomPhotos(next)
          try {
            setSaving(true)
            await persistInspectionMedia(next, cleaningIssue)
          } catch (e: any) {
            Alert.alert(t('common_error'), String(e?.message || '保存失败'))
          } finally {
            setSaving(false)
          }
        },
      },
    ])
  }

  async function onAddCleaningIssuePhoto() {
    if (cleaningIssue.length >= 12) return
    try {
      setSaving(true)
      const up = await takePhotoAndUpload('inspection_photo', 'unclean')
      if (!up) return
      const nextUnclean = [...cleaningIssue, { url: up.url, note: '' }]
      setCleaningIssue(nextUnclean)
      await persistInspectionMedia(roomPhotos, nextUnclean)
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setSaving(false)
    }
  }

  async function onSaveCleaningIssueNotes() {
    try {
      setSaving(true)
      await persistInspectionMedia(roomPhotos, cleaningIssue)
      Alert.alert(t('common_ok'), '已保存')
      setExpanded(p => ({ ...p, cleaningIssue: false, propertyIssue: true }))
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  async function onTakeRestockProof(idx: number) {
    try {
      setSaving(true)
      setRestockUploadingIdx(idx)
      const up = await takePhotoAndUpload('restock_proof')
      if (!up) return
      setRestock((prev) => prev.map((x, i) => (i === idx ? { ...x, proof_url: up.url } : x)))
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setRestockUploadingIdx(null)
      setSaving(false)
    }
  }

  async function onSubmitRestock() {
    if (!token) return
    if (!cleaningTaskId) return
    if (!restock.length) return
    for (const it of restock) {
      if (!it.status) return Alert.alert(t('common_error'), `请确认：${it.label}`)
      if (it.status !== 'unavailable' && !String(it.proof_url || '').trim()) return Alert.alert(t('common_error'), `请上传补充照片：${it.label}`)
    }
    try {
      setSaving(true)
      await saveRestockProof(token, cleaningTaskId, {
        items: restock.map((x) => ({
          item_id: x.item_id,
          status: x.status as any,
          qty: x.qty == null ? null : Number(x.qty),
          note: x.note.trim() || null,
          proof_url: x.status === 'unavailable' ? 'no_photo' : String(x.proof_url || '').trim(),
        })),
      })
      Alert.alert(t('common_ok'), '已提交')
      setExpanded(p => ({ ...p, restock: false, cleaningIssue: true }))
    } catch (e: any) {
      const msg = String(e?.message || '提交失败')
      if (msg.includes('请求失败 (400)')) {
        Alert.alert('提交失败', '提交内容未通过校验。请检查：每项是否已选择“已补充/无需补充”，以及“已补充”的项目是否已上传补充照片。')
      } else {
        Alert.alert(t('common_error'), msg)
      }
    } finally {
      setSaving(false)
    }
  }

  function photosReady() {
    return !!roomPhotos.toilet.length && !!roomPhotos.living.length && !!roomPhotos.sofa.length && !!roomPhotos.bedroom.length && !!roomPhotos.kitchen.length && !!roomPhotos.shower_drain.length
  }

  function cleaningIssueReady() {
    return true
  }

  function restockReady() {
    if (!restock.length) return true
    return restock.every((x) => !!x.status && (x.status === 'unavailable' ? true : !!String(x.proof_url || '').trim()))
  }

  function completeReady() {
    return !guestSpecialRequest || guestNeedDone
  }

  const progressSteps = [
    { key: 'restock', label: '消耗品', done: restockReady() },
    { key: 'cleaning', label: '清洁反馈', done: cleaningIssueReady() },
    { key: 'property', label: '房源反馈', done: true },
    { key: 'photos', label: '检查照片', done: photosReady() },
    { key: 'complete', label: '标记完成', done: completeReady() },
  ]

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_loading')}</Text>
      </View>
    )
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>检查与补充</Text>
            <View style={styles.badge}>
              <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
              <Text style={styles.badgeText}>{task.title}</Text>
            </View>
          </View>
          {propertyAddr ? <Text style={styles.sub}>{propertyAddr}</Text> : null}

          <View style={styles.progressRow}>
            {progressSteps.map((step, index) => (
              <React.Fragment key={step.key}>
                <View style={styles.progressItem}>
                  <View style={[styles.progressDot, step.done ? styles.progressDotOn : null]} />
                  <Text
                    style={[styles.progressText, step.done ? styles.progressTextOn : null]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {step.label}
                  </Text>
                </View>
                {index < progressSteps.length - 1 ? (
                  <View style={[styles.progressLine, step.done ? styles.progressLineOn : null]} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Pressable onPress={() => setExpanded(p => ({ ...p, restock: !p.restock }))} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle('cube-outline', '1. 消耗品补充')}
            <Ionicons name={expanded.restock ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
          </Pressable>
          {expanded.restock ? (
            !restock.length ? (
              <View style={styles.block}>
                <Text style={styles.mutedSmall}>暂无待补充项</Text>
                <Pressable onPress={() => setRestockPickerOpen(true)} style={({ pressed }) => [styles.primaryBtn, { marginTop: 12 }, pressed ? styles.pressed : null]}>
                  <Text style={styles.primaryText}>添加补充项</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Pressable onPress={() => setRestockPickerOpen(true)} style={({ pressed }) => [styles.previewBtn, pressed ? styles.pressed : null]}>
                    <Text style={styles.previewBtnText}>添加补充项</Text>
                  </Pressable>
                </View>
                {restock.map((it, idx) => (
                  <View key={it.item_id} style={styles.block}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <Text style={styles.label}>{it.label}</Text>
                      {it.origin === 'manual' ? (
                        <Pressable onPress={() => setRestock((p) => p.filter((_, i) => i !== idx))} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}>
                          <Text style={styles.removeBtnText}>移除</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={styles.mutedSmall}>{it.qty != null ? `建议补充：${it.qty}` : ''}</Text>
                    <View style={styles.row}>
                      <Pressable
                        onPress={() => setRestock(p => p.map((x, i) => (i === idx ? { ...x, status: 'restocked' } : x)))}
                        style={({ pressed }) => [styles.chip, it.status === 'restocked' ? styles.chipActive : null, pressed ? styles.pressed : null]}
                      >
                        <Text style={[styles.chipText, it.status === 'restocked' ? styles.chipTextActive : null]}>已补充</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setRestock(p => p.map((x, i) => (i === idx ? { ...x, status: 'unavailable', proof_url: null } : x)))}
                        style={({ pressed }) => [styles.chip, it.status === 'unavailable' ? styles.chipActive : null, pressed ? styles.pressed : null]}
                      >
                        <Text style={[styles.chipText, it.status === 'unavailable' ? styles.chipTextActive : null]}>无需补充</Text>
                      </Pressable>
                    </View>
                    <View style={styles.row}>
                      {String(it.proof_url || '').trim() && /^https?:\/\//i.test(String(it.proof_url || '')) ? (
                        <Pressable
                          onPress={() => {
                            setViewerUrl(String(it.proof_url))
                            setViewerOpen(true)
                          }}
                          style={({ pressed }) => [styles.proofThumbWrap, pressed ? styles.pressed : null]}
                        >
                          <Image source={{ uri: toAbsoluteUrl(it.proof_url) }} style={styles.proofThumb} />
                        </Pressable>
                      ) : null}
                      {it.status === 'unavailable' ? (
                        <Text style={styles.mutedSmall}>无需补充无需上传照片</Text>
                      ) : (
                        <Pressable
                          onPress={() => onTakeRestockProof(idx)}
                          disabled={restockUploadingIdx === idx}
                          style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null, restockUploadingIdx === idx ? styles.submitDisabled : null]}
                        >
                          <Text style={styles.photoBtnText}>{restockUploadingIdx === idx ? t('common_loading') : it.proof_url ? '已上传照片' : '上传补充照片'}</Text>
                        </Pressable>
                      )}
                    </View>
                    <TextInput
                      value={it.note}
                      onChangeText={(v) => setRestock(p => p.map((x, i) => (i === idx ? { ...x, note: v.slice(0, 300) } : x)))}
                      style={[styles.input, styles.note]}
                      placeholder="备注（可选）"
                      placeholderTextColor="#9CA3AF"
                      multiline
                    />
                  </View>
                ))}
                <Pressable onPress={onSubmitRestock} disabled={saving} style={({ pressed }) => [styles.submitBtn, saving ? styles.submitDisabled : null, pressed ? styles.pressed : null]}>
                  <Text style={styles.submitText}>{saving ? t('common_loading') : '提交消耗品补充'}</Text>
                </Pressable>
              </>
            )
          ) : null}
        </View>

        <View style={styles.card}>
          <Pressable
            onPress={() => setExpanded(p => ({ ...p, cleaningIssue: !p.cleaningIssue }))}
            style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}
          >
            {sectionTitle('alert-circle-outline', '2. 清洁问题反馈')}
            <Ionicons name={expanded.cleaningIssue ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
          </Pressable>
          {expanded.cleaningIssue ? (
            <View style={styles.block}>
              <Text style={styles.mutedSmall}>清洁没做到位时，请补充照片和备注。</Text>
              {cleaningIssue.map((x, idx) => (
                <View key={`${x.url}-${idx}`} style={{ marginTop: 10 }}>
                  <View style={styles.row}>
                    <Pressable onPress={() => { setViewerUrl(x.url); setViewerOpen(true) }} style={({ pressed }) => [styles.uncleanThumbWrap, pressed ? styles.pressed : null]}>
                      <Image source={{ uri: toAbsoluteUrl(x.url) }} style={styles.uncleanThumb} />
                    </Pressable>
                    <Pressable onPress={() => setCleaningIssue(p => p.filter((_, i) => i !== idx))} style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}>
                      <Text style={styles.removeBtnText}>删除</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    value={x.note}
                    onChangeText={(v) => setCleaningIssue(p => p.map((it, i) => (i === idx ? { ...it, note: v.slice(0, 300) } : it)))}
                    style={[styles.input, styles.note]}
                    placeholder="备注（可选）"
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>
              ))}
              <View style={styles.row}>
                <Pressable
                  onPress={onAddCleaningIssuePhoto}
                  disabled={saving || cleaningIssue.length >= 12}
                  style={({ pressed }) => [styles.photoBtn, cleaningIssue.length >= 12 ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.photoBtnText}>添加照片</Text>
                </Pressable>
                <Pressable onPress={onSaveCleaningIssueNotes} disabled={saving} style={({ pressed }) => [styles.previewBtn, pressed ? styles.pressed : null, saving ? styles.submitDisabled : null]}>
                  <Text style={styles.previewBtnText}>保存</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Pressable
            onPress={() => setExpanded(p => ({ ...p, propertyIssue: !p.propertyIssue }))}
            style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}
          >
            {sectionTitle('home-outline', '3. 房源问题反馈')}
            <Ionicons name={expanded.propertyIssue ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
          </Pressable>
          {expanded.propertyIssue ? (
            <View style={styles.block}>
              <Text style={styles.mutedSmall}>发现损坏或异常时，请补充照片和备注。</Text>
              <Pressable
                onPress={() => {
                  propertyIssueVisitedRef.current = true
                  props.navigation.navigate('FeedbackForm', { taskId: task.id })
                }}
                style={({ pressed }) => [styles.primaryBtn, { marginTop: 12 }, pressed ? styles.pressed : null]}
              >
                <Text style={styles.primaryText}>进入问题反馈</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Pressable onPress={() => setExpanded(p => ({ ...p, photos: !p.photos }))} style={({ pressed }) => [styles.sectionHead, pressed ? styles.pressed : null]}>
            {sectionTitle('camera-outline', '4. 房间检查照片')}
            <Ionicons name={expanded.photos ? 'chevron-up' : 'chevron-down'} size={moderateScale(18)} color="#9CA3AF" />
          </Pressable>
          {expanded.photos ? (
            <View style={styles.block}>
              <View style={styles.grid}>
                {([
                  { key: 'toilet', label: '马桶', max: areaLimits.toilet },
                  { key: 'shower_drain', label: '淋浴房下水口', max: areaLimits.shower_drain },
                  { key: 'living', label: '客厅', max: areaLimits.living },
                  { key: 'sofa', label: '沙发', max: areaLimits.sofa },
                  { key: 'bedroom', label: '卧室', max: areaLimits.bedroom },
                  { key: 'kitchen', label: '厨房', max: areaLimits.kitchen },
                ] as Array<{ key: Exclude<InspectionPhotoArea, 'unclean'>; label: string; max: number }>).map((a) => (
                  <View key={a.key} style={styles.photoCard}>
                    <View style={styles.photoHeadRow}>
                      <Text style={styles.photoLabel}>{a.label}</Text>
                      <Text style={styles.photoCount}>{`${(roomPhotos[a.key] || []).length}/${a.max}`}</Text>
                    </View>
                    <View style={styles.thumbRow}>
                      {(roomPhotos[a.key] || []).length ? (
                        roomPhotos[a.key].map((u, idx) => (
                          <Pressable
                            key={`${u}-${idx}`}
                            onPress={() => {
                              setViewerUrl(u)
                              setViewerOpen(true)
                            }}
                            onLongPress={() => onRemoveRoomPhoto(a.key, idx)}
                            style={({ pressed }) => [styles.thumbMiniWrap, pressed ? styles.pressed : null]}
                          >
                            <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.thumbMini} />
                          </Pressable>
                        ))
                      ) : (
                        <View style={styles.thumbMiniEmpty}>
                          <Ionicons name="image-outline" size={moderateScale(16)} color="#9CA3AF" />
                          <Text style={[styles.photoEmptyText, { fontSize: 11 }]}>未拍</Text>
                        </View>
                      )}
                    </View>
                    <Pressable
                      onPress={() => onAddRoomPhoto(a.key)}
                      disabled={saving || (roomPhotos[a.key] || []).length >= a.max}
                      style={({ pressed }) => [styles.smallBtn, pressed ? styles.pressed : null, saving || (roomPhotos[a.key] || []).length >= a.max ? styles.submitDisabled : null]}
                    >
                      <Text style={styles.smallBtnText}>{(roomPhotos[a.key] || []).length >= a.max ? '已达上限' : '添加'}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Text style={styles.mutedSmall}>长按照片可删除。</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            {sectionTitle('checkmark-circle-outline', '5. 标记已完成')}
          </View>
          <View style={styles.block}>
            {guestSpecialRequest ? (
              <View style={styles.guestNeedCard}>
                <Text style={styles.guestNeedTitle}>客人需求（需要确认已完成）</Text>
                <Text style={styles.guestNeedText}>{guestSpecialRequest}</Text>
                <Pressable
                  onPress={() => setGuestNeedDone((v) => !v)}
                  style={({ pressed }) => [styles.guestNeedCheckRow, pressed ? styles.pressed : null]}
                >
                  <Ionicons name={guestNeedDone ? 'checkbox-outline' : 'square-outline'} size={moderateScale(18)} color={guestNeedDone ? '#16A34A' : '#6B7280'} />
                  <Text style={styles.guestNeedCheckText}>我已完成客人需求</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              onPress={() => props.navigation.navigate('InspectionComplete', { taskId: task.id })}
              disabled={!!guestSpecialRequest && !guestNeedDone}
              style={({ pressed }) => [styles.primaryBtn, pressed ? styles.pressed : null, !!guestSpecialRequest && !guestNeedDone ? styles.submitDisabled : null]}
            >
              <Text style={styles.primaryText}>进入标记已完成</Text>
            </Pressable>
          </View>
        </View>

        {loading ? <Text style={styles.muted}>{t('common_loading')}</Text> : null}
      </ScrollView>

      <Modal
        visible={restockPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRestockPickerOpen(false)
          setRestockPickerQuery('')
        }}
      >
        <Pressable
          style={styles.viewerMask}
          onPress={() => {
            setRestockPickerOpen(false)
            setRestockPickerQuery('')
          }}
        >
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHead}>
              <Text style={styles.pickerTitle}>选择补充项</Text>
              <Pressable
                onPress={() => {
                  setRestockPickerOpen(false)
                  setRestockPickerQuery('')
                }}
                style={({ pressed }) => [styles.pickerClose, pressed ? styles.pressed : null]}
              >
                <Text style={styles.pickerCloseText}>关闭</Text>
              </Pressable>
            </View>
            <View style={[styles.searchWrap, { marginTop: 10 }]}>
              <Ionicons name="search" size={moderateScale(16)} color="#9CA3AF" />
              <TextInput value={restockPickerQuery} onChangeText={setRestockPickerQuery} placeholder="搜索消耗品" placeholderTextColor="#9CA3AF" style={styles.searchInput} />
            </View>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {restockPickerItems.map((it) => (
                <Pressable key={it.id} onPress={() => addManualRestockItem(it)} style={({ pressed }) => [styles.pickerRow, pressed ? styles.pressed : null]}>
                  <Text style={styles.pickerRowText}>{String(it.label || it.id)}</Text>
                </Pressable>
              ))}
              {!restockPickerItems.length ? <Text style={styles.mutedSmall}>未找到</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
          <View style={[styles.viewerTopRow, { paddingTop: Math.max(10, insets.top) }]} pointerEvents="none">
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
  content: { padding: 16, paddingBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', marginBottom: 12 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%' },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  muted: { marginTop: 6, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  pressed: { opacity: 0.92 },

  guestNeedCard: { marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6' },
  guestNeedTitle: { color: '#111827', fontWeight: '900' },
  guestNeedText: { marginTop: 8, color: '#111827', fontWeight: '700', lineHeight: 20 },
  guestNeedCheckRow: { marginTop: 10, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#E5E7EB', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  guestNeedCheckText: { color: '#111827', fontWeight: '900' },

  progressRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center' },
  progressItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  progressDotOn: { backgroundColor: '#16A34A' },
  progressText: { marginLeft: 4, flexShrink: 1, minWidth: 0, fontSize: 10, fontWeight: '900', color: '#9CA3AF', textAlign: 'center' },
  progressTextOn: { color: '#16A34A' },
  progressLine: { width: 8, height: hairline(), backgroundColor: '#E5E7EB', marginHorizontal: 2, flexShrink: 0 },
  progressLineOn: { backgroundColor: '#16A34A' },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontWeight: '900', color: '#111827' },

  block: { marginTop: 10, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  label: { color: '#111827', fontWeight: '900' },
  row: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  chip: { flex: 1, minWidth: 120, height: 36, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  input: { borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  note: { height: 64, paddingTop: 10, textAlignVertical: 'top', marginTop: 10 },
  photoBtn: { height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  photoBtnText: { fontWeight: '900', color: '#111827' },
  previewBtn: { height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  previewBtnText: { fontWeight: '900', color: '#2563EB' },
  submitBtn: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  primaryBtn: { height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontWeight: '900' },
  linkBtn: { marginTop: 10, height: 38, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  linkText: { fontWeight: '900', color: '#2563EB' },

  grid: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', backgroundColor: '#F9FAFB', borderWidth: hairline(), borderColor: '#EEF0F6', borderRadius: 14, padding: 10 },
  photoHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoLabel: { fontWeight: '900', color: '#111827' },
  photoCount: { color: '#6B7280', fontWeight: '900', fontSize: 12 },
  photoThumbWrap: { marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  photoThumb: { width: '100%', height: moderateScale(110) },
  thumbMiniEmpty: { width: 54, height: 54, borderRadius: 10, borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoEmptyText: { color: '#9CA3AF', fontWeight: '800' },
  thumbRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbMiniWrap: { width: 54, height: 54, borderRadius: 10, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  thumbMini: { width: '100%', height: '100%' },
  smallBtn: { marginTop: 10, height: 34, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: '#2563EB', fontWeight: '900' },
  proofThumbWrap: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  proofThumb: { width: '100%', height: '100%' },
  uncleanThumbWrap: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  uncleanThumb: { width: '100%', height: '100%' },
  removeBtn: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#FEE2E2', borderWidth: hairline(), borderColor: '#FECACA', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontWeight: '900', color: '#991B1B' },

  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },

  pickerCard: { marginHorizontal: 16, marginTop: 90, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12 },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  pickerClose: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  pickerCloseText: { fontWeight: '900', color: '#111827' },
  pickerRow: { height: 44, justifyContent: 'center', borderBottomWidth: hairline(), borderBottomColor: '#EEF0F6', paddingHorizontal: 6 },
  pickerRowText: { fontWeight: '800', color: '#111827' },
  searchWrap: { height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, height: 44, color: '#111827', fontWeight: '800' },
})
