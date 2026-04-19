import React, { useMemo } from 'react'
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { API_BASE_URL } from '../../config/env'
import { useAuth } from '../../lib/auth'
import { logCopyCompanySecretForApp } from '../../lib/api'
import { companyGuideRoleLabel, hasStructuredCompanyContent, parseCompanyContentBlocks, type CompanyContentBlock, type CompanyContentStepItem } from '../../lib/companyContent'
import { hairline, moderateScale } from '../../lib/scale'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'
import { useI18n } from '../../lib/i18n'

type Props = NativeStackScreenProps<NoticesStackParamList, 'InfoCenterDetail'>

function normalizeBase(base: string) {
  return String(base || '').trim().replace(/\/+$/g, '')
}

function normalizeHttpUrl(raw: string | null | undefined) {
  const s0 = String(raw || '').trim()
  if (!s0) return null
  if (/^https?:\/\//i.test(s0)) return s0
  if (s0.startsWith('//')) return `https:${s0}`
  const base = normalizeBase(API_BASE_URL)
  const stripAuth = base.replace(/\/auth\/?$/g, '')
  const stripApi = stripAuth.replace(/\/api\/?$/g, '')
  const root = stripApi || stripAuth || base
  if (root && s0.startsWith('/')) return `${root}${s0}`
  if (/^[\w.-]+\.[a-z]{2,}/i.test(s0)) return `https://${s0}`
  return s0
}

export default function InfoCenterDetailScreen(props: Props) {
  const { t } = useI18n()
  const { token } = useAuth()
  const params = props.route.params

  const title = String(params.title || '').trim()
  const subtitle = String(params.subtitle || '').trim()
  const body = String(params.body || '').trim()
  const contentRaw = String(params.contentRaw || '').trim()
  const guideRoleLabel = companyGuideRoleLabel(params.guideRole)
  const copyText = String(params.copyText || '').trim()
  const url = normalizeHttpUrl(params.url)
  const canCopy = !!copyText
  const canOpen = !!url
  const structuredBlocks = useMemo(() => parseCompanyContentBlocks(contentRaw).blocks, [contentRaw])
  const showStructuredContent = useMemo(() => (params.kind === 'guide' || params.kind === 'warehouse_guide') && hasStructuredCompanyContent(contentRaw), [contentRaw, params.kind])

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

  async function openContentUrl(rawUrl: string | null | undefined) {
    const next = normalizeHttpUrl(rawUrl)
    if (!next) return
    try {
      await Linking.openURL(next)
    } catch {
      Alert.alert(t('common_error'), '打开失败')
    }
  }

  function renderStepItem(item: CompanyContentStepItem, key: string) {
    if (item.type === 'text') {
      const text = String(item.text || '').trim()
      if (!text) return null
      return <Text key={key} style={styles.stepText}>{text}</Text>
    }
    if (item.type === 'image') {
      const imageUrl = normalizeHttpUrl(item.url)
      if (!imageUrl) return null
      return (
        <View key={key} style={styles.mediaWrap}>
          <Image source={{ uri: imageUrl }} style={styles.mediaImage} resizeMode="contain" />
          {item.caption ? <Text style={styles.mediaCaption}>{String(item.caption || '').trim()}</Text> : null}
        </View>
      )
    }
    if (item.type === 'video') {
      const videoUrl = normalizeHttpUrl(item.url)
      if (!videoUrl) return null
      return (
        <Pressable key={key} onPress={() => openContentUrl(videoUrl)} style={({ pressed }) => [styles.linkCard, pressed ? styles.pressed : null]}>
          <Ionicons name="play-circle-outline" size={moderateScale(20)} color="#2563EB" />
          <View style={styles.linkCardText}>
            <Text style={styles.linkCardTitle}>打开视频</Text>
            {item.caption ? <Text style={styles.linkCardSubtitle}>{String(item.caption || '').trim()}</Text> : null}
          </View>
          <Ionicons name="open-outline" size={moderateScale(16)} color="#94A3B8" />
        </Pressable>
      )
    }
    return null
  }

  function renderBlock(block: CompanyContentBlock, idx: number, stepNumber: number) {
    if (block.type === 'heading') {
      const text = String(block.text || '').trim()
      if (!text) return null
      return <Text key={`heading-${idx}`} style={styles.contentHeading}>{text}</Text>
    }
    if (block.type === 'paragraph') {
      const text = String(block.text || '').trim()
      if (!text) return null
      return <Text key={`paragraph-${idx}`} style={styles.contentParagraph}>{text}</Text>
    }
    if (block.type === 'callout') {
      const text = String(block.text || '').trim()
      if (!text) return null
      return (
        <View key={`callout-${idx}`} style={styles.calloutCard}>
          <Ionicons name="bulb-outline" size={moderateScale(18)} color="#D97706" />
          <Text style={styles.calloutText}>{text}</Text>
        </View>
      )
    }
    if (block.type === 'image') {
      const imageUrl = normalizeHttpUrl(block.url)
      if (!imageUrl) return null
      return (
        <View key={`image-${idx}`} style={styles.mediaWrap}>
          <Image source={{ uri: imageUrl }} style={styles.mediaImage} resizeMode="contain" />
          {block.caption ? <Text style={styles.mediaCaption}>{String(block.caption || '').trim()}</Text> : null}
        </View>
      )
    }
    if (block.type === 'video') {
      const videoUrl = normalizeHttpUrl(block.url)
      if (!videoUrl) return null
      return (
        <Pressable key={`video-${idx}`} onPress={() => openContentUrl(videoUrl)} style={({ pressed }) => [styles.linkCard, pressed ? styles.pressed : null]}>
          <Ionicons name="play-circle-outline" size={moderateScale(20)} color="#2563EB" />
          <View style={styles.linkCardText}>
            <Text style={styles.linkCardTitle}>打开视频</Text>
            {block.caption ? <Text style={styles.linkCardSubtitle}>{String(block.caption || '').trim()}</Text> : null}
          </View>
          <Ionicons name="open-outline" size={moderateScale(16)} color="#94A3B8" />
        </Pressable>
      )
    }
    if (block.type === 'step') {
      const stepTitle = String(block.title || '').trim()
      const contents = Array.isArray(block.contents) ? block.contents : []
      if (!stepTitle && !contents.length) return null
      return (
        <View key={`step-${idx}`} style={styles.stepCard}>
          <View style={styles.stepIndexWrap}>
            <Text style={styles.stepIndexText}>{stepNumber}</Text>
          </View>
          <View style={styles.stepMain}>
            {stepTitle ? <Text style={styles.stepTitle}>{stepTitle}</Text> : null}
            <View style={styles.stepBody}>
              {contents.map((item, itemIdx) => renderStepItem(item, `step-${idx}-${itemIdx}`))}
            </View>
          </View>
        </View>
      )
    }
    return null
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

        {guideRoleLabel && params.kind === 'guide' ? (
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{guideRoleLabel}</Text>
          </View>
        ) : null}

        {showStructuredContent ? (
          <View style={styles.structuredWrap}>
            {(() => {
              let stepNumber = 0
              return structuredBlocks.map((block, idx) => {
                if (block.type === 'step') stepNumber += 1
                return renderBlock(block, idx, stepNumber)
              })
            })()}
          </View>
        ) : body ? <Text style={styles.body}>{body}</Text> : null}

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
  rolePill: { marginTop: 14, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#BFDBFE' },
  rolePillText: { color: '#1D4ED8', fontWeight: '900', fontSize: 12 },
  body: { marginTop: 14, color: '#374151', fontWeight: '600', lineHeight: 20 },
  structuredWrap: { marginTop: 14, gap: 12 },
  contentHeading: { color: '#111827', fontSize: moderateScale(18), fontWeight: '900' },
  contentParagraph: { color: '#374151', fontWeight: '600', lineHeight: 22 },
  calloutCard: { borderRadius: 14, borderWidth: hairline(), borderColor: '#FCD34D', backgroundColor: '#FFFBEB', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  calloutText: { flex: 1, minWidth: 0, color: '#92400E', fontWeight: '700', lineHeight: 20 },
  mediaWrap: { borderRadius: 16, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', padding: 10, overflow: 'hidden' },
  mediaImage: { width: '100%', height: moderateScale(200), backgroundColor: '#F1F5F9', borderRadius: 12 },
  mediaCaption: { marginTop: 8, color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  stepCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepIndexWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepIndexText: { color: '#1D4ED8', fontWeight: '900' },
  stepMain: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', padding: 12 },
  stepTitle: { color: '#111827', fontWeight: '900', fontSize: 14 },
  stepBody: { marginTop: 8, gap: 8 },
  stepText: { color: '#374151', fontWeight: '600', lineHeight: 20 },
  linkCard: { borderRadius: 14, borderWidth: hairline(), borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkCardText: { flex: 1, minWidth: 0 },
  linkCardTitle: { color: '#1D4ED8', fontWeight: '900' },
  linkCardSubtitle: { marginTop: 4, color: '#475569', fontWeight: '700', lineHeight: 18 },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 38, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  actionText: { color: '#FFFFFF', fontWeight: '800' },
  pressed: { opacity: 0.92 },
})
