import React, { useEffect, useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { hairline, moderateScale } from '../../lib/scale'
import { getNoticesSnapshot, initNoticesStore, markNoticeRead } from '../../lib/noticesStore'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'
import { useI18n } from '../../lib/i18n'

type Props = NativeStackScreenProps<NoticesStackParamList, 'NoticeDetail'>

function formatTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function NoticeDetailScreen(props: Props) {
  const { t } = useI18n()
  const id = props.route.params.id

  const notice = useMemo(() => getNoticesSnapshot().items.find(n => n.id === id) || null, [id])

  useEffect(() => {
    ;(async () => {
      await initNoticesStore()
      await markNoticeRead(id)
    })()
  }, [id])

  if (!notice) {
    return (
      <View style={styles.page}>
        <Text style={styles.errorText}>{t('common_error')}</Text>
      </View>
    )
  }

  const meta =
    notice.type === 'update'
      ? { bg: '#EFF6FF', fg: '#2563EB' }
      : notice.type === 'key'
        ? { bg: '#DCFCE7', fg: '#16A34A' }
        : { bg: '#F3F4F6', fg: '#374151' }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.fg }]}>{notice.type === 'key' ? t('notices_type_key') : notice.type === 'update' ? t('notices_type_update') : t('notices_type_system')}</Text>
          </View>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={moderateScale(14)} color="#9CA3AF" />
            <Text style={styles.time}>{formatTime(notice.createdAt)}</Text>
          </View>
        </View>

        <Text style={styles.title}>{notice.title}</Text>
        <Text style={styles.body}>{notice.content}</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { height: 26, borderRadius: 13, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '900' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  title: { marginTop: 12, fontSize: moderateScale(18), fontWeight: '900', color: '#111827' },
  body: { marginTop: 10, color: '#374151', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  errorText: { padding: 16, color: '#6B7280', fontWeight: '700' },
})

