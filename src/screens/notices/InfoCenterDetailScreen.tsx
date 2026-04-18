import React, { useMemo } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useAuth } from '../../lib/auth'
import { logCopyCompanySecretForApp } from '../../lib/api'
import { hairline, moderateScale } from '../../lib/scale'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'
import { useI18n } from '../../lib/i18n'

type Props = NativeStackScreenProps<NoticesStackParamList, 'InfoCenterDetail'>

function normalizeHttpUrl(raw: string | null | undefined) {
  const u = String(raw || '').trim()
  if (!u) return null
  if (/^https?:\/\//i.test(u)) return u
  return `https://${u}`
}

export default function InfoCenterDetailScreen(props: Props) {
  const { t } = useI18n()
  const { token } = useAuth()
  const params = props.route.params

  const title = String(params.title || '').trim()
  const subtitle = String(params.subtitle || '').trim()
  const body = String(params.body || '').trim()
  const copyText = String(params.copyText || '').trim()
  const url = normalizeHttpUrl(params.url)
  const canCopy = !!copyText
  const canOpen = !!url

  const meta = useMemo(() => {
    if (params.kind === 'secret') return { icon: 'key-outline' as const, bg: '#EFF6FF', fg: '#2563EB' }
    if (params.kind === 'task') return { icon: 'time-outline' as const, bg: '#FEF3C7', fg: '#D97706' }
    if (params.kind === 'announcement') return { icon: 'megaphone-outline' as const, bg: '#FEF3C7', fg: '#D97706' }
    if (params.kind === 'guide') return { icon: 'book-outline' as const, bg: '#DBEAFE', fg: '#2563EB' }
    if (params.kind === 'warehouse_guide') return { icon: 'home-outline' as const, bg: '#DCFCE7', fg: '#16A34A' }
    return { icon: 'home-outline' as const, bg: '#F3F4F6', fg: '#374151' }
  }, [params.kind])

  async function onCopy() {
    if (!canCopy) return
    try {
      await Clipboard.setStringAsync(copyText)
      if (params.kind === 'secret' && params.secretId && token) {
        try {
          await logCopyCompanySecretForApp(token, String(params.secretId))
        } catch {}
      }
      Alert.alert(t('common_ok'), '已复制')
    } catch {
      Alert.alert(t('common_error'), '复制失败')
    }
  }

  async function onOpen() {
    if (!canOpen) return
    try {
      await Linking.openURL(url!)
    } catch {
      Alert.alert(t('common_error'), '打开失败')
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.headRow}>
          <View style={[styles.iconWrap, { backgroundColor: meta.bg, borderColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={moderateScale(20)} color={meta.fg} />
          </View>
          <View style={styles.headText}>
            <Text style={styles.title} numberOfLines={2}>
              {title || '-'}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {body ? <Text style={styles.body}>{body}</Text> : null}

        {canOpen || canCopy ? (
          <View style={styles.actionsRow}>
            {canOpen ? (
              <Pressable onPress={onOpen} style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}>
                <Ionicons name="open-outline" size={moderateScale(18)} color="#FFFFFF" />
                <Text style={styles.actionText}>打开</Text>
              </Pressable>
            ) : null}
            {canCopy ? (
              <Pressable onPress={onCopy} style={({ pressed }) => [styles.actionBtn, pressed ? styles.pressed : null]}>
                <Ionicons name="copy-outline" size={moderateScale(18)} color="#FFFFFF" />
                <Text style={styles.actionText}>复制</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: hairline(), borderColor: '#EEF0F6' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: hairline() },
  headText: { flex: 1, minWidth: 0 },
  title: { color: '#111827', fontSize: moderateScale(16), fontWeight: '900' },
  subtitle: { marginTop: 6, color: '#6B7280', fontWeight: '700', lineHeight: 18 },
  body: { marginTop: 14, color: '#374151', fontWeight: '600', lineHeight: 20 },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 38, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  actionText: { color: '#FFFFFF', fontWeight: '800' },
  pressed: { opacity: 0.92 },
})
