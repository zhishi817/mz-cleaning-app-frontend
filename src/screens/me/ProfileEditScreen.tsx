import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { defaultProfileFromUser, getProfile, setProfile, type Profile } from '../../lib/profileStore'
import { getMyProfile, updateMyProfile, uploadMzappMedia } from '../../lib/api'
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

function isValidAbn(input: string) {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return true
  return digits.length === 11
}

function roleNamesOf(user: any) {
  const arr = Array.isArray(user?.roles) ? user.roles : []
  const names = arr.map((v: any) => String(v || '').trim()).filter(Boolean)
  const primary = String(user?.role || '').trim()
  if (primary) names.unshift(primary)
  return Array.from(new Set(names))
}

function canEditComplianceFields(user: any) {
  const roles = roleNamesOf(user)
  return roles.some((role) =>
    role === 'cleaner' ||
    role === 'cleaning_inspector' ||
    role === 'cleaner_inspector' ||
    role === 'inventory_manager' ||
    role === 'offline_manager',
  )
}

function profileFromRemote(remote: any, fallback: Profile): Profile {
  return {
    avatar_url: remote?.avatar_url || fallback.avatar_url || null,
    display_name: String(remote?.display_name || remote?.username || fallback.display_name || ''),
    phone_au: String(remote?.phone_au || fallback.phone_au || ''),
    legal_name: String(remote?.legal_name || fallback.legal_name || ''),
    bank_account_name: String(remote?.bank_account_name || fallback.bank_account_name || ''),
    bank_bsb: String(remote?.bank_bsb || fallback.bank_bsb || ''),
    bank_account_number: String(remote?.bank_account_number || fallback.bank_account_number || ''),
    personal_abn: String(remote?.personal_abn || fallback.personal_abn || ''),
    photo_id_url: remote?.photo_id_url || fallback.photo_id_url || null,
  }
}

async function pickSingleImage(t: (key: any) => string) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert(t('common_error'), t('profile_no_permission'))
    return null
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
    allowsEditing: false,
  })
  if (result.canceled) return null
  return (result.assets?.[0] as any) || null
}

