import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { Ionicons } from '@expo/vector-icons'
import type { TasksStackParamList } from '../../navigation/RootNavigator'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { completeTask, getTasksSnapshot, initTasksStore, setTaskKeyPhotoUploaded, subscribeTasks, type Task } from '../../lib/tasksStore'

type Props = NativeStackScreenProps<TasksStackParamList, 'TaskDetail'>

export default function TaskDetailScreen(props: Props) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [hasInit, setHasInit] = useState(false)
  const [, bump] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [pendingKeyUri, setPendingKeyUri] = useState<string | null>(null)
  const action = props.route.params.action
  const [completeOpen, setCompleteOpen] = useState(() => action === 'complete')
  const [completeSubmitting, setCompleteSubmitting] = useState(false)
  const [note, setNote] = useState('')
  const [supplies, setSupplies] = useState<string[]>([])
  const id = props.route.params.id

  useEffect(() => {
    let unsub: (() => void) | null = null
    ;(async () => {
      await initTasksStore()
      setHasInit(true)
      unsub = subscribeTasks(() => bump(v => v + 1))
      bump(v => v + 1)
    })()
    return () => {
      if (unsub) unsub()
    }
  }, [])

  const items = getTasksSnapshot().items
  const task = useMemo(() => items.find(x => x.id === id) || null, [id, items])

  const supplyOptions = useMemo(
    () => [
      { key: 'shampoo', label: t('supplies_shampoo') },
      { key: 'bodywash', label: t('supplies_bodywash') },
      { key: 'conditioner', label: t('supplies_conditioner') },
      { key: 'handsoap', label: t('supplies_handsoap') },
      { key: 'tissue', label: t('supplies_tissue') },
      { key: 'toiletpaper', label: t('supplies_toiletpaper') },
      { key: 'detergent', label: t('supplies_detergent') },
      { key: 'trashbag', label: t('supplies_trashbag') },
    ],
    [t],
  )

  function statusMeta(status: Task['status']) {
    if (status === 'cleaning') return { text: t('tasks_status_cleaning'), pill: styles.statusBlue, textStyle: styles.statusTextBlue }
    if (status === 'completed') return { text: t('task_status_completed'), pill: styles.statusGreen, textStyle: styles.statusTextGreen }
    return { text: t('task_status_pending_key'), pill: styles.statusAmber, textStyle: styles.statusTextAmber }
  }

  async function compressImage(uri: string) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    )
    return result.uri
  }

  async function simulateUpload(uri: string) {
    try {
      setUploading(true)
      await new Promise(resolve => setTimeout(resolve, 900))
      await setTaskKeyPhotoUploaded(id, uri)
      setPendingKeyUri(null)
      Alert.alert(t('common_ok'), t('task_uploaded'))
    } catch {
      Alert.alert(t('common_error'), t('profile_save_failed'))
    } finally {
      setUploading(false)
    }
  }

  async function takePhoto() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(t('common_error'), t('profile_no_permission'))
        return
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 4],
      })
      if (result.canceled) return
      const uri = result.assets?.[0]?.uri
      if (!uri) return
      const compressed = await compressImage(uri)
      setPendingKeyUri(compressed)
    } catch {
      Alert.alert(t('common_error'), t('profile_pick_failed'))
    }
  }

  async function pickPhoto() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(t('common_error'), t('profile_no_permission'))
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: true,
        aspect: [3, 4],
      })
      if (result.canceled) return
      const uri = result.assets?.[0]?.uri
      if (!uri) return
      const compressed = await compressImage(uri)
      setPendingKeyUri(compressed)
    } catch {
      Alert.alert(t('common_error'), t('profile_pick_failed'))
    }
  }

  if (!hasInit) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_loading')}</Text>
      </View>
    )
  }

  if (!task) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t('common_error')}</Text>
      </View>
    )
  }

  const meta = statusMeta(task.status)
  const previewUri = pendingKeyUri || task.keyPhotoUri

  function toggleSupply(key: string) {
    setSupplies(prev => (prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]))
  }

  async function submitComplete() {
    if (!task) return
    const trimmed = note.trim()
    if (supplies.length === 0 && !trimmed) {
      Alert.alert(t('common_error'), t('complete_error_required'))
      return
    }
    try {
      setCompleteSubmitting(true)
      await new Promise(resolve => setTimeout(resolve, 900))
      await completeTask({
        taskId: task.id,
        supplies,
        note: trimmed,
        completedAt: new Date().toISOString(),
        completedBy: String(user?.username || 'unknown'),
      })
      setCompleteOpen(false)
      Alert.alert(t('common_ok'), t('complete_success'))
    } catch {
      Alert.alert(t('common_error'), t('complete_failed'))
    } finally {
      setCompleteSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{task.title}</Text>
          <View style={[styles.statusPill, meta.pill]}>
            <Text style={[styles.statusText, meta.textStyle]}>{meta.text}</Text>
          </View>
        </View>
        <View style={styles.addrRow}>
          <Ionicons name="location-outline" size={moderateScale(14)} color="#9CA3AF" />
          <Text style={styles.addr}>{task.address}</Text>
        </View>

        {task.status === 'completed' && (
          <View style={styles.completedRow}>
            <Ionicons name="checkmark-done-outline" size={moderateScale(16)} color="#16A34A" />
            <Text style={styles.completedText}>
              {task.completedBy || '-'} · {task.completedAt ? new Date(task.completedAt).toLocaleString() : '-'}
            </Text>
          </View>
        )}

        <View style={styles.line} />

        <View style={styles.actionTopRow}>
          <Pressable
            onPress={pickPhoto}
            disabled={uploading || task.status === 'completed'}
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnBlue, pressed ? styles.pressed : null, uploading ? styles.actionDisabled : null, task.status === 'completed' ? styles.actionDisabled : null]}
          >
            <Ionicons name="cloud-upload-outline" size={moderateScale(16)} color="#FFFFFF" />
            <Text style={styles.actionText}>{t('tasks_btn_upload_key')}</Text>
          </Pressable>
          <Pressable
            onPress={() => props.navigation.navigate('RepairForm', { taskId: task.id })}
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnGray, pressed ? styles.pressed : null]}
          >
            <Ionicons name="construct-outline" size={moderateScale(16)} color="#111827" />
            <Text style={styles.actionTextDark}>{t('tasks_btn_repair')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setCompleteOpen(true)}
            disabled={completeSubmitting || task.status === 'completed'}
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnGreen, pressed ? styles.pressed : null, completeSubmitting ? styles.actionDisabled : null, task.status === 'completed' ? styles.actionDisabled : null]}
          >
            <Ionicons name="checkmark-circle-outline" size={moderateScale(16)} color="#FFFFFF" />
            <Text style={styles.actionText}>{t('tasks_btn_complete')}</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>{t('task_key_photo')}</Text>
        <View style={styles.photoBox}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={moderateScale(26)} color="#9CA3AF" />
              <Text style={styles.placeholderText}>{t('task_status_pending_key')}</Text>
            </View>
          )}
        </View>

        <View style={styles.btnRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="take-key-photo"
            onPress={takePhoto}
            disabled={uploading || Platform.OS === 'web'}
            style={({ pressed }) => [styles.btn, pressed ? styles.pressed : null, uploading ? styles.btnDisabled : null]}
          >
            <Ionicons name="camera" size={moderateScale(18)} color="#FFFFFF" />
            <Text style={styles.btnText}>{uploading ? t('task_uploading') : t('task_take_photo')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="pick-key-photo"
            onPress={pickPhoto}
            disabled={uploading}
            style={({ pressed }) => [styles.btnOutline, pressed ? styles.pressed : null, uploading ? styles.btnOutlineDisabled : null]}
          >
            <Ionicons name="images-outline" size={moderateScale(18)} color="#2563EB" />
            <Text style={styles.btnOutlineText}>{t('task_pick_photo')}</Text>
          </Pressable>
        </View>

        {pendingKeyUri && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="confirm-upload-key"
            onPress={() => simulateUpload(pendingKeyUri)}
            disabled={uploading}
            style={({ pressed }) => [styles.uploadBtn, uploading ? styles.btnDisabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.uploadText}>{uploading ? t('task_uploading') : t('tasks_btn_upload_key')}</Text>
          </Pressable>
        )}

        {Platform.OS === 'web' && <Text style={styles.webHint}>{t('task_web_hint')}</Text>}
      </View>

      <Modal visible={completeOpen} transparent animationType="fade" onRequestClose={() => setCompleteOpen(false)}>
        <View style={styles.modalMask}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('complete_title')}</Text>
              <Pressable onPress={() => setCompleteOpen(false)} style={({ pressed }) => [styles.iconBtn, pressed ? styles.pressed : null]}>
                <Ionicons name="close" size={moderateScale(18)} color="#111827" />
              </Pressable>
            </View>

            <Text style={styles.modalSection}>{t('complete_supplies')}</Text>
            <View style={styles.modalChips}>
              {supplyOptions.map(o => {
                const on = supplies.includes(o.key)
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => toggleSupply(o.key)}
                    style={({ pressed }) => [styles.modalChip, on ? styles.modalChipOn : null, pressed ? styles.pressed : null]}
                  >
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={moderateScale(16)} color={on ? '#16A34A' : '#9CA3AF'} />
                    <Text style={[styles.modalChipText, on ? styles.modalChipTextOn : null]}>{o.label}</Text>
                  </Pressable>
                )
              })}
            </View>

            <Text style={styles.modalSection}>{t('complete_note')}</Text>
            <TextInput
              value={note}
              onChangeText={v => (v.length <= 500 ? setNote(v) : setNote(v.slice(0, 500)))}
              placeholder={t('complete_note_placeholder')}
              placeholderTextColor="#9CA3AF"
              multiline
              style={styles.modalInput}
            />
            <Text style={styles.counter}>{note.trim().length}/500</Text>

            <Pressable
              onPress={submitComplete}
              disabled={completeSubmitting}
              style={({ pressed }) => [styles.modalSubmit, completeSubmitting ? styles.modalSubmitDisabled : null, pressed ? styles.pressed : null]}
            >
              <Text style={styles.modalSubmitText}>{completeSubmitting ? t('common_loading') : t('complete_submit')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#EEF0F6' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  statusPill: { height: 28, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusBlue: { backgroundColor: '#DBEAFE' },
  statusAmber: { backgroundColor: '#FEF3C7' },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusText: { fontSize: 12, fontWeight: '900' },
  statusTextBlue: { color: '#2563EB' },
  statusTextAmber: { color: '#B45309' },
  statusTextGreen: { color: '#16A34A' },
  addrRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addr: { color: '#6B7280', fontSize: moderateScale(13), fontWeight: '600' },
  completedRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  completedText: { color: '#16A34A', fontWeight: '800' },
  line: { marginTop: 14, height: hairline(), backgroundColor: '#EEF0F6' },
  actionTopRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  actionBtnBlue: { backgroundColor: '#2563EB' },
  actionBtnGreen: { backgroundColor: '#16A34A' },
  actionBtnGray: { backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB' },
  actionText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  actionTextDark: { color: '#111827', fontWeight: '900', fontSize: 13 },
  actionDisabled: { opacity: 0.6 },
  section: { marginTop: 14, fontSize: 13, fontWeight: '900', color: '#111827' },
  photoBox: { marginTop: 10, borderRadius: 16, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  photo: { width: '100%', height: moderateScale(220) },
  photoPlaceholder: { height: moderateScale(220), alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderText: { color: '#6B7280', fontWeight: '800' },
  btnRow: { marginTop: 12, gap: 10 },
  btn: { height: 46, borderRadius: 14, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  btnOutline: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: hairline(),
    borderColor: '#DBEAFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnOutlineDisabled: { opacity: 0.6 },
  btnOutlineText: { color: '#2563EB', fontWeight: '900', fontSize: 15 },
  uploadBtn: { marginTop: 10, height: 46, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  uploadText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  pressed: { opacity: 0.92 },
  muted: { padding: 16, color: '#6B7280', fontWeight: '700' },
  webHint: { marginTop: 10, color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  modalMask: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#EEF0F6' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' },
  modalSection: { marginTop: 12, marginBottom: 8, color: '#111827', fontWeight: '900' },
  modalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modalChip: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalChipOn: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  modalChipText: { color: '#374151', fontWeight: '900' },
  modalChipTextOn: { color: '#166534' },
  modalInput: { height: 110, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, paddingTop: 12, fontWeight: '700', color: '#111827', textAlignVertical: 'top' },
  counter: { marginTop: 6, color: '#9CA3AF', fontWeight: '700', fontSize: 12, textAlign: 'right' },
  modalSubmit: { marginTop: 14, height: 46, borderRadius: 14, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center' },
  modalSubmitDisabled: { backgroundColor: '#86EFAC' },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
})
