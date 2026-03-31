import React, { useEffect, useMemo, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { hairline, moderateScale } from '../../lib/scale'
import { getNoticesSnapshot, initNoticesStore, markNoticeRead } from '../../lib/noticesStore'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'
import { useI18n } from '../../lib/i18n'
import { API_BASE_URL } from '../../config/env'
import { getAuthToken } from '../../lib/authStorage'
import { markInboxNotificationsRead } from '../../lib/api'

type Props = NativeStackScreenProps<NoticesStackParamList, 'NoticeDetail'>

function formatTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function toAbsoluteUrl(rawUrl: any) {
  const s0 = String(rawUrl ?? '').trim()
  if (!s0) return ''
  if (/^https?:\/\//i.test(s0)) return s0
  if (s0.startsWith('//')) return `https:${s0}`
  const base = normalizeBase(API_BASE_URL)
  const stripAuth = base.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const root = stripApi || stripAuth || base
  if (!root) return s0
  if (s0.startsWith('/')) return `${root}${s0}`
  return s0
}

function extractImageUrls(text: string) {
  const urls: string[] = []
  const lines = String(text || '').split('\n')
  for (const line of lines) {
    const m = line.match(/https?:\/\/\S+/g)
    if (!m) continue
    for (const u0 of m) {
      const u = u0.replace(/[),.。；;]$/g, '')
      if (!u) continue
      const lower = u.toLowerCase()
      if (lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp') || lower.includes('.gif')) {
        urls.push(u)
      }
    }
  }
  return Array.from(new Set(urls))
}

function stripUrlLines(text: string) {
  const lines = String(text || '').split('\n')
  const kept: string[] = []
  for (const line of lines) {
    if (/https?:\/\/\S+/i.test(line) && (line.includes('照片') || line.includes('图片') || line.includes('photo') || line.includes('image'))) continue
    kept.push(line)
  }
  return kept.join('\n').trim()
}

export default function NoticeDetailScreen(props: Props) {
  const { t } = useI18n()
  const id = props.route.params.id
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)

  const notice = useMemo(() => getNoticesSnapshot().items.find(n => n.id === id) || null, [id])

  useEffect(() => {
    ;(async () => {
      await initNoticesStore()
      await markNoticeRead(id)
      try {
        const token = await getAuthToken()
        if (token) await markInboxNotificationsRead(String(token), { ids: [id] })
      } catch {}
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
  const imgs = extractImageUrls(notice.content).slice(0, 3)
  const imagesAtBottom = notice.type === 'key'
  const bodyText = stripUrlLines(notice.content) || notice.content

  return (
    <>
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

          {!imagesAtBottom && imgs.length ? (
            <View style={styles.imagesWrap}>
              {imgs.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => {
                    setViewerUrl(u)
                    setViewerOpen(true)
                  }}
                  style={({ pressed }) => [styles.imagePress, pressed ? styles.pressed : null]}
                >
                  <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.image} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.body}>{bodyText}</Text>

          {imagesAtBottom && imgs.length ? (
            <View style={styles.imagesWrap}>
              {imgs.map((u) => (
                <Pressable
                  key={u}
                  onPress={() => {
                    setViewerUrl(u)
                    setViewerOpen(true)
                  }}
                  style={({ pressed }) => [styles.imagePress, pressed ? styles.pressed : null]}
                >
                  <Image source={{ uri: toAbsoluteUrl(u) }} style={styles.image} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setViewerOpen(false)
          setViewerUrl(null)
        }}
      >
        <Pressable
          style={styles.viewerMask}
          onPress={() => {
            setViewerOpen(false)
            setViewerUrl(null)
          }}
        >
          <View style={styles.viewerTopRow} pointerEvents="none">
            <Text style={styles.viewerCloseText}>点击任意位置关闭</Text>
          </View>
          {viewerUrl ? (
            <View style={{ flex: 1 }} pointerEvents="none">
              <Image source={{ uri: toAbsoluteUrl(viewerUrl) }} style={styles.viewerImg} resizeMode="contain" />
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
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
  pressed: { opacity: 0.92 },
  imagesWrap: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imagePress: { width: '48%', borderRadius: 14, overflow: 'hidden', borderWidth: hairline(), borderColor: '#EEF0F6', backgroundColor: '#F3F4F6' },
  image: { width: '100%', height: 160, backgroundColor: '#F3F4F6' },
  viewerMask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerTopRow: { position: 'absolute', top: 0, left: 0, right: 0, height: 54, paddingHorizontal: 12, justifyContent: 'center', zIndex: 2 },
  viewerCloseText: { color: '#FFFFFF', fontWeight: '900' },
  viewerImg: { flex: 1 },
})
