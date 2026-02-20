import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { initTasksStore, getTasksSnapshot } from '../../lib/tasksStore'
import { createRepairTicket, type RepairUrgency, initRepairsStore } from '../../lib/repairsStore'
import type { TasksStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<TasksStackParamList, 'RepairForm'>

const TYPE_OPTIONS = ['plumbing', 'electrical', 'appliance', 'internet', 'other'] as const
type RepairType = (typeof TYPE_OPTIONS)[number]

const URGENCY_OPTIONS: RepairUrgency[] = ['low', 'medium', 'high']

export default function RepairFormScreen(props: Props) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [type, setType] = useState<RepairType | null>(null)
  const [urgency, setUrgency] = useState<RepairUrgency>('medium')
  const [contact, setContact] = useState('')
  const [desc, setDesc] = useState('')

  useEffect(() => {
    ;(async () => {
      await initTasksStore()
      await initRepairsStore()
      setReady(true)
    })()
  }, [])

  const task = useMemo(() => {
    if (!ready) return null
    return getTasksSnapshot().items.find(x => x.id === props.route.params.taskId) || null
  }, [props.route.params.taskId, ready])

  function typeLabel(k: RepairType) {
    if (k === 'plumbing') return t('repair_type_plumbing')
    if (k === 'electrical') return t('repair_type_electrical')
    if (k === 'appliance') return t('repair_type_appliance')
    if (k === 'internet') return t('repair_type_internet')
    return t('repair_type_other')
  }

  function urgencyLabel(u: RepairUrgency) {
    if (u === 'low') return t('repair_urgency_low')
    if (u === 'high') return t('repair_urgency_high')
    return t('repair_urgency_medium')
  }

  async function onSubmit() {
    if (!task) return
    const d = desc.trim()
    const c = contact.trim()
    if (!type) {
      Alert.alert(t('common_error'), t('repair_error_type'))
      return
    }
    if (!d) {
      Alert.alert(t('common_error'), t('repair_error_desc'))
      return
    }
    if (!c) {
      Alert.alert(t('common_error'), t('repair_error_contact'))
      return
    }

    try {
      setSubmitting(true)
      await new Promise(resolve => setTimeout(resolve, 800))
      await createRepairTicket({
        taskId: task.id,
        propertyTitle: task.title,
        address: task.address,
        type,
        description: d,
        urgency,
        contact: c,
        createdAt: new Date().toISOString(),
        createdBy: String(user?.username || 'unknown'),
      })
      Alert.alert(t('common_ok'), t('repair_success'))
      props.navigation.goBack()
    } catch {
      Alert.alert(t('common_error'), t('repair_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!task ? (
        <Text style={styles.muted}>{t('common_loading')}</Text>
      ) : (
        <View style={styles.card}>
          <View style={styles.headRow}>
            <Text style={styles.title}>{t('repair_title')}</Text>
            <View style={styles.badge}>
              <Ionicons name="home-outline" size={moderateScale(14)} color="#2563EB" />
              <Text style={styles.badgeText}>{task.title}</Text>
            </View>
          </View>
          <Text style={styles.sub}>{task.address}</Text>

          <Text style={styles.label}>{t('repair_field_type')}</Text>
          <View style={styles.chipsRow}>
            {TYPE_OPTIONS.map(k => (
              <Pressable
                key={k}
                onPress={() => setType(k)}
                style={({ pressed }) => [styles.chip, type === k ? styles.chipActive : null, pressed ? styles.pressed : null]}
              >
                <Text style={[styles.chipText, type === k ? styles.chipTextActive : null]}>{typeLabel(k)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('repair_field_urgency')}</Text>
          <View style={styles.chipsRow}>
            {URGENCY_OPTIONS.map(u => (
              <Pressable
                key={u}
                onPress={() => setUrgency(u)}
                style={({ pressed }) => [styles.chip, urgency === u ? styles.chipActive : null, pressed ? styles.pressed : null]}
              >
                <Text style={[styles.chipText, urgency === u ? styles.chipTextActive : null]}>{urgencyLabel(u)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('repair_field_contact')}</Text>
          <TextInput
            value={contact}
            onChangeText={setContact}
            style={styles.input}
            placeholder={t('repair_placeholder_contact')}
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>{t('repair_field_desc')}</Text>
          <TextInput
            value={desc}
            onChangeText={v => (v.length <= 500 ? setDesc(v) : setDesc(v.slice(0, 500)))}
            style={[styles.input, styles.textarea]}
            placeholder={t('repair_placeholder_desc')}
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <Text style={styles.counter}>{desc.trim().length}/500</Text>

          <Pressable
            onPress={onSubmit}
            disabled={submitting || !task}
            style={({ pressed }) => [styles.submitBtn, submitting ? styles.submitDisabled : null, pressed ? styles.pressed : null]}
          >
            <Text style={styles.submitText}>{submitting ? t('common_loading') : t('repair_submit')}</Text>
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
  label: { marginTop: 14, marginBottom: 8, color: '#111827', fontWeight: '900' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F3F4F6', borderWidth: hairline(), borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { color: '#374151', fontWeight: '900' },
  chipTextActive: { color: '#FFFFFF' },
  input: { height: 44, borderRadius: 12, borderWidth: hairline(), borderColor: '#D1D5DB', paddingHorizontal: 12, fontWeight: '700', color: '#111827' },
  textarea: { height: 120, paddingTop: 12, textAlignVertical: 'top' },
  counter: { marginTop: 6, color: '#9CA3AF', fontWeight: '700', fontSize: 12, textAlign: 'right' },
  submitBtn: { marginTop: 16, height: 46, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  submitDisabled: { backgroundColor: '#93C5FD' },
  submitText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  muted: { color: '#6B7280', fontWeight: '700' },
  pressed: { opacity: 0.92 },
})