export default function ProfileEditScreen() {
  const { user, token } = useAuth()
  const { t } = useI18n()
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingPhotoId, setUploadingPhotoId] = useState(false)
  const [form, setForm] = useState<Profile>(() => defaultProfileFromUser(user))
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null)
  const [localPhotoIdUri, setLocalPhotoIdUri] = useState<string | null>(null)
  const showComplianceFields = useMemo(() => canEditComplianceFields(user), [user])

  const initials = useMemo(() => {
    const parts = form.display_name.trim().split(/\s+/g).filter(Boolean)
    const a = (parts[0] || '?')[0] || '?'
    const b = parts.length > 1 ? (parts[parts.length - 1] || '')[0] || '' : ''
    return `${a}${b}`.toUpperCase()
  }, [form.display_name])
  useEffect(() => {
    ;(async () => {
      const saved = (await getProfile(user)) || defaultProfileFromUser(user)
      setForm(saved)
      if (token) {
        try {
          const remote = await getMyProfile(token)
          setForm(profileFromRemote(remote, saved))
        } catch {}
      }
    })()
  }, [token, user])

  async function pickAvatar() {
    try {
      const asset = await pickSingleImage(t)
      const uri = String(asset?.uri || '').trim()
      if (!uri) return
      setLocalAvatarUri(uri)
      if (!token) {
        Alert.alert(t('common_error'), '请先登录')
        return
      }
      setUploadingAvatar(true)
      const name = String(asset?.fileName || uri.split('/').pop() || `avatar-${Date.now()}.jpg`)
      const mimeType = String(asset?.mimeType || 'image/jpeg')
      const up = await uploadMzappMedia(token, { uri, name, mimeType })
      const updated = await updateMyProfile(token, { avatar_url: up.url })
      const next = profileFromRemote(updated, { ...form, avatar_url: up.url })
      setForm(next)
      await setProfile(user, next)
    } catch {
      Alert.alert(t('common_error'), t('profile_pick_failed'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function pickPhotoId() {
    try {
      const asset = await pickSingleImage(t)
      const uri = String(asset?.uri || '').trim()
      if (!uri) return
      setLocalPhotoIdUri(uri)
      if (!token) {
        Alert.alert(t('common_error'), '请先登录')
        return
      }
      setUploadingPhotoId(true)
      const name = String(asset?.fileName || uri.split('/').pop() || `photo-id-${Date.now()}.jpg`)
      const mimeType = String(asset?.mimeType || 'image/jpeg')
      const up = await uploadMzappMedia(token, { uri, name, mimeType }, { watermark_mode: 'photo_id_full' })
      const updated = await updateMyProfile(token, { photo_id_url: up.url })
      const next = profileFromRemote(updated, { ...form, photo_id_url: up.url })
      setForm(next)
      await setProfile(user, next)
      Alert.alert(t('common_ok'), t('common_saved'))
    } catch {
      Alert.alert(t('common_error'), t('profile_upload_failed'))
    } finally {
      setUploadingPhotoId(false)
    }
  }

  async function onSave() {
    const nameOk = isValidName(form.display_name)
    const mobileOk = isValidAuMobile(form.phone_au)
    const abnOk = showComplianceFields ? isValidAbn(form.personal_abn) : true
    if (!nameOk) {
      Alert.alert(t('common_error'), t('profile_invalid_name'))
      return
    }
    if (!mobileOk) {
      Alert.alert(t('common_error'), t('profile_invalid_phone'))
      return
    }
    if (!abnOk) {
      Alert.alert(t('common_error'), t('profile_invalid_abn'))
      return
    }
    try {
      setSaving(true)
      const cleaned: Profile = {
        ...form,
        display_name: form.display_name.trim(),
        phone_au: form.phone_au.trim(),
        legal_name: form.legal_name.trim(),
        bank_account_name: form.bank_account_name.trim(),
        bank_bsb: form.bank_bsb.trim(),
        bank_account_number: form.bank_account_number.trim(),
        personal_abn: form.personal_abn.trim(),
      }
      if (token) {
        const updated = await updateMyProfile(token, {
          display_name: cleaned.display_name,
          phone_au: cleaned.phone_au || null,
          avatar_url: cleaned.avatar_url,
          legal_name: showComplianceFields ? (cleaned.legal_name || null) : undefined,
          bank_account_name: showComplianceFields ? (cleaned.bank_account_name || null) : undefined,
          bank_bsb: showComplianceFields ? (cleaned.bank_bsb || null) : undefined,
          bank_account_number: showComplianceFields ? (cleaned.bank_account_number || null) : undefined,
          personal_abn: showComplianceFields ? (cleaned.personal_abn || null) : undefined,
          photo_id_url: showComplianceFields ? cleaned.photo_id_url : undefined,
        })
        Object.assign(cleaned, profileFromRemote(updated, cleaned))
      }
      await setProfile(user, cleaned)
      setForm(cleaned)
      Alert.alert(t('common_ok'), t('common_saved'))
    } catch {
      Alert.alert(t('common_error'), t('profile_save_failed'))
    } finally {
      setSaving(false)
    }
  }

  function setField<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          {localAvatarUri || form.avatar_url ? (
            <Image source={{ uri: localAvatarUri || form.avatar_url || '' }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Pressable
            onPress={pickAvatar}
            style={({ pressed }) => [styles.avatarBtn, pressed ? styles.pressed : null, uploadingAvatar ? styles.actionDisabled : null]}
            disabled={Platform.OS === 'web' || uploadingAvatar}
          >
            <Ionicons name="image-outline" size={moderateScale(18)} color="#2563EB" />
            <Text style={styles.avatarBtnText}>{uploadingAvatar ? t('task_uploading') : t('profile_avatar')}</Text>
          </Pressable>
        </View>

        {Platform.OS === 'web' && (
          <View style={styles.field}>
            <Text style={styles.label}>Avatar URL</Text>
            <TextInput value={form.avatar_url || ''} onChangeText={v => setField('avatar_url', v || null)} style={styles.input} placeholder="https://..." />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>个人资料</Text>
          <View style={styles.field}>
            <Text style={styles.label}>{t('profile_name')}</Text>
            <TextInput value={form.display_name} onChangeText={v => setField('display_name', v)} style={styles.input} placeholder={t('profile_name')} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>{t('profile_phone')}</Text>
            <TextInput
              value={form.phone_au}
              onChangeText={v => setField('phone_au', v)}
              style={styles.input}
              placeholder="04xx xxx xxx"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {showComplianceFields ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>登记信息</Text>
              <View style={styles.field}>
                <Text style={styles.label}>{t('profile_legal_name')}</Text>
                <TextInput value={form.legal_name} onChangeText={v => setField('legal_name', v)} style={styles.input} placeholder={t('profile_legal_name')} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t('profile_personal_abn')}</Text>
                <TextInput
                  value={form.personal_abn}
                  onChangeText={v => setField('personal_abn', v)}
                  style={styles.input}
                  placeholder="11 digits"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>银行转账信息</Text>
              <View style={styles.field}>
                <Text style={styles.label}>{t('profile_bank_account_name')}</Text>
                <TextInput value={form.bank_account_name} onChangeText={v => setField('bank_account_name', v)} style={styles.input} placeholder={t('profile_bank_account_name')} />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t('profile_bank_bsb')}</Text>
                <TextInput
                  value={form.bank_bsb}
                  onChangeText={v => setField('bank_bsb', v)}
                  style={styles.input}
                  placeholder="123-456"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t('profile_bank_account_number')}</Text>
                <TextInput
                  value={form.bank_account_number}
                  onChangeText={v => setField('bank_account_number', v)}
                  style={styles.input}
                  placeholder={t('profile_bank_account_number')}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profile_photo_id')}</Text>
              <Text style={styles.hint}>{t('profile_photo_id_hint')}</Text>
              {localPhotoIdUri || form.photo_id_url ? (
                <Image source={{ uri: localPhotoIdUri || form.photo_id_url || '' }} style={styles.photoIdImg} resizeMode="cover" />
              ) : (
                <View style={styles.photoIdPlaceholder}>
                  <Ionicons name="document-text-outline" size={24} color="#94A3B8" />
                  <Text style={styles.photoIdPlaceholderText}>{t('profile_photo_id_missing')}</Text>
                </View>
              )}
              <Pressable
                onPress={pickPhotoId}
                style={({ pressed }) => [styles.uploadBtn, pressed ? styles.pressed : null, uploadingPhotoId ? styles.actionDisabled : null]}
                disabled={Platform.OS === 'web' || uploadingPhotoId}
              >
                <Ionicons name="cloud-upload-outline" size={moderateScale(18)} color="#2563EB" />
                <Text style={styles.uploadBtnText}>{uploadingPhotoId ? t('task_uploading') : t('profile_photo_id_upload')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        <Pressable onPress={onSave} style={({ pressed }) => [styles.saveBtn, pressed ? styles.pressed : null, saving ? styles.saveDisabled : null]} disabled={saving}>
          <Text style={styles.saveText}>{saving ? t('common_loading') : t('profile_save')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16, paddingBottom: 28 },
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
  avatarImg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DBEAFE' },
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
  section: { marginTop: 18, paddingTop: 18, borderTopWidth: hairline(), borderTopColor: '#EEF0F6' },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: '#111827' },
  field: { marginTop: 12 },
  label: { marginBottom: 6, color: '#374151', fontWeight: '900' },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: hairline(),
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  hint: { marginTop: 8, color: '#6B7280', lineHeight: 20, fontWeight: '600' },
  photoIdImg: {
    marginTop: 12,
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  photoIdPlaceholder: {
    marginTop: 12,
    height: 140,
    borderRadius: 16,
    borderWidth: hairline(),
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoIdPlaceholderText: { color: '#64748B', fontWeight: '700' },
  uploadBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: hairline(),
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  uploadBtnText: { color: '#2563EB', fontWeight: '900' },
  saveBtn: {
    marginTop: 20,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDisabled: { backgroundColor: '#93C5FD' },
  saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  actionDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.92 },
})
