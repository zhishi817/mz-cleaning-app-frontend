import React, { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { defaultProfileFromUser, getProfile, type Profile } from '../../lib/profileStore'
import { hairline } from '../../lib/scale'
import type { MeStackParamList } from '../../navigation/RootNavigator'

function initialsOf(username: string) {
  const u = username.trim()
  if (!u) return '?'
  const p = u.split(/[\s._-]+/g).filter(Boolean)
  const head = (p[0] || u).slice(0, 1).toUpperCase()
  const tail = p.length > 1 ? (p[p.length - 1] || '').slice(0, 1).toUpperCase() : ''
  return `${head}${tail}`.trim() || head
}

type Props = NativeStackScreenProps<MeStackParamList, 'MeHome'>

export default function MeScreen(props: Props) {
  const { user, signOut } = useAuth()
  const { locale, setLocale, t } = useI18n()
  const [profile, setProfile] = useState<Profile>(() => defaultProfileFromUser(user))

  useFocusEffect(
    useCallback(() => {
      let alive = true
      ;(async () => {
        const saved = await getProfile()
        if (!alive) return
        setProfile(saved || defaultProfileFromUser(user))
      })()
      return () => {
        alive = false
      }
    }, [user]),
  )

  const initials = useMemo(() => initialsOf(profile?.name || user?.username || ''), [profile?.name, user?.username])

  async function onLogout() {
    const ok = await new Promise<boolean>(resolve => {
      Alert.alert(t('me_logout'), '确定退出当前账号？', [
        { text: t('common_cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('common_confirm'), style: 'destructive', onPress: () => resolve(true) },
      ])
    })
    if (!ok) return
    await signOut()
  }

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{profile?.name || user?.username || '-'}</Text>
            <Text style={styles.role}>{profile?.department || user?.role || '-'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardList}>
        <View style={styles.listRow}>
          <Text style={styles.listLabel}>{t('me_language')}</Text>
          <View style={styles.langWrap}>
            <Pressable
              onPress={() => setLocale('zh')}
              style={({ pressed }) => [styles.langChip, locale === 'zh' ? styles.langChipActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.langText, locale === 'zh' ? styles.langTextActive : null]}>中文</Text>
            </Pressable>
            <Pressable
              onPress={() => setLocale('en')}
              style={({ pressed }) => [styles.langChip, locale === 'en' ? styles.langChipActive : null, pressed ? styles.pressed : null]}
            >
              <Text style={[styles.langText, locale === 'en' ? styles.langTextActive : null]}>EN</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.sep} />
        <Pressable onPress={() => props.navigation.navigate('ProfileEdit')} style={({ pressed }) => [styles.listItem, pressed ? styles.pressed : null]}>
          <Ionicons name="person-circle-outline" size={20} color="#2563EB" />
          <Text style={styles.itemText}>{t('me_profile')}</Text>
        </Pressable>
        <View style={styles.sep} />
        <Pressable onPress={() => props.navigation.navigate('Account')} style={({ pressed }) => [styles.listItem, pressed ? styles.pressed : null]}>
          <Ionicons name="settings-outline" size={20} color="#2563EB" />
          <Text style={styles.itemText}>{t('me_account')}</Text>
        </Pressable>
      </View>

      <Pressable style={({ pressed }) => [styles.logoutBtn, pressed ? styles.logoutPressed : null]} onPress={onLogout}>
        <Text style={styles.logoutText}>{t('me_logout')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 16, backgroundColor: '#F6F7FB' },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#1D4ED8', fontSize: 18, fontWeight: '800' },
  username: { fontSize: 18, fontWeight: '800', color: '#111827' },
  role: { marginTop: 4, color: '#6B7280', fontSize: 13 },
  cardList: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    overflow: 'hidden',
  },
  listRow: { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listLabel: { fontSize: 14, fontWeight: '900', color: '#111827' },
  langWrap: { flexDirection: 'row', gap: 8 },
  langChip: { height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  langChipActive: { backgroundColor: '#2563EB' },
  langText: { fontSize: 12, fontWeight: '900', color: '#6B7280' },
  langTextActive: { color: '#FFFFFF' },
  listItem: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemText: { fontSize: 14, fontWeight: '900', color: '#111827' },
  sep: { height: hairline(), backgroundColor: '#EEF0F6' },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutPressed: { opacity: 0.9 },
  logoutText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.92 },
})
