import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { defaultProfileFromUser, getProfile, setProfile, type Profile } from '../../lib/profileStore'
import { hairline, moderateScale } from '../../lib/scale'

function isValidName(name: string) {
  const n = name.trim()
  return n.length >= 1 && n.length <= 40
}

function isValidAuMobile(input: string) {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return true
  if (digits.startsWith('04') && digits.length === 10) return true
  if (digits.startsWith('614') && digits.length === 11) return true
  return false
}

export default function ProfileEditScreen() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Profile>(() => defaultProfileFromUser(user))

  const initials = useMemo(() => {
    const parts = form.name.trim().split(/\s+/g).filter(Boolean)
    const a = (parts[0] || '?')[0] || '?'
    const b = parts.length > 1 ? (parts[parts.length - 1] || '')[0] || '' : ''
    return `${a}${b}`.toUpperCase()
  }, [form.name])

  useEffect(() => {
    ;(async () => {
      const saved = await getProfile()
      if (saved) setForm(saved)
      else setForm(defaultProfileFromUser(user))
      setLoading(false)
    })()
  }, [user])

  async function pickAvatar() {
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
        aspect: [1, 1],
      })
      if (result.canceled) return
      const uri = result.assets?.[0]?.uri
      if (!uri) return
      setForm(prev => ({ ...prev, avatarUri: uri }))
    } catch {
      Alert.alert(t('common_error'), t('profile_pick_failed'))
    }
  }

  async function onSave() {
    const nameOk = isValidName(form.name)
    const mobileOk = isValidAuMobile(form.mobileAu)
    if (!nameOk) {
      Alert.alert(t('common_error'), t('profile_invalid_name'))
      return
    }
    if (!mobileOk) {
      Alert.alert(t('common_error'), t('profile_invalid_phone'))
      return
    }
    try {
      setSaving(true)
      await setProfile({ ...form, name: form.name.trim(), mobileAu: form.mobileAu.trim() })
      Alert.alert(t('common_ok'), t('common_saved'))
    } catch {
      Alert.alert(t('common_error'), t('profile_save_failed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.page}>
        <Text style={styles.loadingText}>{t('common_loading')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Pressable onPress={pickAvatar} style={({ pressed }) => [styles.avatarBtn, pressed ? styles.pressed : null]} disabled={Platform.OS === 'web'}>
            <Ionicons name="image-outline" size={moderateScale(18)} color="#2563EB" />
            <Text style={styles.avatarBtnText}>{t('profile_avatar')}</Text>
          </Pressable>
        </View>

        {Platform.OS === 'web' && (
          <View style={styles.field}>
            <Text style={styles.label}>Avatar URL</Text>
            <TextInput value={form.avatarUri || ''} onChangeText={v => setForm(p => ({ ...p, avatarUri: v || null }))} style={styles.input} placeholder="https://..." />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>{t('profile_name')}</Text>
          <TextInput value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} style={styles.input} placeholder={t('profile_name')} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('profile_phone')}</Text>
          <TextInput
            value={form.mobileAu}
            onChangeText={v => setForm(p => ({ ...p, mobileAu: v }))}
            style={styles.input}
            placeholder="04xx xxx xxx"
            keyboardType="phone-pad"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('profile_dept')}</Text>
          <TextInput value={form.department} onChangeText={v => setForm(p => ({ ...p, department: v }))} style={styles.input} placeholder={t('profile_dept')} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('profile_title')}</Text>
          <TextInput value={form.title} onChangeText={v => setForm(p => ({ ...p, title: v }))} style={styles.input} placeholder={t('profile_title')} />
        </View>

        <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, pressed ? styles.pressed : null, saving ? styles.saveDisabled : null]} disabled={saving}>
          <Text style={styles.saveText}>{t('profile_save')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: '#F6F7FB' },
  loadingText: { color: '#6B7280', fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#1D4ED8', fontSize: 18, fontWeight: '900' },
  avatarBtn: {
    height: 36,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: hairline(),
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  avatarBtnText: { color: '#2563EB', fontWeight: '900' },
  field: { marginTop: 12 },
  label: { marginBottom: 6, color: '#374151', fontWeight: '900' },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: hairline(),
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    fontWeight: '700',
    color: '#111827',
  },
  saveBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: { backgroundColor: '#93C5FD' },
  saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  pressed: { opacity: 0.92 },
})
