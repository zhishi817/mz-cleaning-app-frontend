import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { API_BASE_URL } from '../../config/env'
import { useAuth } from '../../lib/auth'
import { logCopyCompanySecretForApp } from '../../lib/api'
import { companyContentCategoryLabel, companyGuideRoleLabel, hasStructuredCompanyContent, parseCompanyContentBlocks, type CompanyContentBlock, type CompanyContentStepItem } from '../../lib/companyContent'
import { hairline, moderateScale } from '../../lib/scale'
import type { NoticesStackParamList } from '../../navigation/RootNavigator'
import { useI18n } from '../../lib/i18n'

type Props = NativeStackScreenProps<NoticesStackParamList, 'InfoCenterDetail'>

function ContentImage(props: { url: string; caption?: string | null; onPreview: (url: string, caption?: string | null) => void }) {
  const { width } = useWindowDimensions()
  const [ratio, setRatio] = useState(4 / 3)
  const imageWidth = Math.max(220, width - 84)
  const imageHeight = Math.max(220, Math.min(680, imageWidth / ratio))

  useEffect(() => {
    let mounted = true
    Image.getSize(
      props.url,
      (w, h) => {
        if (!mounted || !w || !h) return
        setRatio(Math.max(0.35, Math.min(2.4, w / h)))
      },
      () => undefined,
    )
    return () => {
      mounted = false
    }
  }, [props.url])

  return (
    <Pressable onPress={() => props.onPreview(props.url, props.caption || null)} style={({ pressed }) => [styles.mediaWrap, pressed ? styles.pressed : null]}>
      <Image source={{ uri: props.url }} style={[styles.mediaImage, { height: imageHeight }]} resizeMode="contain" />
      <View style={styles.mediaHintRow}>
        <Ionicons name="expand-outline" size={moderateScale(14)} color="#64748B" />
        <Text style={styles.mediaHintText}>点击放大查看</Text>
      </View>
      {props.caption ? <Text style={styles.mediaCaption}>{String(props.caption || '').trim()}</Text> : null}
    </Pressable>
  )
}

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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const params = props.route.params
  const [previewImage, setPreviewImage] = useState<{ url: string; caption?: string | null } | null>(null)

  const title = String(params.title || '').trim()
  const subtitle = String(params.subtitle || '').trim()
  const body = String(params.body || '').trim()
  const contentRaw = String(params.contentRaw || '').trim()
  const contentSource = contentRaw || body
  const docCategoryLabel = companyContentCategoryLabel(params.docCategory)
  const guideRoleLabel = companyGuideRoleLabel(params.guideRole)
  const copyText = String(params.copyText || '').trim()
  const url = normalizeHttpUrl(params.url)
  const canCopy = !!copyText
  const canOpen = !!url
  const structuredBlocks = useMemo(() => parseCompanyContentBlocks(contentSource).blocks, [contentSource])
  const showStructuredContent = useMemo(() => hasStructuredCompanyContent(contentSource), [contentSource])

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

  function openImagePreview(rawUrl: string, caption?: string | null) {
    const imageUrl = normalizeHttpUrl(rawUrl)
    if (!imageUrl) return
    setPreviewImage({ url: imageUrl, caption: caption || null })
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
      return <ContentImage key={key} url={imageUrl} caption={item.caption || null} onPreview={openImagePreview} />
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
      const level = Math.max(1, Math.min(4, Number(block.level || 2)))
      return <Text key={`heading-${idx}`} style={[styles.contentHeading, level === 1 ? styles.contentHeadingL1 : level === 3 ? styles.contentHeadingL3 : level >= 4 ? styles.contentHeadingL4 : null]}>{text}</Text>
    }
    if (block.type === 'paragraph') {
      const text = String(block.text || '').trim()
      if (!text) return null
      return <Text key={`paragraph-${idx}`} style={styles.contentParagraph}>{text}</Text>
    }
    if (block.type === 'quote') {
      const text = String(block.text || '').trim()
      if (!text) return null
      return (
        <View key={`quote-${idx}`} style={styles.quoteBlock}>
          <Text style={styles.quoteText}>{text}</Text>
        </View>
      )
    }
    if (block.type === 'code') {
      const text = String(block.text || '').trim()
      if (!text) return null
      return (
        <View key={`code-${idx}`} style={styles.codeBlock}>
          {block.language ? <Text style={styles.codeLang}>{String(block.language || '').trim()}</Text> : null}
          <Text style={styles.codeText}>{text}</Text>
        </View>
      )
    }
    if (block.type === 'list') {
      const items = Array.isArray(block.items) ? block.items.map((item) => String(item || '').trim()).filter(Boolean) : []
      if (!items.length) return null
      return (
        <View key={`list-${idx}`} style={styles.listBlock}>
          {items.map((item, itemIdx) => (
            <View key={itemIdx} style={styles.listRow}>
              <Text style={styles.listMarker}>{block.ordered ? `${itemIdx + 1}.` : '•'}</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      )
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
      return <ContentImage key={`image-${idx}`} url={imageUrl} caption={block.caption || null} onPreview={openImagePreview} />
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
    <>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.document}>
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

        {params.kind === 'guide' ? (
          <View style={styles.pillRow}>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{docCategoryLabel}</Text>
            </View>
            {guideRoleLabel ? (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{guideRoleLabel}</Text>
              </View>
            ) : null}
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

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.viewerBackdrop}>
          <View style={styles.viewerTopBar}>
            <Text style={styles.viewerTitle} numberOfLines={1}>{previewImage?.caption || '图片预览'}</Text>
            <Pressable onPress={() => setPreviewImage(null)} style={({ pressed }) => [styles.viewerCloseBtn, pressed ? styles.pressed : null]}>
              <Ionicons name="close" size={moderateScale(22)} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.viewerScroll}
            contentContainerStyle={styles.viewerScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {previewImage?.url ? (
              <Image
                source={{ uri: previewImage.url }}
                style={{ width: windowWidth, height: Math.max(320, windowHeight - 150) }}
                resizeMode="contain"
              />
            ) : null}
          </ScrollView>
          {previewImage?.url ? (
            <Pressable onPress={() => openContentUrl(previewImage.url)} style={({ pressed }) => [styles.viewerOpenBtn, pressed ? styles.pressed : null]}>
              <Ionicons name="open-outline" size={moderateScale(18)} color="#FFFFFF" />
              <Text style={styles.viewerOpenText}>打开原图</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F6F7FB' },
  content: { padding: 16, paddingBottom: 24 },
  document: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, borderWidth: hairline(), borderColor: '#E5E7EB' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: hairline() },
  headText: { flex: 1, minWidth: 0 },
  title: { color: '#111827', fontSize: moderateScale(21), fontWeight: '900', lineHeight: 29 },
  subtitle: { marginTop: 6, color: '#6B7280', fontWeight: '700', lineHeight: 18 },
  pillRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rolePill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EFF6FF', borderWidth: hairline(), borderColor: '#BFDBFE' },
  rolePillText: { color: '#1D4ED8', fontWeight: '900', fontSize: 12 },
  body: { marginTop: 14, color: '#374151', fontWeight: '600', lineHeight: 20 },
  structuredWrap: { marginTop: 18, gap: 14 },
  contentHeading: { marginTop: 4, color: '#111827', fontSize: moderateScale(19), fontWeight: '900', lineHeight: 27 },
  contentHeadingL1: { fontSize: moderateScale(24), lineHeight: 32 },
  contentHeadingL3: { fontSize: moderateScale(17), lineHeight: 24 },
  contentHeadingL4: { fontSize: moderateScale(15), lineHeight: 22 },
  contentParagraph: { color: '#374151', fontWeight: '500', fontSize: 15, lineHeight: 25 },
  quoteBlock: { borderLeftWidth: 4, borderLeftColor: '#CBD5E1', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  quoteText: { color: '#475569', fontWeight: '600', fontSize: 14, lineHeight: 22 },
  codeBlock: { borderRadius: 12, backgroundColor: '#0F172A', padding: 12 },
  codeLang: { color: '#94A3B8', fontWeight: '900', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' },
  codeText: { color: '#E2E8F0', fontFamily: 'Menlo', fontSize: 12, lineHeight: 19 },
  listBlock: { gap: 8 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  listMarker: { minWidth: 22, color: '#2563EB', fontWeight: '900', lineHeight: 23 },
  listText: { flex: 1, minWidth: 0, color: '#374151', fontWeight: '500', fontSize: 15, lineHeight: 23 },
  calloutCard: { borderRadius: 14, borderWidth: hairline(), borderColor: '#FCD34D', backgroundColor: '#FFFBEB', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  calloutText: { flex: 1, minWidth: 0, color: '#92400E', fontWeight: '700', lineHeight: 20 },
  mediaWrap: { borderRadius: 16, borderWidth: hairline(), borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', padding: 10, overflow: 'hidden' },
  mediaImage: { width: '100%', backgroundColor: '#F1F5F9', borderRadius: 12 },
  mediaHintRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  mediaHintText: { color: '#64748B', fontSize: 12, fontWeight: '800' },
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
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 128, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  actionText: { color: '#FFFFFF', fontWeight: '800', textAlign: 'center' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.96)', paddingTop: 48, paddingBottom: 26 },
  viewerTopBar: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  viewerTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  viewerCloseBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  viewerScroll: { flex: 1, marginTop: 12 },
  viewerScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  viewerOpenBtn: { alignSelf: 'center', minHeight: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: '#2563EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  viewerOpenText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.92 },
})
