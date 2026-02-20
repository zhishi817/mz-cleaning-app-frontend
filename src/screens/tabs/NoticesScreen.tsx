import React, { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getNoticesSnapshot, initNoticesStore, loadMoreNotices, refreshNotices, subscribeNotices, type Notice } from '../../lib/noticesStore'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'

type Props = NativeStackScreenProps<NoticesStackParamList, 'NoticesList'>

function formatTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function typeMeta(type: Notice['type']) {
  if (type === 'update') return { labelKey: 'notices_type_update' as const, bg: '#EFF6FF', fg: '#2563EB' }
  if (type === 'key') return { labelKey: 'notices_type_key' as const, bg: '#DCFCE7', fg: '#16A34A' }
  return { labelKey: 'notices_type_system' as const, bg: '#F3F4F6', fg: '#374151' }
}

export default function NoticesScreen(props: Props) {
  const { t } = useI18n()
  const [hasInit, setHasInit] = useState(false)
  const [, setTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  const snap = getNoticesSnapshot()
  const items = showUnreadOnly ? snap.items.filter(n => !!snap.unreadIds[n.id]) : snap.items

  useEffect(() => {
    let unsub: (() => void) | null = null
    ;(async () => {
      await initNoticesStore()
      setHasInit(true)
      unsub = subscribeNotices(() => setTick(v => v + 1))
      setTick(v => v + 1)
    })()
    const timer = setInterval(() => {
      refreshNotices().catch(() => {})
    }, 15000)
    return () => {
      clearInterval(timer)
      if (unsub) unsub()
    }
  }, [])

  async function onRefresh() {
    try {
      setRefreshing(true)
      await refreshNotices()
    } finally {
      setRefreshing(false)
    }
  }

  async function onLoadMore() {
    if (loadingMore) return
    try {
      setLoadingMore(true)
      await loadMoreNotices(8)
    } finally {
      setLoadingMore(false)
    }
  }

  function renderItem({ item }: { item: Notice }) {
    const meta = typeMeta(item.type)
    const unread = !!getNoticesSnapshot().unreadIds[item.id]
    return (
      <Pressable
        onPress={() => props.navigation.navigate('NoticeDetail', { id: item.id })}
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      >
        <View style={styles.rowTop}>
          <View style={[styles.badge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.badgeText, { color: meta.fg }]}>{t(meta.labelKey)}</Text>
          </View>
          <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {unread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.summary} numberOfLines={2}>
          {item.summary}
        </Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.page}>
      <View style={styles.filterRow}>
        <Pressable
          onPress={() => setShowUnreadOnly(false)}
          style={({ pressed }) => [styles.filterChip, !showUnreadOnly ? styles.filterChipActive : null, pressed ? styles.rowPressed : null]}
        >
          <Text style={[styles.filterText, !showUnreadOnly ? styles.filterTextActive : null]}>{t('notices_all')}</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowUnreadOnly(true)}
          style={({ pressed }) => [styles.filterChip, showUnreadOnly ? styles.filterChipActive : null, pressed ? styles.rowPressed : null]}
        >
          <Text style={[styles.filterText, showUnreadOnly ? styles.filterTextActive : null]}>{t('notices_unread')}</Text>
        </Pressable>
      </View>

      {!hasInit && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>{t('common_loading')}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={it => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.2}
        onEndReached={onLoadMore}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator />
              <Text style={styles.footerText}>{t('common_loading')}</Text>
            </View>
          ) : null
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  filterRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  filterChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  filterTextActive: { color: '#FFFFFF' },

  loadingWrap: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#6B7280', fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 16 },
  sep: { height: 10 },
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
  },
  rowPressed: { opacity: 0.92 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { height: 24, borderRadius: 12, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  time: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  titleRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontSize: moderateScale(15), fontWeight: '900', color: '#111827' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  summary: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#6B7280', lineHeight: 18 },

  footer: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { color: '#6B7280', fontWeight: '700' },
})
