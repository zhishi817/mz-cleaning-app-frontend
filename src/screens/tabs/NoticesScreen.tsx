import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { useAuth } from '../../lib/auth'
import { useI18n } from '../../lib/i18n'
import { hairline, moderateScale } from '../../lib/scale'
import { getNoticesSnapshot, initNoticesStore, loadMoreNotices, refreshNotices, subscribeNotices, type Notice } from '../../lib/noticesStore'
import { getWorkTasksSnapshot, subscribeWorkTasks } from '../../lib/workTasksStore'
import { listCompanySecretsForApp, logCopyCompanySecretForApp } from '../../lib/api'
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
  const { token } = useAuth()
  const [hasInit, setHasInit] = useState(false)
  const [, setTick] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [secrets, setSecrets] = useState<Array<{ id: string; title: string; username?: string | null; note?: string | null; secret?: string | null; updated_at?: string | null }>>([])

  const snap = getNoticesSnapshot()
  const hasAnyUnread = Object.keys(snap.unreadIds || {}).length > 0
  const items = useMemo(() => {
    const base = showUnreadOnly ? snap.items.filter(n => !!snap.unreadIds[n.id]) : snap.items
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(n => {
      const a = String(n.title || '').toLowerCase()
      const b = String(n.summary || '').toLowerCase()
      const c = String(n.content || '').toLowerCase()
      return a.includes(q) || b.includes(q) || c.includes(q)
    })
  }, [query, showUnreadOnly, snap.items, snap.unreadIds])

  useEffect(() => {
    let unsub: (() => void) | null = null
    let unsub2: (() => void) | null = null
    ;(async () => {
      await initNoticesStore()
      setHasInit(true)
      unsub = subscribeNotices(() => setTick(v => v + 1))
      unsub2 = subscribeWorkTasks(() => setTick(v => v + 1))
      setTick(v => v + 1)
    })()
    const timer = setInterval(() => {
      refreshNotices().catch(() => {})
    }, 15000)
    return () => {
      clearInterval(timer)
      if (unsub) unsub()
      if (unsub2) unsub2()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!token) return
      try {
        const rows = await listCompanySecretsForApp(token)
        if (cancelled) return
        setSecrets(Array.isArray(rows) ? rows : [])
      } catch {}
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function onRefresh() {
    try {
      setRefreshing(true)
      await refreshNotices()
    } finally {
      setRefreshing(false)
    }
  }

  async function onLoadMore() {
    if (query.trim()) return
    if (loadingMore) return
    try {
      setLoadingMore(true)
      await loadMoreNotices(8)
    } finally {
      setLoadingMore(false)
    }
  }

  function normalizeHttpUrl(raw: string | null | undefined) {
    const u = String(raw || '').trim()
    if (!u) return null
    if (/^https?:\/\//i.test(u)) return u
    return `https://${u}`
  }

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const workItems = getWorkTasksSnapshot().items || []
    const results: Array<{
      id: string
      kind: 'property' | 'secret'
      title: string
      subtitle: string
      body: string
      icon: any
      url?: string | null
      copyText?: string | null
      secretId?: string
    }> = []
    const seen = new Set<string>()

    for (const s of secrets) {
      const title = String(s.title || '').trim()
      const user = String(s.username || '').trim()
      const note = String(s.note || '').trim()
      const secret = String(s.secret || '').trim()
      const hay = `${title} ${user} ${note} ${secret}`.toLowerCase()
      if (!hay.includes(q)) continue
      const key = String(s.id || '')
      if (!key || seen.has(`sec:${key}`)) continue
      seen.add(`sec:${key}`)
      const display = secret ? secret : '-'
      results.push({
        id: `sec:${key}`,
        kind: 'secret',
        title: title ? `密码：${title}` : '密码',
        subtitle: display,
        body: `${note || user ? `${note || user}\n` : ''}${display}`,
        icon: 'key-outline',
        copyText: display,
        secretId: key,
      })
      if (results.length >= 6) break
    }

    for (const it of workItems) {
      const code = String(it.property?.code || '').trim()
      const addr = String(it.property?.address || '').trim()
      const guide = normalizeHttpUrl((it.property as any)?.access_guide_link)
      const hay = `${code} ${addr}`.toLowerCase()
      if (!hay.includes(q)) continue
      const key = code || String((it.property as any)?.id || it.id)
      if (seen.has(key)) continue
      seen.add(key)
      if (code || addr) {
        results.push({
          id: `prop:${key}`,
          kind: 'property',
          title: code ? `房源：${code}` : '房源',
          subtitle: addr || '-',
          body: addr || '-',
          icon: 'home-outline',
          url: guide,
          copyText: addr || null,
        })
      }
      if (results.length >= 6) break
    }
    return results
  }, [query, secrets])

  function renderSearchResult(it: (typeof searchResults)[number]) {
    return (
      <Pressable
        key={it.id}
        onPress={() =>
          props.navigation.navigate('InfoCenterDetail', {
            kind: it.kind,
            title: it.title,
            subtitle: it.subtitle,
            body: it.body,
            url: it.url || null,
            copyText: it.copyText || null,
            secretId: it.secretId,
          })
        }
        style={({ pressed }) => [styles.searchResultRow, pressed ? styles.rowPressed : null]}
      >
        <View style={styles.searchResultIcon}>
          <Ionicons name={it.icon} size={moderateScale(18)} color="#2563EB" />
        </View>
        <View style={styles.searchResultMain}>
          <Text style={styles.searchResultTitle} numberOfLines={1}>
            {it.title}
          </Text>
          <Text style={styles.searchResultSummary} numberOfLines={1}>
            {it.subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={moderateScale(16)} color="#9CA3AF" />
      </Pressable>
    )
  }

  function renderItem({ item }: { item: Notice }) {
    const meta = typeMeta(item.type)
    const unread = !!getNoticesSnapshot().unreadIds[item.id]
    const icon = item.type === 'update' ? 'megaphone-outline' : item.type === 'key' ? 'key-outline' : 'clipboard-outline'
    return (
      <Pressable onPress={() => props.navigation.navigate('NoticeDetail', { id: item.id })} style={({ pressed }) => [styles.noticeRow, pressed ? styles.rowPressed : null]}>
        <View style={[styles.noticeIconWrap, { backgroundColor: meta.bg, borderColor: meta.bg }]}>
          <Ionicons name={icon as any} size={moderateScale(18)} color={meta.fg} />
        </View>
        <View style={styles.noticeMain}>
          <Text style={styles.noticeTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.noticeSummary} numberOfLines={1}>
            {item.summary}
          </Text>
        </View>
        <View style={styles.noticeRight}>
          <View style={styles.noticeTimeRow}>
            <Text style={styles.noticeTime}>{formatTime(item.createdAt).split(' ')[1]}</Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
          <Ionicons name="chevron-forward" size={moderateScale(16)} color="#9CA3AF" />
        </View>
      </Pressable>
    )
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>工作中心</Text>
        <Pressable
          onPress={() => setShowUnreadOnly(v => !v)}
          style={({ pressed }) => [styles.bellBtn, pressed ? styles.rowPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="toggle-unread"
        >
          <Ionicons name="notifications-outline" size={moderateScale(20)} color="#111827" />
          {hasAnyUnread ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={moderateScale(18)} color="#9CA3AF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          placeholder="输入关键词搜索房源、仓库、密码…"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.shortcutsRow}>
        <Pressable
          onPress={() => {
            setQuery('')
            setShowUnreadOnly(false)
          }}
          style={({ pressed }) => [styles.shortcut, pressed ? styles.rowPressed : null]}
        >
          <View style={[styles.shortcutIcon, { backgroundColor: '#FDECD2' }]}>
          <Ionicons name="megaphone-outline" size={moderateScale(20)} color="#F97316" />
          </View>
          <Text style={styles.shortcutText}>最新通知</Text>
        </Pressable>
        <Pressable
          onPress={() => setQuery('指南')}
          style={({ pressed }) => [styles.shortcut, pressed ? styles.rowPressed : null]}
        >
          <View style={[styles.shortcutIcon, { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name="book-outline" size={moderateScale(20)} color="#2563EB" />
          </View>
          <Text style={styles.shortcutText}>工作指南</Text>
        </Pressable>
        <Pressable
          onPress={() => setQuery('仓库')}
          style={({ pressed }) => [styles.shortcut, pressed ? styles.rowPressed : null]}
        >
          <View style={[styles.shortcutIcon, { backgroundColor: '#DCFCE7' }]}>
          <Ionicons name="home-outline" size={moderateScale(20)} color="#16A34A" />
          </View>
          <Text style={styles.shortcutText}>仓库指南</Text>
        </Pressable>
      </View>

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

      {searchResults.length ? (
        <>
          <Text style={styles.sectionLabel}>搜索结果</Text>
          <View style={styles.searchResultsWrap}>{searchResults.map(renderSearchResult)}</View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>通知列表</Text>

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
        onEndReached={query.trim() ? undefined : onLoadMore}
        ListFooterComponent={
          !query.trim() && loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator />
              <Text style={styles.footerText}>{t('common_loading')}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  topBar: { paddingHorizontal: 16, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: moderateScale(22), fontWeight: '900', color: '#111827' },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', right: 10, top: 10, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' },

  searchWrap: { marginTop: 12, marginHorizontal: 16, height: 40, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, minWidth: 0, height: 40, color: '#111827', fontWeight: '700', fontSize: 14 },

  shortcutsRow: { marginTop: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  shortcut: { flex: 1, alignItems: 'center' },
  shortcutIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  shortcutText: { marginTop: 8, color: '#111827', fontWeight: '700', fontSize: 13 },

  filterRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  filterChip: {
    flex: 1,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: hairline(),
    borderColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { fontSize: 13, fontWeight: '800', color: '#6B7280' },
  filterTextActive: { color: '#FFFFFF' },

  sectionLabel: { paddingHorizontal: 16, paddingTop: 10, color: '#9CA3AF', fontWeight: '900', fontSize: 12 },
  searchResultsWrap: { paddingHorizontal: 16, paddingTop: 8 },
  searchResultRow: { height: 56, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: hairline(), borderColor: '#EEF0F6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchResultIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: hairline(), borderColor: '#DBEAFE' },
  searchResultMain: { flex: 1, minWidth: 0 },
  searchResultTitle: { color: '#111827', fontWeight: '900', fontSize: 14 },
  searchResultSummary: { marginTop: 3, color: '#9CA3AF', fontWeight: '700', fontSize: 12 },

  loadingWrap: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#6B7280', fontWeight: '700' },

  listContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10 },
  sep: { height: 10 },
  rowPressed: { opacity: 0.92 },
  noticeRow: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, borderWidth: hairline(), borderColor: '#EEF0F6', flexDirection: 'row', alignItems: 'center', gap: 10 },
  noticeIconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: hairline() },
  noticeMain: { flex: 1, minWidth: 0 },
  noticeTitle: { color: '#111827', fontWeight: '900', fontSize: moderateScale(14) },
  noticeSummary: { marginTop: 3, color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  noticeRight: { alignItems: 'flex-end', justifyContent: 'space-between', height: 40 },
  noticeTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeTime: { color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },

  footer: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerText: { color: '#6B7280', fontWeight: '700' },
})
