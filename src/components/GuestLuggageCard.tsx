import React, { useState } from 'react'
import { Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { API_BASE_URL } from '../config/env'
import { acknowledgeGuestLuggageNotice, type GuestLuggageNotice } from '../lib/api'
import { hairline, moderateScale } from '../lib/scale'

function absoluteUrl(rawUrl: string) {
  const value = String(rawUrl || '').trim()
  if (!value || /^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  const base = String(API_BASE_URL || '').trim().replace(/\/+$/g, '').replace(/\/auth\/?$/g, '').replace(/\/api\/?$/g, '')
  return value.startsWith('/') ? `${base}${value}` : value
}

function AckGroup(props: { label: string; items: GuestLuggageNotice['acknowledgements']['cleaners'] }) {
  if (!props.items.length) return null
  return (
    <View style={styles.ackGroup}>
      <Text style={styles.ackGroupLabel}>{props.label}</Text>
      <View style={styles.ackPills}>
        {props.items.map((item) => (
          <View key={`${props.label}-${item.user_id}`} style={[styles.ackPill, item.acknowledged ? styles.ackPillDone : null]}>
            <Ionicons
              name={item.acknowledged ? 'checkmark-circle' : 'time-outline'}
              size={moderateScale(13)}
              color={item.acknowledged ? '#15803D' : '#B45309'}
            />
            <Text style={[styles.ackPillText, item.acknowledged ? styles.ackPillTextDone : null]}>
              {item.user_name || item.user_id}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function GuestLuggageCard(props: {
  notice?: GuestLuggageNotice | null
  token?: string | null
  showAcknowledge?: boolean
  showAcknowledgementSummary?: boolean
  compact?: boolean
  onChanged?: (notice: GuestLuggageNotice) => void | Promise<void>
}) {
  const notice = props.notice
  const [acknowledging, setAcknowledging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  if (!notice) return null
  const photoUrls = (notice.photo_urls || []).slice(0, 3)

  const acknowledge = async () => {
    if (!props.token || acknowledging || notice.current_user_acknowledged) return
    try {
      setAcknowledging(true)
      const result = await acknowledgeGuestLuggageNotice(props.token, notice.id)
      if (result.guest_luggage) await props.onChanged?.(result.guest_luggage)
    } catch (error: any) {
      Alert.alert('确认失败', String(error?.message || '请稍后重试'))
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <>
      <View style={[styles.card, props.compact ? styles.cardCompact : null]}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={moderateScale(18)} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>当天任务临时通知</Text>
            <Text style={styles.subtitle}>请查看说明或照片，并按通知内容处理。</Text>
          </View>
        </View>

        {notice.note ? <Text style={styles.note}>{notice.note}</Text> : null}

        {photoUrls.length ? (
          <View style={styles.photos}>
            {photoUrls.map((url, index) => (
              <Pressable key={`${url}-${index}`} onPress={() => setPreviewUrl(absoluteUrl(url))} style={({ pressed }) => [styles.photoWrap, pressed ? styles.pressed : null]}>
                <Image source={{ uri: absoluteUrl(url) }} style={styles.photo} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {props.showAcknowledge ? (
          notice.current_user_acknowledged ? (
            <View style={styles.ackDone}>
              <Ionicons name="checkmark-circle" size={moderateScale(17)} color="#15803D" />
              <Text style={styles.ackDoneText}>我已确认知晓</Text>
            </View>
          ) : (
            <Pressable
              onPress={acknowledge}
              disabled={!props.token || acknowledging}
              style={({ pressed }) => [styles.ackButton, pressed ? styles.pressed : null, !props.token || acknowledging ? styles.disabled : null]}
            >
              <Text style={styles.ackButtonText}>{acknowledging ? '确认中...' : '我已知晓'}</Text>
            </Pressable>
          )
        ) : null}

        {props.showAcknowledgementSummary ? (
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>知晓状态</Text>
            <AckGroup label="清洁" items={notice.acknowledgements?.cleaners || []} />
            <AckGroup label="检查" items={notice.acknowledgements?.inspectors || []} />
          </View>
        ) : null}
      </View>

      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewUrl(null)}>
          {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  cardCompact: { marginTop: 10, padding: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  iconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: '#991B1B', fontSize: 15, fontWeight: '900' },
  subtitle: { marginTop: 2, color: '#B91C1C', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  note: { marginTop: 9, color: '#7F1D1D', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  photos: { marginTop: 10, flexDirection: 'row', gap: 8 },
  photoWrap: { flex: 1, maxWidth: 112, aspectRatio: 1, borderRadius: 10, overflow: 'hidden', borderWidth: hairline(), borderColor: '#FCA5A5', backgroundColor: '#FFFFFF' },
  photo: { width: '100%', height: '100%' },
  ackButton: { marginTop: 11, minHeight: 40, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ackButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  ackDone: { marginTop: 11, minHeight: 38, borderRadius: 10, backgroundColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  ackDoneText: { color: '#166534', fontWeight: '900', fontSize: 13 },
  summary: { marginTop: 11, paddingTop: 10, borderTopWidth: hairline(), borderTopColor: '#FCA5A5', gap: 7 },
  summaryTitle: { color: '#7F1D1D', fontWeight: '900', fontSize: 12 },
  ackGroup: { gap: 5 },
  ackGroupLabel: { color: '#991B1B', fontWeight: '800', fontSize: 11 },
  ackPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ackPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: hairline(), borderColor: '#FCD34D', backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 5 },
  ackPillDone: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  ackPillText: { color: '#92400E', fontSize: 11, fontWeight: '800' },
  ackPillTextDone: { color: '#166534' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  previewImage: { width: '100%', height: '84%' },
})
