import React, { useMemo, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { uploadCleaningMedia, uploadDayEndBackupKeys } from '../../lib/api'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'DayEndBackupKeys'>

type Item = {
  id: string
  uri: string
  captured_at: string
  uploaded_url: string | null
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export default function DayEndBackupKeysScreen(props: Props) {
  const { t } = useI18n()
  const { token } = useAuth()
  const insets = useSafeAreaInsets()
  const [items, setItems] = useState<Item[]>([])
  const [uploading, setUploading] = useState(false)
  const date = String(props.route.params.date || '').slice(0, 10)

  const canSubmit = useMemo(() => items.length > 0 && items.every((x) => !!x.uploaded_url), [items])

  async function onAddPhoto() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('需要相机权限', '请在系统设置中允许相机权限后再拍照')
        return
      }
    } catch {}
    let res: ImagePicker.ImagePickerResult
    try {
      res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
    } catch {
      Alert.alert(t('common_error'), '无法打开相机（请用真机测试）')
      return
    }
    if (res.canceled || !res.assets?.length) return
    const a = res.assets[0] as any
    const uri = String(a.uri || '').trim()
    if (!uri) return
    const now = new Date().toISOString()
    const id = `bk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setItems((prev) => [{ id, uri, captured_at: now, uploaded_url: null }, ...prev])
  }

  async function onUploadAll() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!items.length) return Alert.alert(t('common_error'), '请先拍照')
    if (uploading) return
    setUploading(true)
    try {
      const next: Item[] = []
      for (const it of items) {
        if (it.uploaded_url) {
          next.push(it)
          continue
        }
        const name = `backup-key-${it.id}.jpg`
        const up = await uploadCleaningMedia(token, { uri: it.uri, name, mimeType: 'image/jpeg' }, { purpose: 'backup_key_return', captured_at: it.captured_at })
        next.push({ ...it, uploaded_url: up.url })
      }
      setItems(next)
      Alert.alert(t('common_ok'), '照片已上传')
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '上传失败'))
    } finally {
      setUploading(false)
    }
  }

  async function onSubmit() {
    if (!token) return Alert.alert(t('common_error'), '请先登录')
    if (!canSubmit) return Alert.alert(t('common_error'), '请先上传照片')
    if (uploading) return
    setUploading(true)
    try {
      const payload = items
        .map((x) => ({ url: String(x.uploaded_url || '').trim(), captured_at: x.captured_at }))
        .filter((x) => !!x.url)
      for (const part of chunk(payload, 30)) {
        await uploadDayEndBackupKeys(token, { date, items: part })
      }
      Alert.alert(t('common_ok'), '已提交日终备用钥匙照片')
      props.navigation.goBack()
    } catch (e: any) {
      Alert.alert(t('common_error'), String(e?.message || '提交失败'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
      <View style={styles.card}>
        <Text style={styles.title}>备用钥匙放回照片</Text>
        <Text style={styles.mutedSmall}>{`日期：${date || '-'}`}</Text>
        <Text style={styles.mutedSmall}>完成当天任务后，请上传备用钥匙已放回的照片（可多张）。</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.actionsRow}>
          <Pressable onPress={onAddPhoto} style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null]} disabled={uploading}>
            <Ionicons name="camera-outline" size={moderateScale(16)} color="#FFFFFF" />
            <Text style={styles.btnText}>拍照添加</Text>
          </Pressable>
          <Pressable onPress={onUploadAll} style={({ pressed }) => [styles.btnGray, pressed ? styles.pressed : null]} disabled={uploading || !items.length}>
            <Text style={styles.btnGrayText}>{uploading ? t('common_loading') : '上传照片'}</Text>
          </Pressable>
        </View>

        {!items.length ? <Text style={styles.muted}>暂无照片</Text> : null}

        <View style={styles.grid}>
          {items.map((it) => (
            <View key={it.id} style={styles.gridItem}>
              <Image source={{ uri: it.uploaded_url || it.uri }} style={styles.gridImg} />
              <View style={styles.gridFoot}>
                <Text style={styles.gridMeta} numberOfLines={1}>
                  {it.uploaded_url ? '已上传' : '未上传'}
                </Text>
                <Pressable
                  onPress={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                  style={({ pressed }) => [styles.removeBtn, pressed ? styles.pressed : null]}
                  disabled={uploading}
                >
                  <Text style={styles.removeText}>删除</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={onSubmit} disabled={!canSubmit || uploading} style={({ pressed }) => [styles.submitBtn, pressed ? styles.pressed : null, !canSubmit || uploading ? styles.submitBtnDisabled : null]}>
          <Text style={styles.submitText}>{uploading ? t('common_loading') : '提交'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  muted: { marginTop: 10, color: '#6B7280', fontWeight: '700' },
  mutedSmall: { marginTop: 8, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { color: '#FFFFFF', fontWeight: '900' },
  btnGray: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  btnGrayText: { color: '#111827', fontWeight: '900' },
  grid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '48%', borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F9FAFB' },
  gridImg: { width: '100%', height: 160, backgroundColor: '#F3F4F6' },
  gridFoot: { padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  gridMeta: { color: '#6B7280', fontWeight: '800', flex: 1 },
  removeBtn: { height: 28, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: hairline(), borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#B91C1C', fontWeight: '900', fontSize: 12 },
  submitBtn: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: '#A7F3D0' },
  submitText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.92 },
})

