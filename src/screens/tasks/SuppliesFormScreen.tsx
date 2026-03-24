import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
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

  useEffect(() => {
    props.navigation.setOptions({ title: '补品填报' })
  }, [props.navigation])

  const task = useMemo(() => getWorkTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null, [props.route.params.taskId])

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
    return true
  }, [items])

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

          {items.map((it, idx) => (
            <View key={it.id} style={styles.itemBlock}>
              <Text style={styles.label}>{it.label}</Text>
              {it.id === 'other' ? (
                <TextInput
                  value={it.note}
                  onChangeText={v => setItem(idx, { note: v })}
                  style={[styles.input, styles.note, { marginTop: 8 }]}
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
                    <Pressable onPress={() => onTakeStockPhoto(idx)} style={({ pressed }) => [styles.photoBtn, pressed ? styles.pressed : null]}>
                      <Text style={styles.photoBtnText}>{it.photo_url ? '已拍照' : '拍照库存'}</Text>
                    </Pressable>
                  </View>
                  {it.photo_url ? (
                    <View style={styles.photoPreview}>
                      <Image source={{ uri: it.photo_url }} style={styles.photo} />
                    </View>
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
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#EEF0F6' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  badge: { height: 30, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { color: '#2563EB', fontWeight: '900' },
  sub: { marginTop: 8, color: '#6B7280', fontWeight: '700' },
  itemBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  label: { marginBottom: 8, color: '#111827', fontWeight: '900' },
  input: { height: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  row: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  qty: { flex: 1 },
  chip: { height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  note: { height: 80, paddingTop: 12, textAlignVertical: 'top', marginTop: 10 },
  photoBtn: { height: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  photoBtnText: { fontWeight: '900', color: '#111827' },
  photoPreview: { marginTop: 10, borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6' },
  photo: { width: '100%', height: moderateScale(200), backgroundColor: '#F3F4F6' },
  submitBtn: { marginTop: 14, height: 46, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  muted: { color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
})
