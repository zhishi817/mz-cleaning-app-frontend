import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getWorkTasksSnapshot } from '../../lib/workTasksStore'
import { listChecklistItems, submitCleaningConsumables, uploadCleaningMedia, type ChecklistItem } from '../../lib/api'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'SuppliesForm'>

type ItemState = {
  id: string
  label: string
  required: boolean
  status: 'ok' | 'low' | null
  qty: string
  note: string
  photo_url: string | null
}

export default function SuppliesFormScreen(props: Props) {
  const { t } = useI18n()
  const { token } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ItemState[]>([])
  const [photoUploadingIdx, setPhotoUploadingIdx] = useState<number | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [remoteAcPhotoUrl, setRemoteAcPhotoUrl] = useState<string | null>(null)
  const [remoteTvPhotoUrl, setRemoteTvPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    props.navigation.setOptions({ title: '补品填报' })
  }, [props.navigation])

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])
  const remainingNightsRaw = (task as any)?.remaining_nights
  const remainingNights0 = remainingNightsRaw == null ? null : Number(remainingNightsRaw)
  const remainingNights = Number.isFinite(remainingNights0 as any) ? (remainingNights0 as number) : null

  function setItem(idx: number, patch: Partial<ItemState>) {
    setItems(prev => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) return
      try {
        setLoading(true)
        const list = await listChecklistItems(token)
        if (cancelled) return
        const mapped = (list || []).map((it: ChecklistItem) => ({
          id: it.id,
          label: it.label,
          required: !!it.required,
          status: it.id === 'other' ? ('ok' as const) : (null as any),
          qty: '1',
          note: '',
          photo_url: null,
        }))
        setItems(mapped)
      } catch (e: any) {
        if (!cancelled) Alert.alert(t('common_error'), String(e?.message || '加载失败'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onTakeStockPhoto(idx: number) {
    if (!token) return
    try {
      setPhotoUploadingIdx(idx)
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `stock-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadCleaningMedia(token, { uri, name, mimeType })
      setItem(idx, { photo_url: up.url })
      Alert.alert(t('common_ok'), '库存照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setPhotoUploadingIdx(null)
    }
  }

  async function onTakeRemotePhoto(kind: 'ac' | 'tv') {
    if (!token) return
    try {
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 })
      if (res.canceled || !res.assets?.length) return
      const a = res.assets[0] as any
      const uri = String(a.uri || '').trim()
      if (!uri) return
      const name = String(a.fileName || uri.split('/').pop() || `remote-${kind}-${Date.now()}.jpg`)
      const mimeType = String(a.mimeType || 'image/jpeg')
      const up = await uploadCleaningMedia(token, { uri, name, mimeType })
      if (kind === 'ac') setRemoteAcPhotoUrl(up.url)
      else setRemoteTvPhotoUrl(up.url)
      Alert.alert(t('common_ok'), '照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    }
  }

  const canSubmit = useMemo(() => {
    if (!items.length) return false
    for (const it of items) {
      if (it.id !== 'other') {
        if (it.status !== 'ok' && it.status !== 'low') return false
      }
      if (it.status === 'low') {
        const q = Number(String(it.qty || '').trim())
        if (!Number.isFinite(q) || q < 1) return false
        if (!String(it.photo_url || '').trim()) return false
      }
    }
    if (!String(remoteTvPhotoUrl || '').trim()) return false
    return true
  }, [items, remoteAcPhotoUrl, remoteTvPhotoUrl])

  async function onSubmit() {
    if (!token) {
      Alert.alert(t('common_error'), '请先登录')
      return
    }
    if (!task || task.source_type !== 'cleaning_tasks') {
      Alert.alert(t('common_error'), '仅清洁任务支持补品填报')
      return
    }
    if (!canSubmit) {
      Alert.alert(t('common_error'), '请完成所有消耗品检查（不足项需拍照）')
      return
    }
    const out = items.map(x => ({
      item_id: x.id,
      status: x.status as any,
      qty: x.status === 'low' ? Number(String(x.qty || '').trim()) : undefined,
      note: x.note.trim() || undefined,
      photo_url: x.photo_url || undefined,
    }))
    if (String(remoteAcPhotoUrl || '').trim()) {
      out.push({
        item_id: 'remote_ac',
        status: 'ok' as any,
        photo_url: remoteAcPhotoUrl || undefined,
      } as any)
    }
    out.push({
      item_id: 'remote_tv',
      status: 'ok' as any,
      photo_url: remoteTvPhotoUrl || undefined,
    } as any)
    try {
      setSubmitting(true)
      await submitCleaningConsumables(token, String(task.source_id), { items: out })
      Alert.alert(t('common_ok'), '提交成功')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!task ? (
          <Text style={styles.muted}>{t('common_loading')}</Text>
        ) : loading ? (
          <Text style={styles.muted}>{t('common_loading')}</Text>
        ) : (
          <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>补品填报</Text>
            <View style={styles.badge}>
              <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
              <Text style={styles.badgeText}>{task.title}</Text>
            </View>
          </View>
          {task.property?.address ? <Text style={styles.sub}>{task.property.address}</Text> : null}
          <Text style={styles.sub}>{`待住晚数：${remainingNights == null ? '-' : String(remainingNights)}`}</Text>

          {items.map((it, idx) => (
            <View key={it.id} style={styles.itemBlock}>
              <Text style={styles.label}>{it.label}</Text>
              {it.id === 'other' ? (
                <TextInput
                  value={it.note}
                  onChangeText={v => setItem(idx, { note: v })}
                  style={[styles.input, styles.note, { marginTop: 6 }]}
                  placeholder="其他需要补充/检查的内容（可选）"
                  placeholderTextColor="#9CA3AF"
                  multiline
                />
              ) : (
                <View style={styles.row}>
                  <Pressable
                    onPress={() => setItem(idx, { status: 'ok', photo_url: null })}
                    style={({ pressed }) => [styles.chip, it.status === 'ok' ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, it.status === 'ok' ? styles.chipTextActive : null]}>足够</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setItem(idx, { status: 'low' })}
                    style={({ pressed }) => [styles.chip, it.status === 'low' ? styles.chipActive : null, pressed ? styles.pressed : null]}
                  >
                    <Text style={[styles.chipText, it.status === 'low' ? styles.chipTextActive : null]}>不足</Text>
                  </Pressable>
                </View>
              )}

              {it.status === 'low' ? (
                <>
                  <View style={styles.row}>
                    <TextInput
                      value={it.qty}
                      onChangeText={v => setItem(idx, { qty: v.replace(/[^\d]/g, '').slice(0, 6) })}
                      style={[styles.input, styles.qty]}
                      placeholder="缺多少（数量）"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                    />
                    <Pressable
                      onPress={() => onTakeStockPhoto(idx)}
                      disabled={photoUploadingIdx === idx}
                      style={({ pressed }) => [styles.photoBtn, photoUploadingIdx === idx ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
                    >
                      <Text style={styles.photoBtnText}>{photoUploadingIdx === idx ? t('common_loading') : it.photo_url ? '已拍照' : '拍照库存'}</Text>
                    </Pressable>
                  </View>
                  {it.photo_url ? (
                    <Pressable
                      onPress={() => {
                        setViewerUrl(it.photo_url)
                        setViewerOpen(true)
                      }}
                      style={({ pressed }) => [styles.photoPreview, pressed ? styles.pressed : null]}
                    >
                      <Image source={{ uri: it.photo_url }} style={styles.photo} />
                    </Pressable>
                  ) : null}
                  <TextInput
                    value={it.note}
                    onChangeText={v => setItem(idx, { note: v })}
                    style={[styles.input, styles.note]}
                    placeholder="备注（可选）"
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </>
              ) : null}
            </View>
          ))}

          <View style={styles.itemBlock}>
            <Text style={styles.label}>遥控器拍照</Text>
            <Text style={styles.muted}>请拍照：电视遥控器、空调遥控器。</Text>
            <Text style={styles.muted}>备注：空调遥控器嵌在墙上的不用拍照。</Text>

            <Text style={[styles.label, { marginTop: 10 }]}>空调遥控器</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => onTakeRemotePhoto('ac')}
                disabled={submitting}
                style={({ pressed }) => [styles.photoBtn, submitting ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
              >
                <Text style={styles.photoBtnText}>{remoteAcPhotoUrl ? '已拍照' : '拍照'}</Text>
              </Pressable>
            </View>
            {remoteAcPhotoUrl ? (
              <Pressable
                onPress={() => {
                  setViewerUrl(remoteAcPhotoUrl)
                  setViewerOpen(true)
                }}
                style={({ pressed }) => [styles.photoPreview, pressed ? styles.pressed : null]}
              >
                <Image source={{ uri: remoteAcPhotoUrl }} style={styles.photo} />
              </Pressable>
            ) : null}

            <Text style={[styles.label, { marginTop: 12 }]}>电视遥控器</Text>
            <View style={styles.row}>
              <Pressable
                onPress={() => onTakeRemotePhoto('tv')}
                disabled={submitting}
                style={({ pressed }) => [styles.photoBtn, submitting ? styles.photoBtnDisabled : null, pressed ? styles.pressed : null]}
              >
                <Text style={styles.photoBtnText}>{remoteTvPhotoUrl ? '已拍照' : '拍照'}</Text>
              </Pressable>
            </View>
            {remoteTvPhotoUrl ? (
              <Pressable
                onPress={() => {
                  setViewerUrl(remoteTvPhotoUrl)
                  setViewerOpen(true)
                }}
                style={({ pressed }) => [styles.photoPreview, pressed ? styles.pressed : null]}
              >
                <Image source={{ uri: remoteTvPhotoUrl }} style={styles.photo} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={submitting || !canSubmit}
            style={({ pressed }) => [styles.submitBtn, submitting || !canSubmit ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.submitText}>{submitting ? t('common_loading') : '提交'}</Text>
          </Pressable>
          </View>
        )}
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
              <Image source={{ uri: viewerUrl }} style={styles.viewerImg} resizeMode="contain" />
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
  card: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '70%' },
  badgeText: { color: '#2563EB', fontWeight: '900', flexShrink: 1 },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  itemBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  label: { marginBottom: 6, color: '#111827', fontWeight: '900' },
  input: { height: 38, borderRadius: 10, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 10, fontWeight: '700', color: '#111827' },
  row: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  qty: { flex: 1 },
  chip: { flex: 1, height: 36, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  note: { height: 64, paddingTop: 10, textAlignVertical: 'top', marginTop: 8 },
  photoBtn: { height: 38, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  photoBtnDisabled: { backgroundColor: '#E5E7EB' },
  photoBtnText: { fontWeight: '900', color: '#111827' },
  photoPreview: { marginTop: 8, borderRadius: 12, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  photo: { width: '100%', height: moderateScale(160), backgroundColor: '#F3F4F6' },
  submitBtn: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  muted: { color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
})
